import os
import requests
from datetime import datetime, timedelta
import json
import random

# SERPAPI GOOGLE FLIGHTS API
API_KEY = "b8c69aab0426c2ad85e2cd5a37f3e20ce8ac362a0777a030a3bc460207130ab2"
API_URL = "https://serpapi.com/search.json"

def generate_combos(earliest_start, latest_return, start_airport, end_airport, destinations):
    earliest = datetime.strptime(earliest_start, "%Y-%m-%d")
    latest = datetime.strptime(latest_return, "%Y-%m-%d")

    route_airports = [start_airport] + [d["airport"] for d in destinations]
    if end_airport:
        route_airports.append(end_airport)
        
    num_flights = len(route_airports) - 1
    
    min_stays = [int(d["min_days"]) for d in destinations]
    max_stays = [int(d["max_days"]) for d in destinations]
    
    if not end_airport and min_stays:
        min_stays.pop()
        max_stays.pop()

    results = []
    def backtrack(idx, current_date, combo):
        if idx == len(min_stays):
            if current_date <= latest:
                results.append(combo)
            return
            
        for days in range(min_stays[idx], max_stays[idx] + 1):
            next_date = current_date + timedelta(days=days)
            if next_date <= latest:
                backtrack(idx + 1, next_date, combo + (next_date,))

    max_d0 = latest - timedelta(days=sum(min_stays)) if min_stays else latest
    d0 = earliest
    while d0 <= max_d0:
        backtrack(0, d0, (d0,))
        d0 += timedelta(days=1)

    def score(combo):
        # lower score is better (weekend flights are penalized)
        return sum(1 for d in combo if d.weekday() >= 4)
        
    random.shuffle(results)
    results.sort(key=score)

    output = []
    for idx, combo in enumerate(results):
        multi_city = []
        route_strings = []
        for i in range(num_flights):
            multi_city.append({
                "departure_id": route_airports[i],
                "arrival_id": route_airports[i+1],
                "date": combo[i].strftime("%Y-%m-%d")
            })
            route_strings.append(f"{route_airports[i]} ➡️ {route_airports[i+1]} ({combo[i].strftime('%d.%m.')})")
            
        is_recommended = idx < 10
        output.append({
            "combo_id": f"combo_{idx}",
            "multi_city": multi_city,
            "route_summary": " | ".join(route_strings),
            "score": score(combo),
            "recommended": is_recommended
        })
        
    return output


def fetch_flights(selected_combos, max_layover=240):
    all_flights = []
    errors = []
    
    for combo_data in selected_combos:
        multi_city = combo_data.get("multi_city", [])
        if not multi_city:
            continue
            
        params = {
            "engine": "google_flights",
            "api_key": API_KEY,
            "type": "3",
            "multi_city_json": json.dumps(multi_city),
            "currency": "EUR",
            "hl": "de"
        }
        
        try:
            res = requests.get(API_URL, params=params)
            res.raise_for_status()
            data = res.json()
            
            if "error" in data:
                errors.append(f"SerpApi Error: {data['error']}")
                continue
                
            flights_list = data.get("best_flights", []) + data.get("other_flights", [])
            for flight in flights_list:
                if is_flight_valid(flight, max_layover):
                    deep_link = data.get("search_metadata", {}).get("google_flights_url", "https://www.google.com/flights")
                    formatted = format_flight(flight, deep_link, multi_city)
                    if formatted:
                        all_flights.append(formatted)
        except Exception as e:
            err_str = str(e)
            if hasattr(e, 'response') and e.response is not None:
                err_str += " | Response: " + e.response.text
            print(f"Error fetching combo: {err_str}")
            errors.append(err_str)

    all_flights.sort(key=lambda x: x["price"] if x["price"] else float('inf'))
    
    # Pack errors into the result if no flights found to help debugging
    if not all_flights and errors:
        raise Exception("API Fehler aufgetreten: " + " | ".join(errors[:3]))
        
    return all_flights[:20]


def is_flight_valid(flight, max_layover):
    layovers = flight.get("layovers", [])
    for layover in layovers:
        duration = layover.get("duration", 0)
        if duration > max_layover:
            return False
    return True

def format_flight(flight, deep_link, request_combo):
    flights_segments = flight.get("flights", [])
    if not flights_segments:
        return None
        
    departure = ""
    arrival = ""
    route = []
    
    try:
        dep_info = flights_segments[0].get("departure_airport", {})
        dep_dt = datetime.strptime(dep_info.get("time", ""), "%Y-%m-%d %H:%M")
        departure = dep_dt.strftime("%d.%m.%Y %H:%M")
    except:
        departure = flights_segments[0].get("departure_airport", {}).get("time", "")

    try:
        arr_info = flights_segments[-1].get("arrival_airport", {})
        arr_dt = datetime.strptime(arr_info.get("time", ""), "%Y-%m-%d %H:%M")
        arrival = arr_dt.strftime("%d.%m.%Y %H:%M")
    except:
        arrival = flights_segments[-1].get("arrival_airport", {}).get("time", "")
        
    for seg in flights_segments:
        dep_id = seg.get("departure_airport", {}).get("id", "Unbekannt")
        arr_id = seg.get("arrival_airport", {}).get("id", "Unbekannt")
        airline = seg.get("airline", "Unbekannt")
        route.append(f"{dep_id} -> {arr_id} ({airline})")
        
    total_minutes = flight.get("total_duration", 0)
    h = total_minutes // 60
    m = total_minutes % 60
    duration_str = f"{h}h {m}m"

    date_summary = " | ".join([f"{c['departure_id']}->{c['arrival_id']} am {datetime.strptime(c['date'], '%Y-%m-%d').strftime('%d.%m.')}" for c in request_combo])

    return {
        "id": flight.get("flight_ticket", "google-flight") + str(random.randint(1,10000)),
        "price": flight.get("price", 0),
        "currency": "EUR",
        "deep_link": deep_link,
        "duration": duration_str,
        "departure": departure,
        "arrival": arrival,
        "route": route,
        "layovers": len(flight.get("layovers", [])),
        "date_summary": date_summary
    }
