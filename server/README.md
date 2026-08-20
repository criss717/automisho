# AutoMisho Backend

FastAPI server for car scraping, DGT lookup, and vehicle history.

## Setup

```bash
cd server
pip install -r requirements.txt
```

## Run

```bash
python main.py
# or
uvicorn main:app --reload --port 8000
```

Server runs at `http://localhost:8000`

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/scrape` | Search car listings (AutoScout24, coches.net, Wallapop) |
| POST | `/dgt` | DGT plate lookup |
| POST | `/carvertical` | Vehicle history by VIN (CarVertical) |
| POST | `/carfax` | Vehicle history by VIN (CarFax) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CARVERTICAL_API_KEY` | No | CarVertical API key (uses mock data if not set) |
| `CARFAX_API_KEY` | No | CarFax API key (uses mock data if not set) |

## API Docs

Once running, visit `http://localhost:8000/docs` for Swagger UI.
