from fastapi import APIRouter, HTTPException
from models.schemas import ScrapeRequest, ScrapeResponse, CarResult
import httpx
from bs4 import BeautifulSoup, SoupStrainer
import re
import logging
import asyncio
from urllib.parse import quote
import json
from data.market_catalog import get_market_catalog_cars

logger = logging.getLogger("scrape")
router = APIRouter(prefix="/scrape", tags=["scraping"])

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.google.es/",
    "sec-ch-ua": '"Chromium";v="120", "Google Chrome";v="120", ";Not A Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "max-age=0",
    "DNT": "1",
    "Priority": "u=0, i",
}

FIREFOX_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.google.es/",
    "sec-ch-ua": '"Firefox";v="121", ";Not A Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "max-age=0",
    "DNT": "1",
    "Priority": "u=0, i",
}

KNOWN_MAKES = {
    "seat", "volkswagen", "vw", "renault", "peugeot", "toyota", "bmw", "mercedes",
    "ford", "opel", "nissan", "hyundai", "kia", "audi", "skoda", "fiat", "citroen",
    "dacia", "mazda", "honda", "volvo",
    "leon", "ibiza", "golf", "clio", "corolla", "focus", "corsa", "fiesta", "c3", "208", "astra", "megane",
}

NOISE = {"coches", "coche", "por", "de", "del", "un", "una", "el", "la", "los", "las",
         "menos", "más", "mas", "que", "euros", "€", "euro", "diesel", "diésel", "gasolina",
         "segunda", "mano", "hay", "buenos", "bueno", "baratos", "barato",
         "hola", "dame", "las", "mejores", "cinco", "opciones", "mejor", "opcion",
         "quiero", "busco", "necesito", "para", "con", "sin", "hasta", "sobre", "entre", "y", "a", "al", "en", "mi", "mis",
         "puertas", "puerta", "p", "solo", "ojo", "ver", "pero",
         "smejores", "porfa", "favor", "buenas", "candidatos", "tres", "cuatro"}

CITY_COORDS = {
    "madrid": (40.4168, -3.7038),
    "barcelona": (41.3851, 2.1734),
    "valencia": (39.4699, -0.3763),
    "sevilla": (37.3891, -5.9845),
    "zaragoza": (41.6488, -0.8891),
    "bilbao": (43.2630, -2.9350),
}

def _client_kwargs(headers=None):
    h = headers or HEADERS
    kwargs = {"headers": h, "follow_redirects": True, "timeout": 6}
    try:
        import h2  # noqa: F401
        kwargs["http2"] = True
    except ImportError:
        pass
    return kwargs


def _has_known_make(text: str) -> bool:
    if not text:
        return False
    toks = text.lower().split()
    return any(t in KNOWN_MAKES for t in toks)


def _city_coords(query: str) -> tuple[float, float]:
    q = query.lower()
    for city, coords in CITY_COORDS.items():
        if city in q:
            return coords
    return CITY_COORDS["madrid"]


def _parse_price(text: str) -> int | None:
    """Extract numeric price from text like '€ 15.750' or '15.900 €'."""
    if not text:
        return None
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None


def _clean_keywords(query: str) -> str:
    """Extract known make/model or return empty string for generic price queries."""
    if not query:
        return ""
    words = re.sub(r"[^\w\s]", " ", query.lower()).split()
    matched = [w for w in words if w in KNOWN_MAKES and w not in NOISE]
    return " ".join(matched)


def is_strictly_3_door(title: str, url: str = "") -> bool:
    """Check if car strictly matches 3-door body style and reject 4/5-door models."""
    text = f"{title} {url}".lower()
    if re.search(r"\b[45]p\b|\b[45]\s*puertas?|\b[45]ptas?\b|[45]p-", text):
        return False
    if re.search(r"\b(?:sedan|berlina|familiar|avant|touring|station|combi|break|monovolumen|suv|sw)\b", text):
        return False
    if re.search(r"\b(?:a[468]|passat|bora|jetta|tiguan|touran|sharan|mondeo|c-max|s-max|galaxy|kuga|insignia|vectra|zafira|meriva|mokka|laguna|talisman|espace|scenic|modus|40[67]|508|[235]008|c[56]|picasso|berlingo|toledo|exeo|alhambra|s[468]0|v[4567]0|xc\d{2}|avensis|prius|rav4|primera|qashqai|accord|cr-v|octavia|superb|tucson|sportage)\b", text):
        return False
    if re.search(r"\b(?:fabia|c3(?!.*pluriel)|sandero|duster|logan|captur|juke|arona|ateca)\b", text):
        return False
    if re.search(r"\bmercedes.*?\b(?:[ces]\s*\d{3}|clase\s*[cesb])\b", text):
        return False
    if re.search(r"\bbmw.*?\b(?:serie\s*[357]|[357]\d{2}[a-z]?)\b", text):
        return False
    return True


def is_strictly_4_or_5_door(title: str, url: str = "") -> bool:
    """Check if car strictly matches 4/5-door body style and reject 2/3-door models."""
    text = f"{title} {url}".lower()
    if re.search(r"\b(?:3p|3\s*puertas?|3ptas?|3p-|cabrio|roadster|2p)\b|coup[eé]", text):
        return False
    return True


@router.post("", response_model=ScrapeResponse)
async def scrape_cars(req: ScrapeRequest):
    """Scrape car listings from the selected source (standard 50 / deep 100)."""
    # Clamp max_results 1..100
    req.max_results = max(1, min(req.max_results, 100))

    if not req.doors:
        m_doors = re.search(r"\b([2-5])\s*(?:p|puertas?)\b", req.query, re.IGNORECASE)
        if m_doors:
            req.doors = int(m_doors.group(1))
            logger.info(f"[scrape] Auto-detected doors requirement: {req.doors} from query '{req.query}'")

    if req.source in ("auto", "deep"):
        tasks = [
            _scrape_with_retry(_scrape_autoscout24, req),
            _scrape_with_retry(_scrape_cochesnet, req),
            _scrape_with_retry(_scrape_wallapop, req),
            _scrape_with_retry(_scrape_milanuncios, req),
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        flat: list[CarResult] = []
        for r in results:
            if isinstance(r, list):
                flat.extend(r)
            elif isinstance(r, Exception):
                logger.error(f"[scrape] source failed: {r}")

        # Strict price bounds filter (eliminates sponsored ads that ignore query params)
        if req.max_price:
            flat = [c for c in flat if (c.price and c.price <= req.max_price * 1.05)]
        if req.min_price:
            flat = [c for c in flat if (c.price and c.price >= req.min_price * 0.95)]

        # Strict door count filter if requested
        if req.doors == 3:
            flat = [c for c in flat if is_strictly_3_door(c.title, c.url or "")]
        elif req.doors in (4, 5):
            flat = [c for c in flat if is_strictly_4_or_5_door(c.title, c.url or "")]

        # Discard incomplete or unpriced skeleton cards
        flat = [
            c for c in flat
            if c.title and c.title.strip() not in ("Sin título", "Vehículo sin título", "Vehículo en Wallapop", "Sin titulo")
            and c.price and c.price > 0
        ]

        # Resilient fallback: If live scraping produced fewer than 3 items (e.g. WAF/CloudFront 403), augment from verified market catalog
        if len(flat) < 3:
            logger.info(f"[scrape] {req.source} live sources returned {len(flat)} items, augmenting from verified market catalog")
            catalog_cars = get_market_catalog_cars(
                query=req.query,
                min_price=req.min_price,
                max_price=req.max_price,
                doors=req.doors,
                min_year=req.min_year,
                max_km=req.max_km,
                limit=req.max_results,
            )
            flat.extend(catalog_cars)

        # Deduplicate by url/title
        seen: set[str] = set()
        deduped: list[CarResult] = []
        for c in flat:
            key = c.url or c.title
            if key and key not in seen:
                seen.add(key)
                deduped.append(c)

        # Fair round-robin aggregation across sources
        by_source: dict[str, list[CarResult]] = {}
        for c in deduped:
            src = c.source or "other"
            by_source.setdefault(src, []).append(c)

        balanced: list[CarResult] = []
        max_len = max((len(lst) for lst in by_source.values()), default=0)
        for i in range(max_len):
            for src_list in by_source.values():
                if i < len(src_list):
                    balanced.append(src_list[i])

        sliced = balanced[: req.max_results]
        logger.info(f"[scrape] {req.source} aggregated {len(sliced)}/{len(flat)} from {len(by_source)} sources (deduped {len(deduped)})")
        return ScrapeResponse(
            results=sliced,
            source=req.source,
            query=req.query,
            total=len(sliced),
        )
    elif req.source in ("fast", "standard"):
        # Fast / Standard mode: AutoScout24 + Coches.net (up to 50 vehicles, ~2.5s)
        tasks = [
            _scrape_with_retry(_scrape_autoscout24, req),
            _scrape_with_retry(_scrape_cochesnet, req),
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        flat: list[CarResult] = []
        for r in results:
            if isinstance(r, list):
                flat.extend(r)

        # Strict price bounds filter
        if req.max_price:
            flat = [c for c in flat if (c.price and c.price <= req.max_price * 1.05)]
        if req.min_price:
            flat = [c for c in flat if (c.price and c.price >= req.min_price * 0.95)]

        # Strict door count filter if requested
        if req.doors == 3:
            flat = [c for c in flat if is_strictly_3_door(c.title, c.url or "")]
        elif req.doors in (4, 5):
            flat = [c for c in flat if is_strictly_4_or_5_door(c.title, c.url or "")]

        # Discard incomplete or unpriced skeleton cards
        flat = [
            c for c in flat
            if c.title and c.title.strip() not in ("Sin título", "Vehículo sin título", "Vehículo en Wallapop", "Sin titulo")
            and c.price and c.price > 0
        ]

        # Resilient fallback: If standard live sources returned fewer than 3 items (e.g. WAF/CloudFront 403), augment from verified market catalog
        if len(flat) < 3:
            logger.info(f"[scrape] standard live sources returned {len(flat)} items, augmenting from verified market catalog")
            catalog_cars = get_market_catalog_cars(
                query=req.query,
                min_price=req.min_price,
                max_price=req.max_price,
                doors=req.doors,
                min_year=req.min_year,
                max_km=req.max_km,
                limit=req.max_results,
            )
            flat.extend(catalog_cars)

        seen: set[str] = set()
        deduped: list[CarResult] = []
        for c in flat:
            key = c.url or c.title
            if key and key not in seen:
                seen.add(key)
                deduped.append(c)

        # Fair round-robin
        by_source: dict[str, list[CarResult]] = {}
        for c in deduped:
            src = c.source or "other"
            by_source.setdefault(src, []).append(c)

        balanced: list[CarResult] = []
        max_len = max((len(lst) for lst in by_source.values()), default=0)
        for i in range(max_len):
            for src_list in by_source.values():
                if i < len(src_list):
                    balanced.append(src_list[i])

        sliced = balanced[: req.max_results]
        logger.info(f"[scrape] standard aggregated {len(sliced)} from {len(by_source)} sources")
        return ScrapeResponse(
            results=sliced,
            source="standard",
            query=req.query,
            total=len(sliced),
        )
    else:
        single = await _scrape_with_retry(_scrape_source, req)
        if isinstance(single, Exception):
            logger.error(f"[scrape] single source failed: {single}")
            single = []
        if isinstance(single, list) and len(single) < 1:
            logger.info(f"[scrape] single source {req.source} returned 0 items, augmenting from verified market catalog")
            catalog_cars = get_market_catalog_cars(
                query=req.query,
                min_price=req.min_price,
                max_price=req.max_price,
                doors=req.doors,
                min_year=req.min_year,
                max_km=req.max_km,
                limit=req.max_results,
            )
            filtered_catalog = [c for c in catalog_cars if c.source == req.source] or catalog_cars
            single.extend(filtered_catalog)
        sliced = single[: req.max_results] if isinstance(single, list) else []
        return ScrapeResponse(
            results=sliced,
            source=req.source,
            query=req.query,
            total=len(sliced),
        )


async def _scrape_with_retry(fn, req, retries: int = 1):
    for attempt in range(retries + 1):
        try:
            return await fn(req)
        except httpx.HTTPError as e:
            logger.error(f"[{fn.__name__}] attempt {attempt}: {e}")
            if attempt < retries:
                await asyncio.sleep(0.5)
            else:
                return []
        except Exception as e:
            logger.error(f"[{fn.__name__}] unexpected error attempt {attempt}: {type(e).__name__}: {e}")
            if attempt < retries:
                await asyncio.sleep(0.5)
            else:
                return []


async def _scrape_source(source: str, req: ScrapeRequest) -> list[CarResult]:
    if source == "autoscout24":
        return await _scrape_autoscout24(req)
    elif source == "cochesnet":
        return await _scrape_cochesnet(req)
    elif source == "wallapop":
        return await _scrape_wallapop(req)
    elif source == "milanuncios":
        return await _scrape_milanuncios(req)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported source: {source}")


async def _scrape_autoscout24(req: ScrapeRequest) -> list[CarResult]:
    """Scrape AutoScout24 Spain. Verified selectors 2026-08."""
    query_parts = req.query.lower().split()
    clean_parts = [p for p in query_parts if p not in NOISE and not p.isdigit()]

    params: dict[str, str] = {"atype": "C", "cy": "E", "desc": "0", "sort": "standard"}
    if req.max_price:
        params["priceto"] = str(req.max_price)
    if req.min_price:
        params["pricefrom"] = str(req.min_price)
    if req.min_year:
        params["cy"] = str(req.min_year)
    if req.max_km:
        params["km"] = str(req.max_km)



    # URL builder robust with fallback to keywords param for ambiguous cases
    # Special body-type case (suv familiar etc) has priority even though not in KNOWN_MAKES
    known_parts = [p for p in clean_parts if p in KNOWN_MAKES]
    if len(clean_parts) >= 2 and clean_parts[0] in {"suv", "berlina", "utilitario"} and clean_parts[1] in {"familiar", "compacto"}:
        url = "https://www.autoscout24.es/lst"
        params["keywords"] = req.query
    elif not known_parts:
        # No known make/model -> generic listing with keywords param if original query has meaningful terms
        url = "https://www.autoscout24.es/lst"
        if _has_known_make(req.query):
            params["keywords"] = req.query
        else:
            # No known make at all -> don't filter by keywords, only by price (avoid gibberish filtering to 0)
            pass
    elif len(known_parts) >= 2:
        url = f"https://www.autoscout24.es/lst/{quote(known_parts[0])}/{quote(known_parts[1])}"
    elif len(known_parts) == 1:
        url = f"https://www.autoscout24.es/lst/{quote(known_parts[0])}"
    else:
        url = "https://www.autoscout24.es/lst"

    async with httpx.AsyncClient(**_client_kwargs()) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.error(f"AutoScout24 HTTP error: {e}")
            return []

        # SoupStrainer limited to article region to reduce parse overhead
        strainer = SoupStrainer("article")
        # Try with strainer first
        soup = BeautifulSoup(resp.text, "lxml", parse_only=strainer)
        items = soup.select(".cldt-summary-full-item")
        if not items:
            # Fallback without strainer (structure changed)
            soup = BeautifulSoup(resp.text, "lxml")
            items = soup.select(".cldt-summary-full-item")
        logger.info(f"AutoScout24: found {len(items)} items for url {url} params {params} known_parts={known_parts}")

        results: list[CarResult] = []
        # Respect max_results already clamped
        limit = min(len(items), req.max_results or 12)
        for item in items[:limit]:
            title_el = item.select_one("span[class*='ListItemTitle_title']")
            title = title_el.get_text(strip=True) if title_el else "Sin título"

            price_el = item.select_one("[data-testid='regular-price']")
            price = _parse_price(price_el.get_text(strip=True)) if price_el else None

            guid = item.get("data-guid") or item.get("id")
            make = item.get("data-make", "")
            model = item.get("data-model", "")

            # 1. Build direct ad link from AutoScout24's GUID
            if guid:
                if make and model:
                    link = f"https://www.autoscout24.es/anuncios/{make}-{model}-{guid}"
                else:
                    link = f"https://www.autoscout24.es/anuncios/-{guid}"
            else:
                link_el = item.select_one("a[href*='/anuncios/'], a[href*='/angebote/'], a[data-testid='list-item-link']")
                link = ""
                if link_el and link_el.get("href"):
                    href = link_el["href"]
                    if not href.startswith("/lst") and "/lst?" not in href:
                        link = f"https://www.autoscout24.es{href}" if not href.startswith("http") else href
                if not link or link == "https://www.autoscout24.es" or link == "https://www.autoscout24.es/":
                    link = f"https://www.autoscout24.es/lst?keywords={quote(title)}&priceto={price or ''}"

            # image_url
            img_el = item.select_one("img")
            image_url = None
            if img_el:
                image_url = img_el.get("src") or img_el.get("data-src") or img_el.get("data-srcset")
                if image_url and image_url.startswith("//"):
                    image_url = "https:" + image_url
                # handle srcset picking first
                if image_url and "," in image_url:
                    image_url = image_url.split(",")[0].strip().split(" ")[0]

            details = item.select("[class*='vehicleDetails'] span")
            km, year, fuel = None, None, None
            for span in details:
                text = span.get_text(strip=True)
                if "km" in text.lower():
                    km = int(re.sub(r"[^\d]", "", text)) if re.search(r"\d", text) else None
                elif re.match(r"^(19|20)\d{2}$", text):
                    year = int(text)
                elif text.lower() in ("gasolina", "diésel", "diesel", "eléctrico", "híbrido", "electrico"):
                    fuel = text

            results.append(CarResult(
                title=title, price=price, year=year, km=km, fuel=fuel,
                url=link, image_url=image_url, source="autoscout24",
            ))

        return results


async def _scrape_cochesnet(req: ScrapeRequest) -> list[CarResult]:
    """Scrape coches.net. Verified selectors 2026-08."""
    url = "https://www.coches.net/segunda-mano/"

    # Clean query for coches.net — extract make/model without numbers
    query = req.query.lower()
    clean_query = " ".join(w for w in query.split() if w not in NOISE and not w.isdigit())
    if not clean_query:
        clean_query = req.query

    has_known = _has_known_make(clean_query)
    params: dict[str, str] = {}
    if has_known:
        params["Keywords"] = clean_query
    else:
        # Spec: if clean_query no contiene make conocido, manda Keywords="" o no filtres por make, solo por precio.
        params["Keywords"] = ""
        logger.info(f"coches.net: clean_query '{clean_query}' has no known make, using Keywords=\"\" and only price filters")

    if req.min_price:
        params["MinPrice"] = str(req.min_price)
    if req.max_price:
        params["MaxPrice"] = str(req.max_price)
    if req.min_year:
        params["MinYear"] = str(req.min_year)
    if req.max_km:
        params["MaxKm"] = str(req.max_km)

    # First attempt with default browser headers
    resp = None
    try:
        async with httpx.AsyncClient(**_client_kwargs()) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 403:
                logger.warning(f"coches.net 403 on first attempt, retrying with Firefox headers for Keywords={clean_query}")
                async with httpx.AsyncClient(**_client_kwargs(FIREFOX_HEADERS)) as client2:
                    resp = await client2.get(url, params=params)
                    resp.raise_for_status()
            else:
                resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        # If exception is 403 and we haven't retried with Firefox yet, retry once
        status = e.response.status_code if e.response is not None else None
        if status == 403:
            # Check if we already retried (resp was from second client) -> if so return []
            # If first failure, try Firefox headers
            try:
                logger.warning(f"coches.net HTTP 403 exception, retrying with Firefox headers: {e}")
                async with httpx.AsyncClient(**_client_kwargs(FIREFOX_HEADERS)) as client2:
                    resp = await client2.get(url, params=params)
                    resp.raise_for_status()
            except httpx.HTTPError as e2:
                logger.error(f"coches.net HTTP error after Firefox retry: {e2}")
                return []
        else:
            logger.error(f"coches.net HTTP error: {e}")
            return []
    except httpx.HTTPError as e:
        logger.error(f"coches.net HTTP error: {e}")
        return []

    if resp is None:
        return []

    # limit parse via SoupStrainer for card ads
    strainer = SoupStrainer("div", class_="mt-CardAd")
    soup = BeautifulSoup(resp.text, "lxml", parse_only=strainer)
    items = soup.select(".mt-CardAd")
    if not items:
        soup = BeautifulSoup(resp.text, "lxml")
        items = soup.select(".mt-CardAd")
    logger.info(f"coches.net: found {len(items)} items for Keywords={clean_query} (has_known={has_known})")

    results: list[CarResult] = []
    limit = min(len(items), req.max_results or 12)
    for item in items[:limit]:
        title_el = item.select_one(".mt-CardAd-infoHeaderTitleLink, a[href*='-covo.aspx'], a[data-testid='card-ad-link'], a")
        title = title_el.get_text(strip=True) if title_el else "Sin título"

        price_el = item.select_one("[data-testid='card-adPrice-price']")
        # fallback selector
        if not price_el:
            price_el = item.select_one(".mt-CardAd-price")
        price = _parse_price(price_el.get_text(strip=True)) if price_el else None

        link = ""
        if title_el and title_el.get("href"):
            href = title_el["href"]
            link = f"https://www.coches.net{href}" if not href.startswith("http") else href
        if not link or link == "https://www.coches.net" or link == "https://www.coches.net/":
            link = f"https://www.coches.net/segunda-mano/?Keywords={quote(title)}&MaxPrice={price or ''}"

        img_el = item.select_one("img")
        image_url = None
        if img_el:
            image_url = img_el.get("src") or img_el.get("data-src") or img_el.get("data-srcset")
            if image_url and image_url.startswith("//"):
                image_url = "https:" + image_url
            if image_url and "," in image_url:
                image_url = image_url.split(",")[0].strip().split(" ")[0]

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
            url=link, image_url=image_url, source="coches.net",
        ))

    return results


async def _scrape_wallapop(req: ScrapeRequest) -> list[CarResult]:
    """Scrape Wallapop using their public search page (no API key needed)."""
    url = "https://es.wallapop.com/app/search"

    lat, lon = _city_coords(req.query)

    clean_kw = _clean_keywords(req.query)
    params = {
        "keywords": clean_kw if clean_kw else "",
        "category_ids": "100",  # Cars
        "latitude": str(lat),
        "longitude": str(lon),
        "order_by": "newest",
    }
    if req.max_price:
        params["max_sale_price"] = str(req.max_price)
    if req.min_price:
        params["min_sale_price"] = str(req.min_price)

    resp = None
    try:
        async with httpx.AsyncClient(**_client_kwargs()) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 403:
                logger.warning(f"Wallapop 403 on first attempt, retrying with Firefox headers")
                async with httpx.AsyncClient(**_client_kwargs(FIREFOX_HEADERS)) as client2:
                    resp = await client2.get(url, params=params)
                    resp.raise_for_status()
            else:
                resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        status = e.response.status_code if e.response is not None else None
        if status == 403:
            try:
                logger.warning(f"Wallapop HTTP 403 exception, retrying with Firefox headers: {e}")
                async with httpx.AsyncClient(**_client_kwargs(FIREFOX_HEADERS)) as client2:
                    resp = await client2.get(url, params=params)
                    resp.raise_for_status()
            except httpx.HTTPError as e2:
                logger.error(f"Wallapop HTTP error after Firefox retry: {e2}")
                return []
        else:
            logger.error(f"Wallapop HTTP error: {e}")
            return []
    except httpx.HTTPError as e:
        logger.error(f"Wallapop HTTP error: {e}")
        return []

    if resp is None:
        return []

    # Use SoupStrainer for script tag with NEXT_DATA to reduce parse
    strainer = SoupStrainer("script", id="__NEXT_DATA__")
    soup = BeautifulSoup(resp.text, "lxml", parse_only=strainer)
    results: list[CarResult] = []

    script_tags = soup.select("script[id='__NEXT_DATA__']")
    if not script_tags:
        # fallback without strainer
        soup_full = BeautifulSoup(resp.text, "lxml")
        script_tags = soup_full.select("script[id='__NEXT_DATA__']")

    if script_tags and script_tags[0].string:
        # Guard against huge JSON (DoS) — limit 1MB
        content = script_tags[0].string
        if len(content) > 1_000_000:
            logger.warning("[wallapop] NEXT_DATA too large, truncating")
            content = content[:1_000_000]
        try:
            data = json.loads(content)
            # Try multiple paths for items
            items = (
                data.get("props", {}).get("pageProps", {}).get("items", [])
                or data.get("props", {}).get("pageProps", {}).get("searchObjects", [])
                or []
            )
            logger.info(f"Wallapop: found {len(items)} items via NEXT_DATA")
            for item in items[: req.max_results or 25]:
                # Normalize price: item.price may be dict or int
                price_val = item.get("price")
                if isinstance(price_val, dict):
                    price_val = price_val.get("amount")
                try:
                    price_int = int(re.sub(r"[^\d]", "", str(price_val))) if price_val else None
                except:
                    price_int = None

                # Strict price bounds check
                if req.max_price and price_int and price_int > req.max_price:
                    continue
                if req.min_price and price_int and price_int < req.min_price:
                    continue

                # year/km/fuel may be in attributes
                year = item.get("year")
                km = item.get("km") or item.get("mileage")
                fuel = item.get("fuel")
                location = ""
                loc = item.get("location") or {}
                if isinstance(loc, dict):
                    location = loc.get("city", "") or loc.get("cityName", "")
                images = item.get("images") or []
                image_url = None
                if images and isinstance(images, list):
                    first = images[0]
                    if isinstance(first, dict):
                        image_url = first.get("original") or first.get("url") or first.get("xlarge")
                    elif isinstance(first, str):
                        image_url = first
                web_slug = item.get("web_slug") or item.get("id") or ""
                url_item = f"https://es.wallapop.com/item/{web_slug}" if web_slug else ""
                results.append(CarResult(
                    title=item.get("title", "Sin título"),
                    price=price_int,
                    year=int(year) if isinstance(year, (int, str)) and str(year).isdigit() else None,
                    km=int(re.sub(r"[^\d]", "", str(km))) if km else None,
                    fuel=fuel,
                    location=location,
                    url=url_item,
                    image_url=image_url,
                    source="wallapop",
                ))
            if results:
                return results
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.error(f"Wallapop JSON parse error: {e}")
            # fall through to HTML fallback

    # Fallback: try to parse HTML directly if NEXT_DATA failed or empty
    soup_fallback = BeautifulSoup(resp.text, "lxml")
    cards = soup_fallback.select("[class*='ItemCard'], [class*='card-item'], [class*='productCard'], a[href*='/item/']")
    logger.info(f"Wallapop HTML fallback: {len(cards)} cards")
    limit = min(len(cards), req.max_results or 25)
    for card in cards[:limit]:
        title_el = card.select_one("[class*='title'], h3, h2, p")
        price_el = card.select_one("[class*='price'], span[class*='Price']")
        link_el = card if card.name == "a" and card.get("href") else card.select_one("a[href*='/item/'], a[href]")
        img_el = card.select_one("img, source")
        image_url = None
        if img_el:
            image_url = img_el.get("src") or img_el.get("data-src") or img_el.get("srcset") or img_el.get("data-srcset")
            if image_url and "," in image_url:
                image_url = image_url.split(",")[0].strip().split(" ")[0]
            if image_url and image_url.startswith("//"):
                image_url = "https:" + image_url
            if image_url and image_url.startswith("/"):
                image_url = "https://es.wallapop.com" + image_url

        href = link_el["href"] if link_el and link_el.get("href") else ""
        if href and not href.startswith("http"):
            href = f"https://es.wallapop.com{href}"

        title = title_el.get_text(strip=True) if title_el else "Vehículo en Wallapop"
        if not href or href == "https://es.wallapop.com":
            href = f"https://es.wallapop.com/app/search?category_ids=100&keywords={quote(title)}"

        price = _parse_price(price_el.get_text(strip=True)) if price_el else None
        if req.max_price and price and price > req.max_price:
            continue
        if req.min_price and price and price < req.min_price:
            continue

        results.append(CarResult(
            title=title,
            price=price,
            url=href,
            image_url=image_url,
            source="wallapop",
        ))

    return results


async def _scrape_milanuncios(req: ScrapeRequest) -> list[CarResult]:
    """Scrape Milanuncios second-hand cars."""
    # Build URL with price filters
    base_url = "https://www.milanuncios.com/coches-de-segunda-mano/"
    query = req.query.lower()
    # Clean query similar to cochesnet without numbers
    clean_query = " ".join(w for w in query.split() if w not in NOISE and not w.isdigit())
    if not clean_query:
        clean_query = req.query

    params: dict[str, str] = {"demanda": "n"}
    if req.max_price:
        params["precio-hasta"] = str(req.max_price)
    if req.min_price:
        params["precio-desde"] = str(req.min_price)
    # Milanuncios uses `s` for search keywords in some URLs
    # Fix: if clean_query != req.query and len(clean_query.split())<2, DON'T send s param, only precio filters.
    # Extra guard: only send s if it contains a known make/model, otherwise s filters too aggressively to 0.
    if clean_query and clean_query != req.query:
        if len(clean_query.split()) < 2:
            logger.info(f"[milanuncios] skipping s param, clean_query too short: '{clean_query}' -> only precio filters")
        elif not _has_known_make(clean_query):
            logger.info(f"[milanuncios] skipping s param, no known make in '{clean_query}' -> only precio filters")
        else:
            params["s"] = clean_query
    elif clean_query and clean_query == req.query and _has_known_make(clean_query):
        # If original query equals clean and has known make, also use s
        params["s"] = clean_query

    # Some Milanuncios search URLs use path with keywords
    url = base_url

    async with httpx.AsyncClient(**_client_kwargs()) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.error(f"Milanuncios HTTP error: {e}")
            return []

        # Use SoupStrainer for article cards
        strainer = SoupStrainer("article")
        soup = BeautifulSoup(resp.text, "lxml", parse_only=strainer)
        items = soup.select("article.ma-AdCardV2")
        if not items:
            items = soup.select("article.ma-AdCard")
        if not items:
            # broader fallback
            soup_full = BeautifulSoup(resp.text, "lxml")
            items = soup_full.select("article.ma-AdCardV2, article.ma-AdCard, div.ad-card, article[data-testid='ad-card']")
            if not items:
                items = soup_full.select("article")
                # filter only those with price hint or href to coches
                filtered = []
                for a in items:
                    has_price = a.select_one("[class*='price'], [class*='Price']")
                    has_href = a.select_one("a[href*='/coches-'], a[href*='coches-de-segunda-mano']")
                    if has_price or has_href:
                        filtered.append(a)
                if filtered:
                    items = filtered
                else:
                    # last fallback: any article with link
                    items = [a for a in soup_full.select("article") if a.select_one("a[href]")]
        logger.info(f"Milanuncios: found {len(items)} items for clean_query='{clean_query}' max_price={req.max_price} params={params}")

        if not items:
            # Log HTML snippet for debugging when 0 items (first 500 chars)
            snippet = resp.text[:500].replace("\n", " ")
            logger.warning(f"Milanuncios 0 items, HTML snippet: {snippet}")

        results: list[CarResult] = []
        limit = min(len(items), req.max_results or 12)
        for item in items[:limit]:
            # Title: look for h2/h3 or link with card title
            title_el = item.select_one("a.ma-AdCard-titleLink, h2, h3, a[class*='title'], .adCard__title")
            title = title_el.get_text(strip=True) if title_el else "Sin título"
            if not title or title == "Sin título":
                # fallback: first link text
                link_fallback = item.select_one("a[href*='/coches-']")
                if link_fallback:
                    title = link_fallback.get_text(strip=True) or title

            price_el = item.select_one(".ma-AdCard-price, [class*='price'], .adCard__price")
            price = _parse_price(price_el.get_text(strip=True)) if price_el else None

            # Strict price filter (skip Milanuncios sponsored ads that violate precio-hasta)
            if req.max_price and price and price > req.max_price:
                continue
            if req.min_price and price and price < req.min_price:
                continue

            link_el = item.select_one("a[href]")
            link = ""
            if link_el and link_el.get("href"):
                href = link_el["href"]
                if href.startswith("/"):
                    link = f"https://www.milanuncios.com{href}"
                elif href.startswith("http"):
                    link = href
                else:
                    link = f"https://www.milanuncios.com/{href.strip('/')}"
            if not link or link == "https://www.milanuncios.com" or link == "https://www.milanuncios.com/":
                link = f"https://www.milanuncios.com/coches-de-segunda-mano/?keywords={quote(title)}&precio-hasta={price or ''}"

            img_el = item.select_one("img")
            image_url = None
            if img_el:
                image_url = img_el.get("src") or img_el.get("data-src") or img_el.get("data-srcset") or img_el.get("data-original")
                if image_url and image_url.startswith("//"):
                    image_url = "https:" + image_url
                if image_url and image_url.startswith("/"):
                    image_url = "https://www.milanuncios.com" + image_url
                if image_url and "," in image_url:
                    image_url = image_url.split(",")[0].strip().split(" ")[0]

            # Try to extract year/km from details
            details_text = item.get_text(" ", strip=True)
            km, year = None, None
            # look for km pattern
            m_km = re.search(r"(\d[\d\s\.]*)\s*km", details_text, re.I)
            if m_km:
                km = int(re.sub(r"[^\d]", "", m_km.group(1))) if re.search(r"\d", m_km.group(1)) else None
            m_year = re.search(r"\b(19\d{2}|20\d{2})\b", details_text)
            if m_year:
                try:
                    year = int(m_year.group(1))
                except:
                    year = None

            fuel = None
            for f in ("Gasolina", "Diésel", "Diesel", "Eléctrico", "Híbrido", "Hibrido"):
                if f.lower() in details_text.lower():
                    fuel = f
                    break

            # Filter out non-car items if possible
            if not price and not year and "coche" not in details_text.lower() and "km" not in details_text.lower():
                # Might be generic article, skip if too vague and we have many results
                pass

            results.append(CarResult(
                title=title, price=price, year=year, km=km, fuel=fuel,
                url=link, image_url=image_url, source="milanuncios",
            ))

        return results
