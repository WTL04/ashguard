
import folium
import webbrowser
import os

import json

### Custom Object ##########
# 1. Define the path to your image (can be a local file or a URL)
#custom_image_url = "https://_____________.png" # Example URL
custom_image_url = "iSaaaidNo.jpeg" # If it's saved locally

# Create the CustomIcon object
custom_icon = folium.CustomIcon(
    custom_image_url,
    icon_size=(40, 40), # Width and height in pixels
    icon_anchor=(20, 40) # Anchors the bottom-center of the image to the coordinate
)
#############################


# Coordinates for CSULB - where the map will start out at.
CSULB_COORDS = [33.783022, -118.112858]
m = folium.Map(location=CSULB_COORDS, zoom_start=12)


"""This code was for reading from a .json file."""
# Initialize your map (if you haven't already)
# m = folium.Map(location=[36.7783, -119.4179], zoom_start=6)

# with open('california_weather.json', 'r') as file:
#     data = json.load(file)

# for key, value in data.items():
#     # Extract the raw data safely
#     station_name = value['properties']['stationName']
#     lat = value['geometry']['coordinates'][1]
#     lon = value['geometry']['coordinates'][0]
    
#     temp_c = value['properties']['temperature']['value']
#     humidity = value['properties']['relativeHumidity']['value']
#     dew_c = value['properties']['dewpoint']['value']
#     wind_kmh = value['properties']['windSpeed']['value']
    
#     # Safely convert units (handles 'None' values so the loop doesn't crash)
#     temp_str = f"{(temp_c * 9/5) + 32:.1f} °F" if temp_c is not None else "N/A"
#     humidity_str = f"{humidity:.1f} %" if humidity is not None else "N/A"
#     dew_str = f"{(dew_c * 9/5) + 32:.1f} °F" if dew_c is not None else "N/A"
#     wind_mph_str = f"{wind_kmh * 0.621371:.1f} mph" if wind_kmh is not None else "N/A"

#     # Use an f-string with triple quotes to dynamically build the HTML
#     dark_html = f"""
#     <div style="
#         background-color: #333; 
#         color: white; 
#         padding: 10px; 
#         border-radius: 5px;
#         font-family: sans-serif;
#         ">
#         <h4 style="margin-bottom: 5px; color: #FF5F1F;">{station_name or key}</h4>
#         <p style="font-size: 12px; line-height: 1.5;">
#             <b>Lat/Lon:</b> {lat}, {lon}<br>
#             <b>Temperature:</b> {temp_str}<br>
#             <b>Humidity:</b> {humidity_str}<br>
#             <b>Dew Point:</b> {dew_str}<br>
#             <b>Wind Speed:</b> {wind_mph_str}
#         </p>
#     </div>
#     """

    
#     # Height set to 210 (on my machine) removes the scroll bar - for most of the station names.
#     # Ones with a very long name still have the bar.
#     iframe = folium.IFrame(dark_html, width=200, height=210)
#     popup = folium.Popup(iframe, max_width=250)

#     # Add the marker to the map
#     folium.Marker([lat, lon],
#                    popup=popup,
#                    icon=folium.Icon(color='orange', icon='')
#                     ).add_to(m)

# # Save the map
# map_file = "my_map.html"
# m.save(map_file)

# # Display map
# webbrowser.open('file://' + os.path.realpath(map_file))



# If file is stored locally -> For demo on Monday.
with open('california_weather.geojson', 'r') as file:
    data = json.load(file)



# These are the steps for getting the geojson file from the backend so that it can be viewed.
# 1. Get the absolute path to the directory where this script lives (frontend)
# current_dir = os.path.dirname(os.path.abspath(__file__))

# 2. Build the path: current_dir -> up one level -> backend -> filename
# geojson_path = os.path.join(current_dir, '..', 'backend', 'california_weather.geojson')

# 3. Open using the new dynamic path
# with open(geojson_path, 'r') as file:
#     data = json.load(file)





# Point the loop at the list of features instead of data.items()
for feature in data['features']:
    
    # SAFETY CHECK 1: Skip if the feature is completely empty (null/None)
    if feature is None:
        continue
        
    # SAFETY CHECK 2: Skip if it's an error message and doesn't have 'properties'
    if 'properties' not in feature:
        continue

    # Now it is safely guaranteed to be valid data!
    station_name = feature['properties']['stationName']
    station_id = feature['properties']['stationId'] 
    
    lat = feature['geometry']['coordinates'][1]
    lon = feature['geometry']['coordinates'][0]
    
    temp_c = feature['properties']['temperature']['value']
    humidity = feature['properties']['relativeHumidity']['value']
    dew_c = feature['properties']['dewpoint']['value']
    wind_kmh = feature['properties']['windSpeed']['value']
    
    # Safely convert units (handles 'None' values so the loop doesn't crash)
    temp_str = f"{(temp_c * 9/5) + 32:.1f} °F" if temp_c is not None else "N/A"
    humidity_str = f"{humidity:.1f} %" if humidity is not None else "N/A"
    dew_str = f"{(dew_c * 9/5) + 32:.1f} °F" if dew_c is not None else "N/A"
    wind_mph_str = f"{wind_kmh * 0.621371:.1f} mph" if wind_kmh is not None else "N/A"

    # Use an f-string with triple quotes to dynamically build the HTML
    dark_html = f"""
    <div style="
        background-color: #333; 
        color: white; 
        padding: 10px; 
        border-radius: 5px;
        font-family: sans-serif;
        ">
        <h4 style="margin-bottom: 5px; color: #FF5F1F;">{station_name or station_id}</h4>
        <p style="font-size: 12px; line-height: 1.5;">
            <b>Lat/Lon:</b> {lat}, {lon}<br>
            <b>Temperature:</b> {temp_str}<br>
            <b>Humidity:</b> {humidity_str}<br>
            <b>Dew Point:</b> {dew_str}<br>
            <b>Wind Speed:</b> {wind_mph_str}
        </p>
    </div>
    """

    # Height set to 210 (on my machine) removes the scroll bar - for most of the station names.
    # Ones with a very long name still have the bar.
    iframe = folium.IFrame(dark_html, width=200, height=210)
    popup = folium.Popup(iframe, max_width=250)

    # Add the marker to the map
    folium.Marker([lat, lon],
                   popup=popup,
                   icon=folium.Icon(color='orange', icon='')
                   #icon=custom_icon
                    ).add_to(m)
# Save the map
map_file = "my_map.html"
m.save(map_file)

# Display map
webbrowser.open('file://' + os.path.realpath(map_file))