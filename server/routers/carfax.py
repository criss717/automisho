from fastapi import APIRouter, HTTPException
from models.schemas import VinRequest, VehicleHistory
import os

router = APIRouter(prefix="/carfax", tags=["carfax"])

CARFAX_API_KEY = os.getenv("CARFAX_API_KEY", "")

@router.post("", response_model=VehicleHistory)
async def carfax_lookup(req: VinRequest):
    """
    Get vehicle history from CarFax by VIN.
    Requires CARFAX_API_KEY env var, otherwise mock.
    CarFax doesn't have a public API for Spain — placeholder.
    """
    is_mock = not CARFAX_API_KEY
    if is_mock:
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

    raise HTTPException(
        status_code=501,
        detail="CarFax API not yet integrated for Spanish market. Use CarVertical instead.",
    )
