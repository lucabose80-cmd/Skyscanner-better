import os
import requests
from datetime import datetime

# SERPAPI GOOGLE FLIGHTS API
API_KEY = "b8c69aab0426c2ad85e2cd5a37f3e20ce8ac362a0777a030a3bc460207130ab2"
API_URL = "https://serpapi.com/search.json"

def search_flights(origin, destination, date_from, date_to=None, return_from=None, return_to=None):
    # Hilfsfunktion für Datumskonvertierung von DD/MM/YYYY zu YYYY-MM-DD
    def to_iso(d):
        if not d: return None
        parts = d.split('/')
        if len(parts) == 3:
            return f"{parts[2]}-{parts[1]}-{parts[0]}"
        return d
        
    outbound = to_iso(date_from)
    
    params = {
        "engine": "google_flights",
        "api_key": API_KEY,
        "departure_id": origin,
        "arrival_id": destination,
        "outbound_date": outbound,
        "currency": "EUR",
        "hl": "de"
    }

    if return_from:
        params["return_date"] = to_iso(return_from)
        params["type"] = "1" # Hin- und Rückflug
    else:
        params["type"] = "2" # Nur Hinflug

    response = requests.get(API_URL, params=params)
    response.raise_for_status()
    data = response.json()
    
    valid_flights = []
    # SerpApi teilt die Flüge in "Best" und "Other" auf
    flights_list = data.get("best_flights", []) + data.get("other_flights", [])
    
    for flight in flights_list:
        if is_flight_valid(flight):
            deep_link = data.get("search_metadata", {}).get("google_flights_url", "https://www.google.com/flights")
            valid_flights.append(format_flight(flight, deep_link))
            
    # Nach Preis sortieren
    valid_flights.sort(key=lambda x: x["price"] if x["price"] else float('inf'))
    return valid_flights

def is_flight_valid(flight):
    """
    Prüft ob die Layovers unter 4 Stunden (240 Minuten) liegen.
    """
    layovers = flight.get("layovers", [])
    for layover in layovers:
        duration = layover.get("duration", 0)
        if duration >= 240:
            return False
    return True

def format_flight(flight, deep_link):
    flights_segments = flight.get("flights", [])
    
    departure = ""
    arrival = ""
    route = []
    
    if flights_segments:
        dep_info = flights_segments[0].get("departure_airport", {})
        departure = dep_info.get("time", "")
        
        arr_info = flights_segments[-1].get("arrival_airport", {})
        arrival = arr_info.get("time", "")
        
        for seg in flights_segments:
            dep_id = seg.get("departure_airport", {}).get("id", "Unbekannt")
            arr_id = seg.get("arrival_airport", {}).get("id", "Unbekannt")
            airline = seg.get("airline", "Unbekannt")
            route.append(f"{dep_id} -> {arr_id} ({airline})")
            
    total_minutes = flight.get("total_duration", 0)
    h = total_minutes // 60
    m = total_minutes % 60
    duration_str = f"{h}h {m}m"

    return {
        "id": flight.get("flight_ticket", "google-flight"),
        "price": flight.get("price", 0),
        "currency": "EUR",
        "deep_link": deep_link,
        "duration": duration_str,
        "departure": departure,
        "arrival": arrival,
        "route": route,
        "layovers": len(flight.get("layovers", []))
    }
