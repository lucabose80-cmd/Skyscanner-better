import os
import requests
from datetime import datetime
import json

# KIWI TEQUILA API
API_KEY = os.getenv("TEQUILA_API_KEY", "")
API_URL = "https://api.tequila.kiwi.com/v2/search"

def search_flights(origin, destination, date_from, date_to, return_from=None, return_to=None):
    if not API_KEY:
        # Return mock data if no API key is provided
        return get_mock_data(origin, destination, date_from)

    headers = {
        "apikey": API_KEY
    }
    
    params = {
        "fly_from": origin,
        "fly_to": destination,
        "date_from": date_from,
        "date_to": date_to,
        "max_stopovers": 2,
        "curr": "EUR",
        "sort": "price"
    }

    if return_from and return_to:
        params["return_from"] = return_from
        params["return_to"] = return_to
        params["flight_type"] = "round"
    else:
        params["flight_type"] = "oneway"

    response = requests.get(API_URL, headers=headers, params=params)
    response.raise_for_status()
    data = response.json()
    
    # Filter logic: Filter out layovers >= 4 hours
    valid_flights = []
    for flight in data.get("data", []):
        if is_flight_valid(flight):
            valid_flights.append(format_flight(flight))
            
    return valid_flights

def is_flight_valid(flight):
    """
    Check if the flight has normal times, e.g., layovers < 4 hours.
    Kiwi provides 'route' which is an array of flight segments.
    We check the time difference between arrival of one and departure of the next.
    """
    route = flight.get("route", [])
    if len(route) <= 1:
        return True # Direct flight
        
    # Check layovers
    for i in range(len(route) - 1):
        arrival_time = datetime.fromtimestamp(route[i]["aTimeUTC"])
        departure_time = datetime.fromtimestamp(route[i+1]["dTimeUTC"])
        layover_duration = (departure_time - arrival_time).total_seconds() / 3600
        
        if layover_duration >= 4.0:
            return False
            
    return True

def format_flight(flight):
    # Extract only relevant information for the frontend
    return {
        "id": flight.get("id"),
        "price": flight.get("price"),
        "currency": "EUR",
        "deep_link": flight.get("deep_link"),
        "duration": flight.get("fly_duration"),
        "departure": datetime.fromtimestamp(flight.get("dTimeUTC")).strftime('%Y-%m-%d %H:%M'),
        "arrival": datetime.fromtimestamp(flight.get("aTimeUTC")).strftime('%Y-%m-%d %H:%M'),
        "route": [f"{r['flyFrom']} -> {r['flyTo']} ({r['airline']})" for r in flight.get("route", [])],
        "layovers": len(flight.get("route", [])) - 1
    }

def get_mock_data(origin, destination, date_from):
    return [
        {
            "id": "mock-1",
            "price": 145,
            "currency": "EUR",
            "deep_link": "#",
            "duration": "2h 15m",
            "departure": f"{date_from[-4:]}-{date_from[3:5]}-{date_from[:2]} 08:30",
            "arrival": f"{date_from[-4:]}-{date_from[3:5]}-{date_from[:2]} 10:45",
            "route": [f"{origin} -> {destination} (LH)"],
            "layovers": 0
        },
        {
            "id": "mock-2",
            "price": 110,
            "currency": "EUR",
            "deep_link": "#",
            "duration": "5h 30m",
            "departure": f"{date_from[-4:]}-{date_from[3:5]}-{date_from[:2]} 14:00",
            "arrival": f"{date_from[-4:]}-{date_from[3:5]}-{date_from[:2]} 19:30",
            "route": [f"{origin} -> MUC (LH)", f"MUC -> {destination} (LH)"],
            "layovers": 1
        }
    ]
