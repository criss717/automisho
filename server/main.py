from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import scrape, dgt, carvertical, carfax
from models.schemas import HealthResponse
import logging

# Configure logging so you can see scraper activity
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)

app = FastAPI(
    title="AutoMisho Backend",
    description="Car scraping, DGT lookup, and vehicle history services",
    version="0.1.0",
)

# CORS — allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(scrape.router)
app.include_router(dgt.router)
app.include_router(carvertical.router)
app.include_router(carfax.router)


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
