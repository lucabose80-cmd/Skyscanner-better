import os
from datetime import datetime, timedelta
import random

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
        # We want to favor flights that are NOT on weekends.
        # Weekdays: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
        # Tuesday and Wednesday are statistically the cheapest days to fly.
        s = 0
        for d in combo:
            if d.weekday() in [5, 6]:
                s += 5  # High penalty for weekend
            elif d.weekday() in [0, 4]:
                s += 2  # Medium penalty for Monday/Friday (business/weekend commuters)
            else:
                s += 0  # Optimal (Tue, Wed, Thu)
        return s
        
    # We sort by score. If scores are equal, we can shuffle slightly to give variety.
    # To do this safely, we shuffle first, then stable sort by score.
    random.shuffle(results)
    results.sort(key=score)

    # Let's take up to 20 best results to display.
    best_results = results[:20]

    output = []
    for idx, combo in enumerate(best_results):
        route_details = []
        for i in range(num_flights):
            dep_date = combo[i]
            day_name = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][dep_date.weekday()]
            
            stay_duration = None
            if i > 0:
                stay_duration = (combo[i] - combo[i-1]).days
                
            route_details.append({
                "departure_id": route_airports[i],
                "arrival_id": route_airports[i+1],
                "date": dep_date.strftime("%d.%m.%Y"),
                "day_name": day_name,
                "is_weekend": dep_date.weekday() >= 5,
                "stay_duration": stay_duration
            })
            
        is_recommended = idx < 3 # Top 3 are "Empfohlen"
        
        output.append({
            "combo_id": f"combo_{idx}",
            "route": route_details,
            "score": score(combo),
            "recommended": is_recommended
        })
        
    return output
