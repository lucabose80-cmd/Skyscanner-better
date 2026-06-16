import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
import flight_service

app = FastAPI(title="Flight Tracker API")

BASE_DIR = Path(__file__).resolve().parent

@app.post("/api/generate-combos")
async def generate_combos_endpoint(request: Request):
    try:
        data = await request.json()
        earliest_start = data.get("earliest_start")
        latest_return = data.get("latest_return")
        start_airport = data.get("start_airport")
        end_airport = data.get("end_airport")
        destinations = data.get("destinations", [])
        
        results = flight_service.generate_combos(
            earliest_start, latest_return, start_airport, end_airport, destinations
        )
        return JSONResponse(content={"status": "success", "data": results})
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

@app.post("/api/fetch-flights")
async def fetch_flights_endpoint(request: Request):
    try:
        data = await request.json()
        selected_combos = data.get("selected_combos", [])
        
        results = flight_service.fetch_flights(selected_combos)
        return JSONResponse(content={"status": "success", "data": results})
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

app.mount("/", StaticFiles(directory=str(BASE_DIR / "static"), html=True), name="static")
