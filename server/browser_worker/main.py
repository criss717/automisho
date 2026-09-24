from contextlib import asynccontextmanager
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
from urllib.parse import quote_plus
import asyncio
import logging
import os
import re
import unicodedata

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("automisho.browser_worker")

try:
    from playwright.async_api import async_playwright

    PLAYWRIGHT_AVAILABLE = True
except ImportError:  # pragma: no cover - depends on image layers
    async_playwright = None
    PLAYWRIGHT_AVAILABLE = False

try:
    from playwright_stealth import stealth_async

    STEALTH_AVAILABLE = True
except ImportError:
    stealth_async = None
    STEALTH_AVAILABLE = False

CONCURRENCY_LIMIT = int(os.getenv("BROWSER_CONCURRENCY", "5"))
NAV_TIMEOUT_MS = int(os.getenv("BROWSER_NAV_TIMEOUT_MS", "30000"))
MAX_RESULTS_PER_SOURCE = int(os.getenv("BROWSER_MAX_RESULTS", "25"))

_pool_semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)
_playwright = None
_browser = None

# Noise words stripped from natural-language queries before hitting portals.
# Portals do not understand NL ("hola dame los 5 mejores...") and return 0
# results or block, so we keep only brand/model tokens or meaningful words.
_PORTAL_NOISE = {
    "hola", "dame", "dime", "busco", "busca", "quiero", "necesito",
    "mejores", "mejor", "buenos", "bueno", "buenas", "baratos", "barato",
    "coches", "coche", "opciones", "opcion", "cinco", "tres", "cuatro", "seis", "siete", "ocho", "diez",
    "puertas", "puerta", "grises", "gris", "negros", "negro",
    "blancos", "blanco", "rojos", "rojo", "azules", "azul",
    "menos", "mas", "que", "euros", "euro", "gasolina", "diesel", "diésel",
    "segunda", "mano", "hay", "para", "con", "sin", "hasta", "sobre",
    "entre", "por", "de", "del", "un", "una", "el", "la", "los", "las",
    "y", "a", "al", "en", "mi", "mis", "solo", "ver", "pero", "ojo",
    "porfa", "favor", "candidatos", "smejores", "marca", "marcas",
    "viaje", "viajes", "largo", "largos", "viajar", "cv", "potencia",
    "minimo", "maximo", "fiable", "confiable", "economico", "ocasion", "estado",
}

_KNOWN_MAKES_MODELS = {
    "seat", "volkswagen", "vw", "renault", "peugeot", "toyota", "bmw",
    "mercedes", "ford", "opel", "nissan", "hyundai", "kia", "audi",
    "skoda", "fiat", "citroen", "dacia", "mazda", "honda", "volvo",
    "chevrolet", "alfa", "mitsubishi", "suzuki", "subaru", "lancia",
    "leon", "ibiza", "golf", "clio", "corolla", "focus", "corsa",
    "fiesta", "c3", "208", "astra", "megane", "insignia", "zafira",
    "passat", "polo", "toledo", "mondeo", "laguna",
}

_TYPO_NORMALIZATIONS = {
    "pegout": "peugeot",
    "pegeot": "peugeot",
    "chebrolet": "chevrolet",
    "mercede": "mercedes",
    "wolsvagen": "volkswagen",
    "volksvagen": "volkswagen",
}


def _strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )


def _extract_excluded_from_text(text: str) -> set[str]:
    """Extract excluded makes from natural language negation clauses."""
    excluded = set()
    cleaned = _strip_accents(text.lower())
    # Match clauses like "no sean de la marca opel", "no opel ni peugeot", "descartar peugeot"
    neg_clause_pattern = re.compile(
        r"(?:no|ni|sin|menos|excepto|descartar|descarto|fuera|nada\s+de)\s+(?:quiero\s+)?(?:que\s+sean?\s+)?(?:de\s+la\s+marca\s+|marca\s+|marcas\s+|coches?\s+)?([a-z0-9\s,]+?)(?:\.|$|y\s+solo|con\s+presupuesto|minimo|maximo)",
        re.IGNORECASE
    )
    for match in neg_clause_pattern.finditer(cleaned):
        clause = match.group(1)
        tokens = re.sub(r"[^\w\s]", " ", clause).split()
        for tok in tokens:
            normalized = _TYPO_NORMALIZATIONS.get(tok, tok)
            if normalized in _KNOWN_MAKES_MODELS:
                excluded.add(normalized)
    return excluded


def _clean_query_for_portal(
    query: str,
    makes: Optional[List[str]] = None,
    excluded_makes: Optional[List[str]] = None,
) -> str:
    """Reduce query to portal-searchable keywords.

    If positive makes are provided (or found in query), returns them (never returning excluded makes).
    If no positive make is found (e.g., broad search by budget/power), returns empty string
    so portals do price/filter searches without breaking on conversational keywords.
    """
    excluded: set[str] = set()
    if excluded_makes:
        for em in excluded_makes:
            n = _TYPO_NORMALIZATIONS.get(em.lower().strip(), em.lower().strip())
            excluded.add(n)

    if query:
        excluded.update(_extract_excluded_from_text(query))

    # 1. If explicit target makes provided, prioritize the first non-excluded make
    if makes:
        valid_makes = [
            _TYPO_NORMALIZATIONS.get(m.lower().strip(), m.lower().strip())
            for m in makes
            if _TYPO_NORMALIZATIONS.get(m.lower().strip(), m.lower().strip()) not in excluded
        ]
        if valid_makes:
            return valid_makes[0]

    if not query:
        return ""

    words = re.sub(r"[^\w\s]", " ", _strip_accents(query.lower())).split()
    normalized_words = [_TYPO_NORMALIZATIONS.get(w, w) for w in words]

    # Find known makes or models that are NOT excluded
    brands = [w for w in normalized_words if w in _KNOWN_MAKES_MODELS and w not in excluded]
    if brands:
        return " ".join(brands[:2])

    # If query has specific technical model/brand terms not in noise or excluded
    meaningful = [
        w for w in normalized_words
        if w not in _PORTAL_NOISE and w not in excluded and len(w) >= 3
    ]
    # If meaningful words are purely adjectival/generic (not brand/model), return empty
    # to avoid portal 0-results
    brand_or_model = [w for w in meaningful if w in _KNOWN_MAKES_MODELS]
    if brand_or_model:
        return " ".join(brand_or_model[:2])

    return ""


def _build_portal_url(
    source: str,
    keywords: str,
    max_price: Optional[int],
    min_price: Optional[int] = None,
    doors: Optional[int] = None,
) -> Optional[str]:
    """Build a portal search URL with real price and filter parameters.

    `keywords` is already cleaned; empty keywords means generic price-only
    search (no keyword param, avoids filtering everything to 0).
    Returns None for unknown sources.
    """
    q = quote_plus(keywords) if keywords else ""
    if source == "autoscout24":
        url = "https://www.autoscout24.es/lst?atype=C&cy=E&desc=0&sort=standard&ustate=new%2Cused"
        if q:
            url += f"&q={q}"
        if max_price is not None:
            url += f"&priceto={max_price}"
        if min_price is not None:
            url += f"&pricefrom={min_price}"
        if doors is not None:
            url += f"&doorfrom={doors}&doorto={doors}"
        return url
    if source == "coches_net":
        url = "https://www.coches.net/segunda-mano/"
        params = []
        if q:
            params.append(f"Keywords={q}")
        if max_price is not None:
            params.append(f"MaxPrice={max_price}")
        if min_price is not None:
            params.append(f"MinPrice={min_price}")
        if doors is not None:
            params.append(f"DoorsList={doors}")
        if params:
            url += "?" + "&".join(params)
        return url
    if source == "wallapop":
        url = "https://es.wallapop.com/search?category_id=100&filters_source=search_box"
        if q:
            url += f"&keywords={q}"
        if max_price is not None:
            url += f"&max_sale_price={max_price}"
        if min_price is not None:
            url += f"&min_sale_price={min_price}"
        return url
    if source == "milanuncios":
        base = "https://www.milanuncios.com/coches-de-segunda-mano/"
        params = ["demanda=n"]
        if q:
            params.append(f"s={q}")
        if max_price is not None:
            params.append(f"precio-hasta={max_price}")
        if min_price is not None:
            params.append(f"precio-desde={min_price}")
        if doors is not None:
            params.append(f"puertas={doors}")
        return base + "?" + "&".join(params)
    return None

EXTRACT_LISTINGS_JS = """() => {
  const out = [];
  const seen = new Set();

  const extractCardImage = (card) => {
    // 1. Check all img tags (including lazy loading attributes)
    const imgs = card.querySelectorAll('img');
    for (const img of imgs) {
      const candidates = [
        img.getAttribute('data-src'),
        img.getAttribute('data-lazy-src'),
        img.getAttribute('data-original'),
        img.getAttribute('src'),
      ];
      for (const c of candidates) {
        if (c && c.startsWith('http') && !c.includes('logo') && !c.includes('avatar') && !c.includes('icon') && !c.endsWith('.svg') && !c.includes('.svg?')) {
          return c;
        }
      }
      const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
      if (srcset) {
        const first = srcset.split(',')[0].trim().split(' ')[0];
        if (first && first.startsWith('http') && !first.endsWith('.svg')) {
          return first;
        }
      }
    }
    // 2. Check picture source tags
    const sources = card.querySelectorAll('picture source[srcset]');
    for (const s of sources) {
      const srcset = s.getAttribute('srcset');
      if (srcset) {
        const first = srcset.split(',')[0].trim().split(' ')[0];
        if (first && first.startsWith('http') && !first.endsWith('.svg')) {
          return first;
        }
      }
    }
    // 3. Check video poster (when first media element is a video preview)
    const video = card.querySelector('video[poster]');
    if (video) {
      const poster = video.getAttribute('poster');
      if (poster && poster.startsWith('http')) return poster;
    }
    // 4. Check background-image
    const bgEls = card.querySelectorAll('[style*="background-image"], [style*="background:"]');
    for (const el of bgEls) {
      const style = el.getAttribute('style') || '';
      const match = style.match(/url\\(['"]?(https?:[^'")]+)['"]?\\)/i);
      if (match && match[1] && !match[1].endsWith('.svg')) {
        return match[1];
      }
    }
    return null;
  };

  // 1. AutoScout24 specific extraction
  const as24Articles = document.querySelectorAll('article.cldt-summary-full-item, article[data-testid="list-item"]');
  for (const art of as24Articles) {
    if (out.length >= 35) break;
    const guid = art.getAttribute('data-guid') || art.id;
    let link = guid ? `https://www.autoscout24.es/anuncios/-${guid}` : '';
    const a = art.querySelector('a[href*="/anuncios/"]');
    if (a && a.href) link = a.href;
    if (!link || seen.has(link)) continue;

    const titleEl = art.querySelector('span[class*="ListItemTitle"], span[class*="title" i], h2, h3');
    const title = titleEl ? titleEl.innerText.replace(/\\s+/g, ' ').trim() : ((art.getAttribute('data-make') || 'Coche') + ' ' + (art.getAttribute('data-model') || ''));

    let price = art.getAttribute('data-price');
    if (!price) {
      const pEl = art.querySelector('[data-testid="regular-price"]');
      price = pEl ? pEl.innerText.trim() : null;
    }

    const imageUrl = extractCardImage(art);
    const fullText = (art.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 800);
    out.push({ title: title.slice(0, 160), url: link, price: price ? String(price) : null, image_url: imageUrl, description: fullText });
    seen.add(link);
  }
  if (out.length > 0) return out;

  // 2. Coches.net specific extraction
  const cnetCards = document.querySelectorAll('.mt-CardAd, [class*="CardAd"], [data-testid*="card-ad"]');
  for (const card of cnetCards) {
    if (out.length >= 35) break;
    const linkEl = card.querySelector('a[href*="-covo.aspx"], a[href*="/segunda-mano/"], a[data-testid="card-ad-link"], a[href]');
    if (!linkEl || !linkEl.href || linkEl.href.includes('javascript:')) continue;
    let link = linkEl.href;
    if (link.startsWith('/')) link = 'https://www.coches.net' + link;
    if (seen.has(link)) continue;

    const titleEl = card.querySelector('h2, h3, .mt-CardAd-infoHeaderTitleLink, a');
    const title = titleEl ? titleEl.innerText.replace(/\\s+/g, ' ').trim() : '';
    if (title.length < 5) continue;

    const priceEl = card.querySelector('[data-testid*="price"], [class*="price" i]');
    const priceText = priceEl ? priceEl.innerText.trim() : card.innerText;

    const imageUrl = extractCardImage(card);
    const fullText = (card.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 800);
    out.push({ title: title.slice(0, 160), url: link, price: priceText ? priceText.slice(0, 50) : null, image_url: imageUrl, description: fullText });
    seen.add(link);
  }
  if (out.length > 0) return out;

  // 3. Milanuncios specific extraction
  const maCards = document.querySelectorAll('article[data-testid="AD_CARD"], article.ma-AdCardV2, [class*="ma-AdCard"]');
  for (const card of maCards) {
    if (out.length >= 35) break;
    const linkEl = card.querySelector('a[href*=".htm"]');
    if (!linkEl || !linkEl.href) continue;
    const link = linkEl.href;
    if (seen.has(link)) continue;

    const title = linkEl.innerText.replace(/\\s+/g, ' ').trim();
    if (title.length < 5) continue;

    const priceMatch = card.innerText.match(/(\\d[\\d\\s\\.\\,]*\\s*€|€\\s*\\d[\\d\\s\\.\\,]*)/);
    const price = priceMatch ? priceMatch[0] : null;

    const imageUrl = extractCardImage(card);
    const fullText = (card.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 800);
    out.push({ title: title.slice(0, 160), url: link, price: price, image_url: imageUrl, description: fullText });
    seen.add(link);
  }
  if (out.length > 0) return out;

  // 4. Wallapop & Generic vehicle cards (Fallback without 'li' navbar noise)
  const genericCards = document.querySelectorAll('a[href*="/item/"], article, [data-testid*="result"], [class*="item-card" i], [class*="ItemCard" i]');
  const priceRe = /(\\d[\\d\\s\\.\\,]*\\s*€|€\\s*\\d[\\d\\s\\.\\,]*)/;
  for (const card of genericCards) {
    if (out.length >= 35) break;
    let link = card.tagName === 'A' ? card.href : (card.querySelector('a[href*="/item/"], a[href]')?.href || '');
    if (!link || !link.startsWith('http') || seen.has(link)) continue;

    const lowLink = link.toLowerCase();
    if (lowLink.includes('/account') || lowLink.includes('/login') || lowLink.includes('/profesionales') || lowLink.includes('/inmobiliaria') || lowLink.includes('rentingcoches.com')) continue;

    const cardText = (card.innerText || '').replace(/\\s+/g, ' ').trim();
    const priceMatch = cardText.match(priceRe);
    if (!priceMatch) continue;

    const titleEl = card.querySelector('h2,h3,h1,[class*="title" i],[class*="Title" i]');
    let title = titleEl ? titleEl.innerText.replace(/\\s+/g, ' ').trim() : '';
    if (title.length < 5) {
      title = cardText.split('\\n')[0].slice(0, 120);
    }
    if (title.length < 5) continue;

    const imageUrl = extractCardImage(card);
    out.push({ title: title.slice(0, 160), url: link, image_url: imageUrl, price: priceMatch[0], description: cardText.slice(0, 800) });
    seen.add(link);
  }
  return out;
}"""

EXTRACT_DETAIL_JS = """() => {
  const meta = (sel, attr) => {
    const el = document.querySelector(sel);
    return el ? (el.getAttribute(attr) || '') : '';
  };
  const h1 = document.querySelector('h1');
  const title = meta('meta[property="og:title"]', 'content')
    || (h1 ? h1.innerText.trim() : '')
    || document.title
    || '';
  const description = meta('meta[property="og:description"]', 'content')
    || meta('meta[name="description"]', 'content')
    || '';
  const images = [];
  const ogImage = meta('meta[property="og:image"]', 'content');
  if (ogImage && ogImage.startsWith('http')) images.push(ogImage);
  const allImgs = document.querySelectorAll('img');
  for (const img of allImgs) {
    const src = img.currentSrc || img.src || '';
    if (src.startsWith('http') && images.indexOf(src) === -1) images.push(src);
    if (images.length >= 10) break;
  }
  return {
    title: title,
    description: description,
    images: images,
    bodyText: document.body ? document.body.innerText.slice(0, 20000) : '',
  };
}"""

PRICE_RE = re.compile(
    r"(?:€\s*(\d{1,3}(?:[\.\s]\d{3})*(?:,\d+)?|\d+)|(\d{1,3}(?:[\.\s]\d{3})*(?:,\d+)?|\d+)\s*€)"
)


def _parse_price(text: Optional[str]) -> Optional[int]:
    if not text:
        return None
    if isinstance(text, (int, float)):
        return int(text)
    clean = str(text).replace("\xa0", " ").strip()
    m = PRICE_RE.search(clean)
    if m:
        num_str = m.group(1) or m.group(2)
        digits = re.sub(r"[^\d]", "", num_str.split(",")[0])
        if digits:
            try:
                val = int(digits)
                if 100 <= val <= 500000:
                    return val
            except ValueError:
                pass
    if clean.isdigit():
        val = int(clean)
        if 100 <= val <= 500000:
            return val
    return None


def _resolve_entry_price(entry: dict) -> Optional[int]:
    """Prefer a portal-provided direct price; fall back to title parsing.

    Accepts the price field as int/float or as a raw string (e.g. "2.500 €")
    and returns None when nothing parseable is found.
    """
    direct = entry.get("price")
    if isinstance(direct, bool):
        pass
    elif isinstance(direct, (int, float)):
        return int(direct)
    elif isinstance(direct, str) and direct.strip():
        parsed = _parse_price(direct)
        if parsed is not None:
            return parsed
    return _parse_price(entry.get("title", ""))


def _price_in_bounds(
    price: int, max_price: Optional[int], min_price: Optional[int] = None
) -> bool:
    """Check a resolved price against optional min/max bounds."""
    if max_price is not None and price > max_price:
        return False
    if min_price is not None and price < min_price:
        return False
    return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _playwright, _browser
    if PLAYWRIGHT_AVAILABLE and async_playwright is not None:
        try:
            _playwright = await async_playwright().start()
            _browser = await _playwright.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                ],
            )
            logger.info("[BrowserWorker] Chromium pool started (headless).")
        except Exception as exc:
            logger.error(f"[BrowserWorker] Failed to launch Chromium: {exc}")
            _playwright = None
            _browser = None
    else:
        logger.error("[BrowserWorker] Playwright is not installed; scraping disabled.")
    yield
    try:
        if _browser is not None:
            await _browser.close()
    except Exception:
        pass
    try:
        if _playwright is not None:
            await _playwright.stop()
    except Exception:
        pass
    _browser = None
    _playwright = None


app = FastAPI(
    title="AutoMisho Isolated Browser Worker",
    description="Dedicated Playwright & Chromium service for stealth vehicle scraping and DOM inspection",
    version="2.0.0",
    lifespan=lifespan,
)


class SearchRequest(BaseModel):
    query: Optional[str] = ""
    makes: Optional[List[str]] = None
    excluded_makes: Optional[List[str]] = None
    max_price: Optional[int] = None
    min_price: Optional[int] = None
    doors: Optional[int] = None
    body_type: Optional[str] = None
    sources: Optional[List[str]] = ["coches_net", "milanuncios", "wallapop", "autoscout24"]


class InspectRequest(BaseModel):
    url: str


class CarItem(BaseModel):
    title: str
    price: int
    year: Optional[int] = None
    km: Optional[int] = None
    source: str
    url: str
    image_url: Optional[str] = None
    description: Optional[str] = None


class InspectResult(BaseModel):
    url: str
    title: str
    price: int
    description: str
    images: List[str]
    seller_phone: Optional[str] = None
    plate_or_vin: Optional[str] = None


def _pool_active() -> bool:
    return _browser is not None and _browser.is_connected()


async def _new_page():
    """Creates an isolated context + page, applying stealth when available."""
    context = await _browser.new_context(
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/126.0.0.0 Safari/537.36"
        ),
        viewport={"width": 1366, "height": 900},
        locale="es-ES",
    )
    page = await context.new_page()
    if STEALTH_AVAILABLE and stealth_async is not None:
        try:
            await stealth_async(page)
        except Exception as exc:
            logger.warning(f"[BrowserWorker] Stealth hook failed: {exc}")
    return context, page


COOKIE_BANNER_SELECTORS = [
    "button:has-text('Aceptar')",
    "button:has-text('Acepto')",
    "button:has-text('Accept')",
    "button:has-text('Aceptar todas')",
    "#onetrust-accept-btn-handler",
    "#onetrust-reject-all-handler",
    "[id*='onetrust'] button",
    "button[id*='cookie' i]",
    "[class*='cookie' i] button",
]


async def _dismiss_cookie_banner(page) -> None:
    """Best-effort cookie banner dismissal; never raises."""
    for selector in COOKIE_BANNER_SELECTORS:
        try:
            await page.click(selector, timeout=1200)
            logger.info("[BrowserWorker] Cookie banner dismissed via '%s'.", selector)
            return
        except Exception:
            continue


async def _scrape_source(
    source: str,
    query: str,
    max_price: Optional[int],
    min_price: Optional[int] = None,
    doors: Optional[int] = None,
    makes: Optional[List[str]] = None,
    excluded_makes: Optional[List[str]] = None,
) -> List[CarItem]:
    """Scrapes one portal. Returns real listings only; empty list on any failure."""
    if not _pool_active():
        logger.warning("[BrowserWorker] Chromium pool unavailable; skipping source '%s'.", source)
        return []
    keywords = _clean_query_for_portal(query, makes=makes, excluded_makes=excluded_makes)
    url = _build_portal_url(source, keywords, max_price, min_price, doors)
    if not url:
        logger.warning("[BrowserWorker] Unknown source '%s'; skipping.", source)
        return []

    async with _pool_semaphore:
        context = None
        try:
            context, page = await _new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
                await page.wait_for_timeout(1000)
            except Exception as nav_err:
                logger.warning(f"[BrowserWorker] Navigation failed for '{source}': {nav_err}")
                return []

            await _dismiss_cookie_banner(page)
            try:
                await page.wait_for_selector(
                    '.mt-CardAd, [data-testid*="card-ad"], article, [data-testid="list-item"], [data-testid="AD_CARD"], .item-card',
                    timeout=5000
                )
            except Exception:
                pass
            try:
                for _ in range(3):
                    await page.keyboard.press("PageDown")
                    await page.wait_for_timeout(600)
            except Exception as scroll_err:
                logger.warning(f"[BrowserWorker] Scroll failed for '{source}': {scroll_err}")

            try:
                raw_entries = await page.evaluate(EXTRACT_LISTINGS_JS)
            except Exception as eval_err:
                logger.warning(f"[BrowserWorker] DOM extraction failed for '{source}': {eval_err}")
                return []

            items: List[CarItem] = []
            raw_count = len(raw_entries or [])
            for entry in raw_entries or []:
                # Prefer the portal-provided price; fall back to title parsing.
                price = _resolve_entry_price(entry)
                if price is None:
                    continue
                if not _price_in_bounds(price, max_price, min_price):
                    continue
                image_url = entry.get("image_url")
                items.append(
                    CarItem(
                        title=entry.get("title", "")[:160],
                        price=price,
                        source=source,
                        url=entry.get("url", ""),
                        image_url=image_url if image_url and image_url.startswith("http") else None,
                        description=entry.get("description"),
                    )
                )
                if len(items) >= MAX_RESULTS_PER_SOURCE:
                    break
            logger.info(
                f"[BrowserWorker] Source '{source}' raw_entries={raw_count} converted={len(items)}."
            )
            return items
        except Exception as exc:
            logger.warning(f"[BrowserWorker] Scrape failed for '{source}': {exc}")
            return []
        finally:
            if context is not None:
                try:
                    await context.close()
                except Exception:
                    pass


@app.get("/health")
async def health_check():
    pool_ok = _pool_active()
    return {
        "status": "healthy" if pool_ok else "degraded",
        "service": "automisho-browser",
        "chromium_pool_active": pool_ok,
        "concurrency_limit": CONCURRENCY_LIMIT,
        "playwright_available": PLAYWRIGHT_AVAILABLE,
        "stealth_enabled": STEALTH_AVAILABLE,
    }


@app.post("/scrape/search", response_model=List[CarItem])
async def search_portal(req: SearchRequest):
    """
    Real stealth browser search across Spanish portals.
    Executes in an isolated container with a bounded Chromium pool.
    Never returns fabricated listings: failures yield an empty list.
    """
    logger.info(
        f"[BrowserWorker] Searching query='{req.query}' makes={req.makes} "
        f"excluded_makes={req.excluded_makes} max_price={req.max_price} min_price={req.min_price} doors={req.doors}"
    )
    sources = req.sources or []
    if not sources:
        return []
    per_source = await asyncio.gather(
        *[
            _scrape_source(
                source,
                req.query or "",
                req.max_price,
                req.min_price,
                req.doors,
                makes=req.makes,
                excluded_makes=req.excluded_makes,
            )
            for source in sources
        ]
    )
    results: List[CarItem] = [item for group in per_source for item in group]

    # Combine explicit excluded_makes and any negative clause from query
    all_excluded = set()
    if req.excluded_makes:
        for em in req.excluded_makes:
            all_excluded.add(_strip_accents(em.lower().strip()))
    if req.query:
        all_excluded.update(_extract_excluded_from_text(req.query))

    if all_excluded:
        results = [
            c for c in results
            if not any(re.search(rf"\b{re.escape(ex)}\b", c.title.lower()) for ex in all_excluded)
        ]

    if req.max_price:
        results = [c for c in results if c.price <= req.max_price * 1.05]

    return results


@app.post("/scrape/inspect", response_model=InspectResult)
async def inspect_listing(req: InspectRequest):
    """
    Opens a real listing URL and extracts title, price, description and images.
    Returns empty fields (never fabricated data) when navigation fails.
    """
    logger.info(f"[BrowserWorker] Inspecting listing url='{req.url}'")
    empty = InspectResult(url=req.url, title="", price=0, description="", images=[])
    if not _pool_active():
        return empty

    async with _pool_semaphore:
        context = None
        try:
            context, page = await _new_page()
            try:
                await page.goto(req.url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
                await page.wait_for_timeout(1200)
            except Exception as nav_err:
                logger.warning(f"[BrowserWorker] Inspect navigation failed: {nav_err}")
                return empty
            try:
                data = await page.evaluate(EXTRACT_DETAIL_JS)
            except Exception as eval_err:
                logger.warning(f"[BrowserWorker] Inspect extraction failed: {eval_err}")
                return empty

            images = [u for u in (data.get("images") or []) if u.startswith("http")][:8]
            return InspectResult(
                url=req.url,
                title=(data.get("title") or "")[:200],
                price=_parse_price(data.get("bodyText") or "") or 0,
                description=(data.get("description") or "")[:2000],
                images=images,
            )
        except Exception as exc:
            logger.warning(f"[BrowserWorker] Inspect failed: {exc}")
            return empty
        finally:
            if context is not None:
                try:
                    await context.close()
                except Exception:
                    pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=False)
