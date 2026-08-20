from fastapi import APIRouter, HTTPException
from models.schemas import DgtRequest, DgtResult
import httpx

router = APIRouter(prefix="/dgt", tags=["dgt"])

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "es-ES,es;q=0.9",
}


@router.post("", response_model=DgtResult)
async def lookup_plate(req: DgtRequest):
    """
    Look up vehicle information by Spanish license plate.
    
    DGT has no public API. This uses third-party services or scraping.
    Currently returns mock data — replace with real implementation.
    """
    plate = req.plate.upper().replace(" ", "").replace("-", "")

    # TODO: Implement real DGT lookup
    # Option 1: Use a third-party API like autopista.es or similar
    # Option 2: Scrape DGT website (fragile, may violate ToS)
    # Option 3: Use the ITV lookup service

    # For now, return mock data
    makes = ["SEAT", "Volkswagen", "Renault", "Peugeot", "Toyota", "BMW", "Mercedes", "Ford"]
    models = ["León", "Golf", "Clio", "208", "Corolla", "Serie 3", "Clase A", "Focus"]
    fuels = ["Gasolina", "Diésel", "Híbrido", "Eléctrico"]
    idx = ord(plate[0]) % len(makes)

    return DgtResult(
        plate=plate,
        make=makes[idx],
        model=models[idx],
        year=2018 + (idx % 7),
        fuel=fuels[idx % len(fuels)],
        power=f"{90 + idx * 15} CV",
        enrollment_date=f"{2018 + (idx % 7)}-{str(idx + 1).zfill(2)}-15",
        itv_status="Vencida" if idx % 3 == 0 else "Vigente",
        source="mock",
    )
