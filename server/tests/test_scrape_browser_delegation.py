import pytest
import httpx
from models.schemas import ScrapeRequest
from browser_worker.main import (
    _clean_query_for_portal,
    _price_in_bounds,
    _resolve_entry_price,
)
from routers.scrape import (
    _apply_post_filters,
    _map_sources_for_browser,
    _scrape_via_browser_worker,
)


class _FakeResp:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


def _make_fake_client(resp=None, exc=None):
    class _FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, *args, **kwargs):
            if exc is not None:
                raise exc
            return resp

    return _FakeClient


def test_map_sources_for_browser():
    assert _map_sources_for_browser("auto") == [
        "coches_net",
        "milanuncios",
        "wallapop",
        "autoscout24",
    ]
    assert _map_sources_for_browser("deep") == [
        "coches_net",
        "milanuncios",
        "wallapop",
        "autoscout24",
    ]
    assert _map_sources_for_browser("standard") == [
        "coches_net",
        "milanuncios",
        "wallapop",
        "autoscout24",
    ]
    assert _map_sources_for_browser("autoscout24") == ["autoscout24"]


@pytest.mark.asyncio
async def test_browser_worker_success_converts_items(monkeypatch):
    payload = [
        {
            "title": "SEAT Ibiza 1.4 3p 2500€",
            "price": 2500,
            "year": 2008,
            "km": 150000,
            "url": "https://example.com/a",
            "image_url": "https://example.com/a.jpg",
            "source": "coches_net",
        },
        {
            "title": "Ford Fiesta 1.2 5p 1500€",
            "price": 1500,
            "url": "https://example.com/b",
            "source": "autoscout24",
        },
    ]
    monkeypatch.setattr(
        httpx, "AsyncClient", _make_fake_client(_FakeResp(200, payload))
    )
    req = ScrapeRequest(query="ibiza", source="standard", max_results=10)
    results = await _scrape_via_browser_worker(req)
    assert results is not None
    assert len(results) == 2
    assert results[0].title == "SEAT Ibiza 1.4 3p 2500€"
    assert results[0].price == 2500
    assert results[0].source == "coches_net"


@pytest.mark.asyncio
async def test_browser_worker_empty_returns_none(monkeypatch):
    monkeypatch.setattr(httpx, "AsyncClient", _make_fake_client(_FakeResp(200, [])))
    req = ScrapeRequest(query="ibiza", source="standard", max_results=10)
    assert await _scrape_via_browser_worker(req) is None


@pytest.mark.asyncio
async def test_browser_worker_http_error_returns_none(monkeypatch):
    monkeypatch.setattr(
        httpx, "AsyncClient", _make_fake_client(_FakeResp(500, []))
    )
    req = ScrapeRequest(query="ibiza", source="standard", max_results=10)
    assert await _scrape_via_browser_worker(req) is None


@pytest.mark.asyncio
async def test_browser_worker_unreachable_returns_none(monkeypatch):
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        _make_fake_client(exc=httpx.ConnectError("refused")),
    )
    req = ScrapeRequest(query="ibiza", source="standard", max_results=10)
    assert await _scrape_via_browser_worker(req) is None


def test_apply_post_filters_price_and_dedup():
    from models.schemas import CarResult

    cars = [
        CarResult(title="SEAT Ibiza 3p", price=2500, url="https://a", source="coches_net"),
        CarResult(title="SEAT Ibiza 3p dup", price=2500, url="https://a", source="autoscout24"),
        CarResult(title="Audi A4", price=9000, url="https://b", source="coches_net"),
    ]
    req = ScrapeRequest(query="ibiza", source="standard", max_results=10, max_price=3000)
    out = _apply_post_filters(cars, req)
    assert len(out) == 1
    assert out[0].url == "https://a"


def test_clean_query_for_portal_strips_nl_noise():
    # Generic NL query with no brand/model -> empty (price-only search).
    assert _clean_query_for_portal("hola dame los 5 mejores coches de 3 puertas gasolina") == ""
    assert _clean_query_for_portal("coche 3 puertas gasolina") == ""
    # Brand/model tokens survive the cleaning.
    assert _clean_query_for_portal("busco seat ibiza barato menos 3000 euros") == "seat ibiza"
    # Negated brands are never returned as search keywords
    q_neg = "las 6 mejores opciones de menos de 3000€ que no sean de la marca opel ni pegout ni chevrolet"
    assert _clean_query_for_portal(q_neg) == ""
    assert _clean_query_for_portal("coche viajes largos diesel 90cv") == ""
    # Explicit makes honored when not excluded
    assert _clean_query_for_portal("", makes=["seat", "ford"], excluded_makes=["opel"]) == "seat"
    assert _clean_query_for_portal("", makes=["opel", "renault"], excluded_makes=["opel"]) == "renault"


def test_apply_post_filters_purges_excluded_makes():
    from models.schemas import CarResult, ScrapeRequest

    cars = [
        CarResult(title="Opel Astra 1.6", price=2000, url="https://opel", source="coches_net"),
        CarResult(title="Peugeot 207 1.4", price=2200, url="https://peugeot", source="coches_net"),
        CarResult(title="SEAT León 1.9 TDI", price=2500, url="https://seat", source="coches_net"),
    ]
    req = ScrapeRequest(
        query="coches baratos que no sean de la marca opel ni pegout",
        source="standard",
        max_results=10,
        max_price=3000,
        excluded_makes=["opel", "peugeot"],
    )
    out = _apply_post_filters(cars, req)
    assert len(out) == 1
    assert out[0].title == "SEAT León 1.9 TDI"


def test_resolve_entry_price_prefers_direct_price():
    # Direct int price accepted without parsing the title.
    assert _resolve_entry_price({"title": "no price here", "price": 2500}) == 2500
    # Direct price as raw string is parsed.
    assert _resolve_entry_price({"title": "x", "price": "2.500 €"}) == 2500
    # Falls back to title parsing when no direct price.
    assert _resolve_entry_price({"title": "SEAT Ibiza 1.4 1500€"}) == 1500
    assert _resolve_entry_price({"title": "no price at all"}) is None


def test_price_in_bounds_filters_min_price():
    assert _price_in_bounds(2500, max_price=3000, min_price=2000) is True
    assert _price_in_bounds(1500, max_price=3000, min_price=2000) is False
    assert _price_in_bounds(4000, max_price=3000, min_price=None) is False
    assert _price_in_bounds(2500, max_price=None, min_price=None) is True
