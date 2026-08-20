from fastapi import APIRouter, HTTPException
from models.schemas import VinRequest, VehicleHistory
import httpx
import os

router = APIRouter(prefix="/carfax", tags=["carfax"])

CARFAX_API_KEY = os.getenv("CARFAX_API_KEY", "")


@router.post("", response_model=VehicleHistory)
async def carfax_lookup(req: VinRequest):
    """
    Get vehicle history from CarFax by VIN.
    
    Requires CARFAX_API_KEY env var.
    CarFax doesn't have a public API for Spain — this is a placeholder.
    """
    if not CARFAX_API_KEY:
        # Return mock data for development
        return VehicleHistory(
            vin=req.vin,
            make="SEAT",
            model="León",
            year=2020,
            mileage_records=[
                {"date": "2024-02-10", "km": 32000, "source": "ITV"},
                {"date": "2023-01-20", "km": 25000, "source": "Concesionario"},
                {"date": "2022-03-15", "km": 15000, "source": "ITV"},
            ],
            accidents=[],
            owners=1,
            source="mock",
        )

    # CarFax API integration (when available)
    # CarFax primarily serves North American markets
    # For Spain, consider alternatives like:
    # - AutoDNA (https://www.autodna.com)
    # - carVertical (already integrated above)
    # - Informevehicular.com

    raise HTTPException(
        status_code=501,
        detail="CarFax API not yet integrated for Spanish market. Use CarVertical instead.",
    )
