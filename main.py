import os
from pathlib import Path
from fastapi import FastAPI, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import flight_service

app = FastAPI(title="Flight Tracker API")

BASE_DIR = Path(__file__).resolve().parent

@app.get("/api/search")
def search_flights(
    origin: str = Query(..., description="Origin City Code (e.g., FRA)"),
    destination: str = Query(..., description="Destination City Code (e.g., JFK)"),
    date_from: str = Query(..., description="Start date (DD/MM/YYYY)"),
    date_to: str = Query(..., description="End date (DD/MM/YYYY)"),
    return_from: str = Query(None, description="Return start date (DD/MM/YYYY)"),
    return_to: str = Query(None, description="Return end date (DD/MM/YYYY)")
):
    try:
        results = flight_service.search_flights(
            origin, destination, date_from, date_to, return_from, return_to
        )
        return JSONResponse(content={"status": "success", "data": results})
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

# Statische Dateien (Frontend) direkt auf der Haupt-URL ("/") einbinden.
# WICHTIG: Dies muss nach allen @app.get Routen stehen!
app.mount("/", StaticFiles(directory=str(BASE_DIR / "static"), html=True), name="static")
