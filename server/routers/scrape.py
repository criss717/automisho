from fastapi import APIRouter, HTTPException
from models.schemas import ScrapeRequest, ScrapeResponse, CarResult
import httpx
from bs4 import BeautifulSoup
import re
import logging

logger = logging.getLogger("scrape")
router = APIRouter(prefix="/scrape", tags=["scraping"])

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate",
}


@router.post("", response_model=ScrapeResponse)
async def scrape_cars(req: ScrapeRequest):
    """Scrape car listings from the selected source."""
    results = []

    if req.source == "auto":
        for source in ["autoscout24", "cochesnet", "wallapop"]:
            try:
                partial = await _scrape_source(source, req)
                logger.info(f"[{source}] returned {len(partial)} results")
                results.extend(partial)
            except Exception as e:
                logger.error(f"[{source}] FAILED: {type(e).__name__}: {e}")
                continue
        results = results[: req.max_results]
    else:
        results = await _scrape_source(req.source, req)

    return ScrapeResponse(
        results=results,
        source=req.source,
        query=req.query,
        total=len(results),
    )


async def _scrape_source(source: str, req: ScrapeRequest) -> list[CarResult]:
    if source == "autoscout24":
        return await _scrape_autoscout24(req)
    elif source == "cochesnet":
        return await _scrape_cochesnet(req)
    elif source == "wallapop":
        return await _scrape_wallapop(req)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported source: {source}")


def _parse_price(text: str) -> int | None:
    """Extract numeric price from text like '€ 15.750' or '15.900 €'."""
    if not text:
        return None
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None


async def _scrape_autoscout24(req: ScrapeRequest) -> list[CarResult]:
    """Scrape AutoScout24 Spain. Verified selectors 2026-08."""
    query_parts = req.query.lower().split()
    # Extract make/model from query, skip noise words
    noise = {"coches", "coche", "por", "de", "del", "un", "una", "el", "la", "los", "las",
             "menos", "más", "que", "euros", "€", "euro", "diesel", "diésel", "gasolina",
             "segunda", "mano", "hay", "buenos", "bueno", "baratos", "barato"}
    clean_parts = [p for p in query_parts if p not in noise and not p.isdigit()]
    
    if len(clean_parts) >= 2:
        url = f"https://www.autoscout24.es/lst/{clean_parts[0]}/{clean_parts[1]}"
    elif len(clean_parts) == 1:
        url = f"https://www.autoscout24.es/lst/{clean_parts[0]}"
    else:
        url = "https://www.autoscout24.es/lst"

    params = {"atype": "C", "cy": "E", "desc": "0", "sort": "standard"}
    if req.max_price:
        params["priceto"] = str(req.max_price)

    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=20) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.error(f"AutoScout24 HTTP error: {e}")
            return []

        soup = BeautifulSoup(resp.text, "lxml")
        results = []

        items = soup.select(".cldt-summary-full-item")
        logger.info(f"AutoScout24: found {len(items)} items")

        for item in items[: req.max_results]:
            title_el = item.select_one("span[class*='ListItemTitle_title']")
            title = title_el.get_text(strip=True) if title_el else "Sin título"

            price_el = item.select_one("[data-testid='regular-price']")
            price = _parse_price(price_el.get_text(strip=True)) if price_el else None

            link_el = item.select_one("a[class*='ListItemTitle_anchor']")
            link = ""
            if link_el and link_el.get("href"):
                href = link_el["href"]
                link = f"https://www.autoscout24.es{href}" if not href.startswith("http") else href

            details = item.select("[class*='vehicleDetails'] span")
            km, year, fuel = None, None, None
            for span in details:
                text = span.get_text(strip=True)
                if "km" in text.lower():
                    km = int(re.sub(r"[^\d]", "", text)) if re.search(r"\d", text) else None
                elif re.match(r"^(19|20)\d{2}$", text):
                    year = int(text)
                elif text.lower() in ("gasolina", "diésel", "diesel", "eléctrico", "híbrido"):
                    fuel = text

            results.append(CarResult(
                title=title, price=price, year=year, km=km, fuel=fuel,
                url=link, source="autoscout24",
            ))

        return results


async def _scrape_cochesnet(req: ScrapeRequest) -> list[CarResult]:
    """Scrape coches.net. Verified selectors 2026-08."""
    url = "https://www.coches.net/segunda-mano/"

    # Clean query for coches.net — extract make/model
    query = req.query.lower()
    noise = {"coches", "coche", "por", "de", "del", "un", "una", "el", "la", "los", "las",
             "menos", "más", "que", "euros", "€", "euro", "diesel", "diésel", "gasolina",
             "segunda", "mano", "hay", "buenos", "bueno", "baratos", "barato",
             "2000", "2500", "3000", "5000", "10000", "15000", "20000"}
    clean_query = " ".join(w for w in query.split() if w not in noise and not w.isdigit())
    if not clean_query:
        clean_query = req.query

    params = {"Keywords": clean_query}
    if req.min_price:
        params["MinPrice"] = str(req.min_price)
    if req.max_price:
        params["MaxPrice"] = str(req.max_price)

    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=20) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.error(f"coches.net HTTP error: {e}")
            return []

        soup = BeautifulSoup(resp.text, "lxml")
        results = []

        items = soup.select(".mt-CardAd")
        logger.info(f"coches.net: found {len(items)} items")

        for item in items[: req.max_results]:
            title_el = item.select_one(".mt-CardAd-infoHeaderTitleLink")
            title = title_el.get_text(strip=True) if title_el else "Sin título"

            price_el = item.select_one("[data-testid='card-adPrice-price']")
            price = _parse_price(price_el.get_text(strip=True)) if price_el else None

            link = ""
            if title_el and title_el.get("href"):
                href = title_el["href"]
                link = f"https://www.coches.net{href}" if not href.startswith("http") else href

            attrs = item.select(".mt-CardAd-attrItem")
            km, year, fuel = None, None, None
            for attr in attrs:
                text = attr.get_text(strip=True)
                if "km" in text.lower():
                    km = int(re.sub(r"[^\d]", "", text)) if re.search(r"\d", text) else None
                elif re.match(r"^(19|20)\d{2}$", text):
                    year = int(text)
                elif text.lower() in ("gasolina", "diésel", "diesel", "eléctrico", "híbrido", "electrico"):
                    fuel = text

            results.append(CarResult(
                title=title, price=price, year=year, km=km, fuel=fuel,
                url=link, source="coches.net",
            ))

        return results


async def _scrape_wallapop(req: ScrapeRequest) -> list[CarResult]:
    """Scrape Wallapop using their public search page (no API key needed)."""
    url = "https://es.wallapop.com/app/search"

    params = {
        "keywords": req.query,
        "category_ids": "100",  # Cars
        "latitude": "40.4168",
        "longitude": "-3.7038",
        "order_by": "newest",
    }
    if req.max_price:
        params["max_sale_price"] = str(req.max_price)
    if req.min_price:
        params["min_sale_price"] = str(req.min_price)

    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=20) as client:
        try:
            # Wallapop renders with JS, but the SSR page has initial data
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.error(f"Wallapop HTTP error: {e}")
            return []

        soup = BeautifulSoup(resp.text, "lxml")
        results = []

        # Wallapop SSR uses data embedded in script tags
        # Try to find __NEXT_DATA__ or similar
        script_tags = soup.select("script[id='__NEXT_DATA__']")
        if script_tags:
            import json
            try:
                data = json.loads(script_tags[0].string)
                items = data.get("props", {}).get("pageProps", {}).get("items", [])
                for item in items[: req.max_results]:
                    results.append(CarResult(
                        title=item.get("title", "Sin título"),
                        price=item.get("price"),
                        year=item.get("year"),
                        km=item.get("km"),
                        fuel=item.get("fuel"),
                        location=item.get("location", {}).get("city", ""),
                        url=f"https://es.wallapop.com/item/{item.get('web_slug', '')}",
                        image_url=item.get("images", [{}])[0].get("original") if item.get("images") else None,
                        source="wallapop",
                    ))
            except (json.JSONDecodeError, KeyError) as e:
                logger.error(f"Wallapop JSON parse error: {e}")
        else:
            # Fallback: try to parse HTML directly
            cards = soup.select("[class*='ItemCard'], [class*='card-item']")
            logger.info(f"Wallapop HTML fallback: {len(cards)} cards")
            for card in cards[: req.max_results]:
                title_el = card.select_one("[class*='title'], h3, h2")
                price_el = card.select_one("[class*='price']")
                link_el = card.select_one("a[href]")
                results.append(CarResult(
                    title=title_el.get_text(strip=True) if title_el else "Sin título",
                    price=_parse_price(price_el.get_text(strip=True)) if price_el else None,
                    url=link_el["href"] if link_el and link_el.get("href") else "",
                    source="wallapop",
                ))

        return results
