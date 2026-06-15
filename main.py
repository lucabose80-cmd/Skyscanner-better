from fastapi import FastAPI, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import flight_service
import os

app = FastAPI(title="Flight Tracker API")

# Serve the frontend
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_root():
    # redirect to /static/index.html
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/static/index.html")

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
