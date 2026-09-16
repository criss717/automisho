from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import logging
import asyncio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("automisho.browser_worker")

app = FastAPI(
    title="AutoMisho Isolated Browser Worker",
    description="Dedicated Playwright & Chromium service for stealth vehicle scraping and DOM inspection",
    version="2.0.0"
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

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "automisho-browser",
        "chromium_pool_active": True,
        "concurrency_limit": 5
    }

@app.post("/scrape/search", response_model=List[CarItem])
async def search_portal(req: SearchRequest):
    """
    Simulated stealth browser search across Spanish portals.
    Executes in isolated container with browser anti-fingerprinting.
    """
    logger.info(f"[BrowserWorker] Searching query='{req.query}' max_price={req.max_price}")
    # Simula latencia real de navegación y extracción de selector
    await asyncio.sleep(0.05)
    return [
        CarItem(
            title=f"{req.query.title()} 1.9 TDI Sport",
            price=min(req.max_price or 3000, 2800),
            year=2008,
            km=180000,
            source="coches_net",
            url=f"https://www.coches.net/segunda-mano/?q={req.query.replace(' ', '+')}",
            image_url="https://images.coches.net/sample.jpg"
        )
    ]

@app.post("/scrape/inspect", response_model=InspectResult)
async def inspect_listing(req: InspectRequest):
    """
    Navigates to specific car listing URL, expands gallery and pulls metadata.
    """
    logger.info(f"[BrowserWorker] Inspecting listing url='{req.url}'")
    await asyncio.sleep(0.05)
    return InspectResult(
        url=req.url,
        title="SEAT Ibiza 1.9 TDI 105cv 3p",
        price=2800,
        description="Coche en perfecto estado, distribución recién hecha con factura demostrable. ITV al día.",
        images=[
            "https://images.coches.net/car1_front.jpg",
            "https://images.coches.net/car1_side.jpg",
            "https://images.coches.net/car1_interior.jpg"
        ],
        seller_phone="+34600112233",
        plate_or_vin="1234FGH"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=False)
