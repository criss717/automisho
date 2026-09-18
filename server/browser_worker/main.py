from contextlib import asynccontextmanager
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
from urllib.parse import quote_plus
import asyncio
import logging
import os
import re

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

SOURCE_URLS = {
    "coches_net": "https://www.coches.net/coches-de-ocasion/?q={query}",
    "autoscout24": "https://www.autoscout24.es/lst?sort=standard&desc=0&ustate=new%2Cused&q={query}",
    "wallapop": "https://es.wallapop.com/app/search?keywords={query}&filters_source=search_box",
}

EXTRACT_LISTINGS_JS = """() => {
  const out = [];
  const seen = new Set();
  const anchors = document.querySelectorAll('a[href]');
  for (const a of anchors) {
    let href = '';
    try { href = new URL(a.getAttribute('href'), document.baseURI).href; }
    catch (e) { continue; }
    if (!href.startsWith('http') || seen.has(href)) continue;
    const text = (a.innerText || '').replace(/\\s+/g, ' ').trim();
    if (text.length < 12 || text.indexOf('€') === -1) continue;
    const img = a.querySelector('img');
    out.push({
      title: text.slice(0, 160),
      url: href,
      image_url: img ? (img.currentSrc || img.src || null) : null,
    });
    seen.add(href);
    if (out.length >= 40) break;
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


async def _scrape_source(source: str, query: str, max_price: Optional[int]) -> List[CarItem]:
    """Scrapes one portal. Returns real listings only; empty list on any failure."""
    if not _pool_active():
        logger.warning("[BrowserWorker] Chromium pool unavailable; skipping source '%s'.", source)
        return []
    template = SOURCE_URLS.get(source)
    if not template:
        logger.warning("[BrowserWorker] Unknown source '%s'.", source)
        return []

    async with _pool_semaphore:
        context = None
        try:
            context, page = await _new_page()
            try:
                await page.goto(
                    template.format(query=quote_plus(query)),
                    wait_until="domcontentloaded",
                    timeout=NAV_TIMEOUT_MS,
                )
                await page.wait_for_timeout(1500)
            except Exception as nav_err:
                logger.warning(f"[BrowserWorker] Navigation failed for '{source}': {nav_err}")
                return []

            try:
                raw_entries = await page.evaluate(EXTRACT_LISTINGS_JS)
            except Exception as eval_err:
                logger.warning(f"[BrowserWorker] DOM extraction failed for '{source}': {eval_err}")
                return []

            items: List[CarItem] = []
            for entry in raw_entries or []:
                price = _parse_price(entry.get("title", ""))
                if price is None:
                    continue
                if max_price is not None and price > max_price:
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
            logger.info(f"[BrowserWorker] Source '{source}' returned {len(items)} real listings.")
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
    logger.info(f"[BrowserWorker] Searching query='{req.query}' max_price={req.max_price}")
    sources = req.sources or []
    if not sources:
        return []
    per_source = await asyncio.gather(
        *[_scrape_source(source, req.query, req.max_price) for source in sources]
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
