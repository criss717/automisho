from pydantic import BaseModel, Field
from typing import Optional


class ScrapeRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Search query (e.g., 'SEAT León diesel')")
    source: str = Field(default="auto", description="Source: auto, autoscout24, cochesnet, wallapop")
    max_results: int = Field(default=10, ge=1, le=50)
    min_price: Optional[int] = Field(default=None, ge=0)
    max_price: Optional[int] = Field(default=None, ge=0)
    min_year: Optional[int] = Field(default=None, ge=1990)
    max_km: Optional[int] = Field(default=None, ge=0)
    doors: Optional[int] = Field(default=None, ge=2, le=7, description="Number of doors (e.g. 3, 5)")
    body_type: Optional[str] = Field(default=None, description="Body type: cabrio, coupe, sedan, etc.")
    color: Optional[str] = Field(default=None, description="Color preference")


class CarResult(BaseModel):
    title: str
    price: Optional[int] = None
    currency: str = "EUR"
    year: Optional[int] = None
    km: Optional[int] = None
    fuel: Optional[str] = None
    power: Optional[str] = None
    location: Optional[str] = None
    url: Optional[str] = None
    image_url: Optional[str] = None
    images: list[str] = Field(default_factory=list)
    doors: Optional[int] = None
    description: Optional[str] = None
    source: str


class ScrapeResponse(BaseModel):
    results: list[CarResult]
    source: str
    query: str
    total: int


class DgtRequest(BaseModel):
    plate: str = Field(..., pattern=r"^\d{4}[ -]?[BCDFGHJKLMNPRSTVWXYZ]{3}$", description="Spanish plate: 0000-LLL")


class DgtResult(BaseModel):
    plate: str
    make: str
    model: str
    year: int
    fuel: str
    power: str
    enrollment_date: str
    itv_status: str
    source: str


class VinRequest(BaseModel):
    vin: str = Field(..., min_length=17, max_length=17, description="17-char VIN")


class VehicleHistory(BaseModel):
    vin: str
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    mileage_records: list[dict] = []
    accidents: list[dict] = []
    owners: Optional[int] = None
    source: str


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"
