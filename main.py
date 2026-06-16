from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import flight_service
from pathlib import Path

app = FastAPI()

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

app.mount("/", StaticFiles(directory=str(BASE_DIR / "static"), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
