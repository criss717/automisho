from fastapi import APIRouter, HTTPException
from models.schemas import VinRequest, VehicleHistory
import httpx
import os

router = APIRouter(prefix="/carvertical", tags=["carvertical"])

CARVERTICAL_API_KEY = os.getenv("CARVERTICAL_API_KEY", "")
CARVERTICAL_API_URL = "https://api.carvertical.com/v2/vehicle-history"

def _is_mock() -> bool:
    return not CARVERTICAL_API_KEY or os.getenv("MOCK_DGT", "true").lower() == "true" and not os.getenv("CARVERTICAL_API_KEY")

@router.post("", response_model=VehicleHistory)
async def carvertical_lookup(req: VinRequest):
    """
    Get vehicle history from CarVertical by VIN.
    Requires CARVERTICAL_API_KEY env var, otherwise mock.
    """
    is_mock = not CARVERTICAL_API_KEY
    if is_mock:
        return VehicleHistory(
            vin=req.vin,
            make="Volkswagen",
            model="Golf",
            year=2019,
            mileage_records=[
                {"date": "2023-01-15", "km": 45000, "source": "ITV"},
                {"date": "2022-06-20", "km": 38000, "source": "Taller"},
            ],
            accidents=[
                {"date": "2021-03-10", "severity": "minor", "description": "Rayón en puerta trasera"},
            ],
            owners=1,
            source="mock",
        )

    async with httpx.AsyncClient(timeout=12) as client:
        try:
            resp = await client.get(
                CARVERTICAL_API_URL,
                params={"vin": req.vin},
                headers={"Authorization": f"Basic {CARVERTICAL_API_KEY}"},
            )
            resp.raise_for_status()
            data = resp.json()

            return VehicleHistory(
                vin=req.vin,
                make=data.get("make"),
                model=data.get("model"),
                year=data.get("year"),
                mileage_records=data.get("mileage", []),
                accidents=data.get("accidents", []),
                owners=data.get("owners_count"),
                source="carvertical",
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise HTTPException(status_code=404, detail="VIN not found in CarVertical")
            raise HTTPException(status_code=502, detail=f"CarVertical API error: {e.response.status_code}")
        except httpx.HTTPError:
            raise HTTPException(status_code=503, detail="CarVertical service unavailable")
