import json

# Load your current data (assuming it's saved as 'california_weather.json')
with open('california_weather.json', 'r') as file:
    raw_data = json.load(file)

# Create the standard GeoJSON wrapper
geojson_output = {
    "type": "FeatureCollection",
    "features": []
}

# Extract just the feature objects and append them to the list
for station_id, feature_data in raw_data.items():
    geojson_output["features"].append(feature_data)

# Save the properly formatted GeoJSON
with open('california_weather.geojson', 'w') as file:
    json.dump(geojson_output, file, indent=2)

print("Conversion complete!")