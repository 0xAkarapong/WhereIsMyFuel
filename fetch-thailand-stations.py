import requests
import json
import time

# Overpass API query for all fuel stations in Thailand
overpass_url = "https://overpass-api.de/api/interpreter"
query = """
[out:json][timeout:120];
area["ISO3166-1"="TH"]->.thailand;
(
  node["amenity"="fuel"](area.thailand);
  way["amenity"="fuel"](area.thailand);
  relation["amenity"="fuel"](area.thailand);
);
out center tags;
"""

print("Fetching fuel stations from OpenStreetMap for all of Thailand...")
response = requests.post(overpass_url, data={"data": query}, timeout=180)
data = response.json()

elements = data.get("elements", [])
print(f"Raw elements: {len(elements)}")

# Brand normalization map
brand_map = {
    "ptt": "PTT",
    "ปตท": "PTT",
    "ptt station": "PTT",
    "ptt oil": "PTT",
    "or": "PTT",  # OR is PTT's retail brand
    "bangchak": "Bangchak",
    "บางจาก": "Bangchak",
    "shell": "Shell",
    "เชลล์": "Shell",
    "esso": "Esso",
    "เอสโซ่": "Esso",
    "caltex": "Caltex",
    "คาลเท็กซ์": "Caltex",
    "pt": "PT",
    "พีที": "PT",
    "pt max": "PT",
    "susco": "Susco",
    "ซัสโก้": "Susco",
    "irpc": "IRPC",
    "ไออาร์พีซี": "IRPC",
    "cosmo": "Cosmo",
    "คอสโม": "Cosmo",
    "petronas": "Petronas",
    "เพทโทรนาส": "Petronas",
    "pure": "Pure",
    "เพียว": "Pure",
}

stations = []
seen_coords = set()

for el in elements:
    tags = el.get("tags", {})
    
    # Get coordinates
    if el["type"] == "node":
        lat = el.get("lat")
        lng = el.get("lon")
    else:
        center = el.get("center", {})
        lat = center.get("lat")
        lng = center.get("lon")
    
    if not lat or not lng:
        continue
    
    # Deduplicate by rounding coordinates
    coord_key = (round(lat, 5), round(lng, 5))
    if coord_key in seen_coords:
        continue
    seen_coords.add(coord_key)
    
    # Name
    name = tags.get("name", tags.get("name:th", tags.get("name:en", "")))
    brand_raw = tags.get("brand", tags.get("brand:th", tags.get("operator", "")))
    
    # Normalize brand
    brand = "อื่นๆ"
    if brand_raw:
        brand_lower = brand_raw.strip().lower()
        for key, val in brand_map.items():
            if key in brand_lower:
                brand = val
                break
    
    # Generate name if empty
    if not name:
        name = f"ปั๊มน้ำมัน {brand}" if brand != "อื่นๆ" else "ปั๊มน้ำมัน"
    
    # Address
    addr_parts = []
    if tags.get("addr:subdistrict"):
        addr_parts.append(tags["addr:subdistrict"])
    if tags.get("addr:district"):
        addr_parts.append(tags["addr:district"])
    if tags.get("addr:province") or tags.get("addr:city"):
        addr_parts.append(tags.get("addr:province", tags.get("addr:city", "")))
    address = " ".join(addr_parts) if addr_parts else tags.get("addr:full", "")
    
    # Opening hours
    opening = tags.get("opening_hours", "")
    is24h = "24/7" in opening or "24" in opening.lower()
    
    station = {
        "placeId": f"osm-{el['type'][0]}-{el['id']}",
        "name": name,
        "brand": brand,
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "address": address,
        "isOpen24h": is24h,
        "source": "openstreetmap"
    }
    stations.append(station)

# Sort by brand then name
stations.sort(key=lambda x: (x["brand"], x["name"]))

print(f"\nProcessed stations: {len(stations)}")
print("\nBrand breakdown:")
brand_counts = {}
for s in stations:
    brand_counts[s["brand"]] = brand_counts.get(s["brand"], 0) + 1
for b, c in sorted(brand_counts.items(), key=lambda x: -x[1]):
    print(f"  {b}: {c}")

# Save
with open("seed-data-thailand.json", "w", encoding="utf-8") as f:
    json.dump(stations, f, ensure_ascii=False, indent=2)

print(f"\nSaved to seed-data-thailand.json")
