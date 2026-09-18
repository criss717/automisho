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
NAV_TIMEOUT_MS = int(os.getenv("BROWSER_NAV_TIMEOUT_MS", "20000"))
MAX_RESULTS_PER_SOURCE = int(os.getenv("BROWSER_MAX_RESULTS", "15"))

_pool_semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)
_playwright = None
_browser = None

# Noise words stripped from natural-language queries before hitting portals.
# Portals do not understand NL ("hola dame los 5 mejores...") and return 0
# results or block, so we keep only brand/model tokens or meaningful words.
_PORTAL_NOISE = {
    "hola", "dame", "dime", "busco", "busca", "quiero", "necesito",
    "mejores", "mejor", "buenos", "bueno", "buenas", "baratos", "barato",
    "coches", "coche", "opciones", "opcion", "cinco", "tres", "cuatro",
    "puertas", "puerta", "grises", "gris", "negros", "negro",
    "blancos", "blanco", "rojos", "rojo", "azules", "azul",
    "menos", "mas", "que", "euros", "euro", "gasolina", "diesel",
    "segunda", "mano", "hay", "para", "con", "sin", "hasta", "sobre",
    "entre", "por", "de", "del", "un", "una", "el", "la", "los", "las",
    "y", "a", "al", "en", "mi", "mis", "solo", "ver", "pero", "ojo",
    "porfa", "favor", "candidatos", "smejores",
}

_KNOWN_MAKES_MODELS = {
    "seat", "volkswagen", "vw", "renault", "peugeot", "toyota", "bmw",
    "mercedes", "ford", "opel", "nissan", "hyundai", "kia", "audi",
    "skoda", "fiat", "citroen", "dacia", "mazda", "honda", "volvo",
    "leon", "ibiza", "golf", "clio", "corolla", "focus", "corsa",
    "fiesta", "c3", "208", "astra", "megane",
}


def _strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )


def _clean_query_for_portal(query: str) -> str:
    """Reduce a natural-language query to portal-searchable keywords.

    Lowercases, strips accents and NL noise words, keeps brand/model tokens
    or words with >= 3 letters (max 4 tokens). Returns "" for generic
    price-only searches so callers skip the keyword param entirely.
    """
    if not query:
        return ""
    words = re.sub(r"[^\w\s]", " ", _strip_accents(query.lower())).split()
    meaningful = [w for w in words if w not in _PORTAL_NOISE and len(w) >= 3]
    brands = [w for w in meaningful if w in _KNOWN_MAKES_MODELS]
    kept = brands if brands else meaningful
    return " ".join(kept[:4])


def _build_portal_url(
    source: str, keywords: str, max_price: Optional[int]
) -> Optional[str]:
    """Build a portal search URL with real price filters.

    `keywords` is already cleaned; empty keywords means generic price-only
    search (no keyword param, avoids filtering everything to 0).
    Returns None for unknown sources.
    """
    q = quote_plus(keywords) if keywords else ""
    if source == "autoscout24":
        url = "https://www.autoscout24.es/lst?sort=standard&desc=0&ustate=new%2Cused"
        if q:
            url += f"&q={q}"
        if max_price is not None:
            url += f"&priceto={max_price}"
        return url
    if source == "coches_net":
        url = "https://www.coches.net/coches-de-ocasion/"
        params = []
        if q:
            params.append(f"Keywords={q}")
        if max_price is not None:
            params.append(f"MaxPrice={max_price}")
        if params:
            url += "?" + "&".join(params)
        return url
    if source == "wallapop":
        url = "https://es.wallapop.com/app/search?filters_source=search_box"
        if q:
            url += f"&keywords={q}"
        if max_price is not None:
            url += f"&max_price={max_price}"
        return url
    if source == "milanuncios":
        # Milanuncios motor search; in-memory max_price filter already applies.
        base = "https://www.milanuncios.com/coches-de-segunda-mano/"
        params = ["demanda=n"]
        if q:
            params.append(f"s={q}")
        if max_price is not None:
            params.append(f"precio-hasta={max_price}")
        return base + "?" + "&".join(params)
    return None

EXTRACT_LISTINGS_JS = """() => {
  const out = [];
  const seen = new Set();
  const cards = document.querySelectorAll(
    '[data-testid*=result],[class*=result],[class*=card],[class*=Card],[class*=item],[class*=Item],article,li'
  );
  const priceRe = /(\\d[\\d\\s\\.\\,]*\\s*€|€\\s*\\d[\\d\\s\\.\\,]*)/;
  for (const card of cards) {
    if (out.length >= 40) break;
    const links = card.querySelectorAll('a[href]');
    if (!links.length) continue;
    let best = null;
    let bestLen = 0;
    for (const a of links) {
      let href = '';
      try { href = new URL(a.getAttribute('href'), document.baseURI).href; }
      catch (e) { continue; }
      if (!href.startsWith('http') || seen.has(href)) continue;
      if (href.length > bestLen) { best = href; bestLen = href.length; }
    }
    if (!best) continue;
    const cardText = (card.innerText || '').replace(/\\s+/g, ' ').trim();
    if (cardText.length < 12) continue;
    const titleEl = card.querySelector('h2,h3,h1,p');
    const titleText = titleEl ? (titleEl.innerText || '').replace(/\\s+/g, ' ').trim() : '';
    const title = (titleText.length >= 8 ? titleText : cardText).slice(0, 160);
    const priceMatch = cardText.match(priceRe);
    const price = priceMatch ? priceMatch[0].slice(0, 32) : null;
    let imageUrl = null;
    const imgs = card.querySelectorAll('img');
    for (const img of imgs) {
      const src = img.currentSrc || img.src || '';
      if (!src.startsWith('http')) continue;
      const low = src.toLowerCase();
      if (low.includes('logo') || low.includes('icon') || low.endsWith('.svg')) continue;
      imageUrl = src;
      break;
    }
    out.push({ title: title, url: best, image_url: imageUrl, price: price });
    seen.add(best);
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

PRICE_RE = re.compile(r"(\d[\d\.\,]*)\s*€")


def _parse_price(text: Optional[str]) -> Optional[int]:
    match = PRICE_RE.search(text or "")
    if not match:
        return None
    raw = match.group(1).replace(".", "").replace(",", ".")
    try:
        return int(float(raw))
    except ValueError:
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
    query: str
    max_price: Optional[int] = None
    min_price: Optional[int] = None
    sources: Optional[List[str]] = ["coches_net", "autoscout24", "wallapop"]


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
) -> List[CarItem]:
    """Scrapes one portal. Returns real listings only; empty list on any failure."""
    if not _pool_active():
        logger.warning("[BrowserWorker] Chromium pool unavailable; skipping source '%s'.", source)
        return []
    keywords = _clean_query_for_portal(query)
    url = _build_portal_url(source, keywords, max_price)
    if not url:
        logger.warning("[BrowserWorker] Unknown source '%s'; skipping.", source)
        return []

    async with _pool_semaphore:
        context = None
        try:
            context, page = await _new_page()
            try:
                try:
                    await page.goto(url, wait_until="networkidle", timeout=NAV_TIMEOUT_MS)
                except Exception:
                    await page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
                await page.wait_for_timeout(2500)
            except Exception as nav_err:
                logger.warning(f"[BrowserWorker] Navigation failed for '{source}': {nav_err}")
                return []

            await _dismiss_cookie_banner(page)
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
    logger.info(f"[BrowserWorker] Searching query='{req.query}' max_price={req.max_price} min_price={req.min_price}")
    sources = req.sources or []
    if not sources:
        return []
    per_source = await asyncio.gather(
        *[_scrape_source(source, req.query, req.max_price, req.min_price) for source in sources]
    )
    results: List[CarItem] = [item for group in per_source for item in group]
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
