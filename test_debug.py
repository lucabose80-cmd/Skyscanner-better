import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import flight_service

destinations = [
    {"airport": "ROM", "min_days": 1, "max_days": 2},
    {"airport": "ICN", "min_days": 1, "max_days": 2}
]

# Generate combos
combos = flight_service.generate_combos("2026-06-22", "2026-07-02", "FRA", "FRA", destinations)
print(f"Generated {len(combos)} combos. Fetching first one...")

if combos:
    # Fetch first combo
    flights = flight_service.fetch_flights([combos[0]], max_layover=480)
    print(f"Found {len(flights)} flights")
else:
    print("No combos generated")
