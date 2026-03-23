# # Patrick Clarke
# # get_metar.py
# # 3/22/'26

# # METAR stands for METeorological Aerodrome Report

# # To run: python get_metar.py

# # uvicorn is the server
# # fastapi is the framework.
# # (Note: This script runs standalone, but can easily be imported into a FastAPI route later)

# import json
# import time
# import requests

# """
# There are 22 weather station IDs returning a 404 Error as of 3/4/'26:

# california_404_station_ids = [
#     "KNGZ", # Alameda NAS, CA
#     "KBUO", # Beaumont, CA
#     "KO57", # Bridgeport, CA
#     "KBNY", # Burney, CA
#     "KCXL", # Calexico Intl, CA
#     "KCZZ", # Campo, CA
#     "KO59", # Cedarville, CA
#     "K9L2", # Edwards N-Aux, CA
#     "KEKA", # Eureka/Murray, CA
#     "KO18", # Hanford, CA *There are two Hanfords so this one is likely deprecated.
#     "KHES", # Healdsburg, CA
#     "KHGT", # Hunter Ligget, CA
#     "KCQT", # Los Angeles, CA
#     "K3A6", # Newhall, CA
#     "KL52", # Oceano Cnty, CA
#     "KNXF", # Oceanside/Red-B, CA
#     "KGXA", # Palmdale, CA *There are also two Palmdales so this one is also likely deprecated.
#     "K87Q", # Pt. Piedras Blan, CA
#     "KO88", # Rio Vista, CA
#     "KO87", # Shelter Cove, CA
#     "KTRM", # Thermal/Palm Spg, CA
#     "KXVW", # Vandenberg Range, CA
# ]
# """

# # Actual list of 165 weather stations.
# california_station_ids = [
#     "KNGZ", "KAAT", "KAPV", "KACV", "KAUN", "KAVX", "KBFL", "KBAB", "KBUO", "KBYS", 
#     "KL35", "KBIH", "KBLH", "KL08", "KO57", "KBAN", "KBUR", "KBNY", "KC83", "KCXL", 
#     "KCMA", "KCZZ", "KNFG", "KCRQ", "KO59", "KCIC", "KNID", "KCNO", "KO22", "KCCR", 
#     "KAJO", "KSNA", "KCEC", "KDAG", "KDWA", "KEDU", "KDLO", "KEDW", "K9L2", "KNJK", 
#     "KEMT", "KBLU", "KEKA", "KL18", "KFOT", "KFCH", "KFAT", "KFUL", "KGOO", "KHAF", 
#     "KHJO", "KO18", "KHHR", "KHWD", "KHES", "KHMT", "KCVH", "KHGT", "KNRS", "KIPL", 
#     "KIYK", "KJAQ", "KWJF", "KPOC", "KWHP", "KNLC", "KLHM", "KLLR", "KLVK", "KLPC", 
#     "KLGB", "KSLI", "KCQT", "KLAX", "KMAE", "KMMH", "KMYV", "KMHR", "KMCC", "KMER", 
#     "KMCE", "KNKX", "KMOD", "KNUQ", "KMHV", "KSIY", "KMRY", "KMHS", "KMWS", "KF70", 
#     "KAPC", "KEED", "K3A6", "KNZY", "KDVO", "KOAK", "KL52", "KOKB", "KNXF", "KONT", 
#     "KOVE", "KOXR", "KGXA", "KPMD", "KPSP", "KPAO", "KPRB", "KO69", "KPVF", "KNTD", 
#     "KPTV", "K87Q", "KRNM", "KRBL", "KRDD", "KREI", "KO32", "KO88", "KRAL", "KRIV", 
#     "KSAC", "KSMF", "KSNS", "KCPU", "KSBD", "KSQL", "KNUC", "KSDB", "KSDM", "KSAN", 
#     "KMYF", "KSEE", "KSFO", "KSJC", "KRHV", "KSBP", "KE16", "KNSI", "KSBA", "KSMX", 
#     "KSMO", "KSTS", "KIZA", "KO87", "KTVL", "KSCK", "KSVE", "KTSP", "KTRM", "KTOA", 
#     "KTCY", "KSUU", "KO86", "KTRK", "KNXP", "KUKI", "KCCB", "KVCB", "KVBG", "KXVW", 
#     "KVNY", "KVCV", "KVIS", "KWVI", "KO54"
# ]

# """
# # Small list of 10 to test.
# california_station_ids = [
#     "KNGZ", # Alameda NAS, CA
#     "KAAT", # Alturas, CA
#     "KAPV", # Apple Valley, CA
#     "KACV", # Arcata/Eureka, CA
#     "KAUN", # Auburn Muni, CA
#     "KAVX", # Avalon, CA
#     "KBFL", # Bakersfield, CA
#     "KBAB", # Beale AFB/Marysv, CA
#     "KBUO", # Beaumont, CA
#     "KBYS", # Bicycle Lake, CA
#     "KL35", # Big Bear City, CA
# ]
# """

# # Printing an individual array entry.
# # print(california_station_ids[0])

# def fetch_all_weather():
#     all_weather_data = {}
    
#     # NWS REQUIRES a User-Agent header. Change this to your own info.
#     headers = {
#         'User-Agent': 'MyWeatherApp/1.0 (your-email@example.com)',
#         'Accept': 'application/geo+json'
#     }

#     print(f"Starting fetch for {len(california_station_ids)} stations...")

#     # 2. Loop through each ID sequentially
#     for station_id in california_station_ids:
#         try:
#             print(f"Fetching data for {station_id}...")

#             # Fetch the recent observations instead of just the latest
#             url = f"https://api.weather.gov/stations/{station_id}/observations"
#             response = requests.get(url, headers=headers)
            
#             # Check if the HTTP request was successful before trying to parse JSON
#             response.raise_for_status() 
            
#             data = response.json()

#             # Find the first (newest) observation where the temperature is NOT null
#             # Using next() with a generator expression replaces JS's Array.prototype.find()
#             best_observation = next(
#                 (obs for obs in data.get('features', []) 
#                  if obs.get('properties', {}).get('temperature', {}).get('value') is not None), 
#                 None
#             )

#             # Store that good observation!
#             all_weather_data[station_id] = best_observation

#             # 3. Pause for 500 milliseconds (0.5 seconds) to respect NWS rate limits
#             time.sleep(0.5)

#         except requests.exceptions.RequestException as error:
#             print(f"Failed to fetch {station_id}: {error}")
#             all_weather_data[station_id] = {"error": str(error)}
#         except Exception as error:
#             print(f"An unexpected error occurred for {station_id}: {error}")
#             all_weather_data[station_id] = {"error": str(error)}

#     # 4. Save the compiled dictionary to a JSON file
#     with open('california_weather.json', 'w', encoding='utf-8') as f:
#         json.dump(all_weather_data, f, indent=2)
        
#     print('✅ Success! Data saved to california_weather.json')

# # Run the function
# if __name__ == "__main__":
#     fetch_all_weather()



# Patrick Clarke
# get_metar.py
# 3/22/'26

import json
import asyncio
import aiohttp
import time

"""
This is an improved version of the original file that gets weather data in 40s - 1m
compared to three minutes. 
"""

california_station_ids = [
    "KNGZ", "KAAT", "KAPV", "KACV", "KAUN", "KAVX", "KBFL", "KBAB", "KBUO", "KBYS", 
    "KL35", "KBIH", "KBLH", "KL08", "KO57", "KBAN", "KBUR", "KBNY", "KC83", "KCXL", 
    "KCMA", "KCZZ", "KNFG", "KCRQ", "KO59", "KCIC", "KNID", "KCNO", "KO22", "KCCR", 
    "KAJO", "KSNA", "KCEC", "KDAG", "KDWA", "KEDU", "KDLO", "KEDW", "K9L2", "KNJK", 
    "KEMT", "KBLU", "KEKA", "KL18", "KFOT", "KFCH", "KFAT", "KFUL", "KGOO", "KHAF", 
    "KHJO", "KO18", "KHHR", "KHWD", "KHES", "KHMT", "KCVH", "KHGT", "KNRS", "KIPL", 
    "KIYK", "KJAQ", "KWJF", "KPOC", "KWHP", "KNLC", "KLHM", "KLLR", "KLVK", "KLPC", 
    "KLGB", "KSLI", "KCQT", "KLAX", "KMAE", "KMMH", "KMYV", "KMHR", "KMCC", "KMER", 
    "KMCE", "KNKX", "KMOD", "KNUQ", "KMHV", "KSIY", "KMRY", "KMHS", "KMWS", "KF70", 
    "KAPC", "KEED", "K3A6", "KNZY", "KDVO", "KOAK", "KL52", "KOKB", "KNXF", "KONT", 
    "KOVE", "KOXR", "KGXA", "KPMD", "KPSP", "KPAO", "KPRB", "KO69", "KPVF", "KNTD", 
    "KPTV", "K87Q", "KRNM", "KRBL", "KRDD", "KREI", "KO32", "KO88", "KRAL", "KRIV", 
    "KSAC", "KSMF", "KSNS", "KCPU", "KSBD", "KSQL", "KNUC", "KSDB", "KSDM", "KSAN", 
    "KMYF", "KSEE", "KSFO", "KSJC", "KRHV", "KSBP", "KE16", "KNSI", "KSBA", "KSMX", 
    "KSMO", "KSTS", "KIZA", "KO87", "KTVL", "KSCK", "KSVE", "KTSP", "KTRM", "KTOA", 
    "KTCY", "KSUU", "KO86", "KTRK", "KNXP", "KUKI", "KCCB", "KVCB", "KVBG", "KXVW", 
    "KVNY", "KVCV", "KVIS", "KWVI", "KO54"
]

# NWS REQUIRES a User-Agent header. Change this to your own info.
HEADERS = {
    'User-Agent': 'MyWeatherApp/1.0 (your-email@example.com)',
    'Accept': 'application/geo+json'
}

async def fetch_station(session, station_id, semaphore):
    """Fetches data for a single station, gated by the semaphore."""
    # The semaphore ensures only X number of these run at the exact same time
    async with semaphore:
        url = f"https://api.weather.gov/stations/{station_id}/observations"
        try:
            # We add a tiny artificial delay to ensure we don't trigger rate limits
            await asyncio.sleep(0.2) 
            
            #async with session.get(url, headers=HEADERS) as response:
            async with session.get(url, headers=HEADERS, ssl=False) as response:
                response.raise_for_status() # Throw error if not 200 OK
                data = await response.json()

                # Find the first (newest) observation where the temperature is NOT null
                best_observation = next(
                    (obs for obs in data.get('features', []) 
                     if obs.get('properties', {}).get('temperature', {}).get('value') is not None), 
                    None
                )
                
                print(f"✅ Fetched {station_id}")
                return station_id, best_observation

        except aiohttp.ClientResponseError as error:
            print(f"❌ HTTP Error for {station_id}: {error.status}")
            return station_id, {"error": str(error)}
        except Exception as error:
            print(f"❌ Unexpected Error for {station_id}: {error}")
            return station_id, {"error": str(error)}

async def main():
    start_time = time.time()
    all_weather_data = {}
    
    # Set the Semaphore limit. 5 is a very safe number for the NWS API.
    # It means 5 concurrent requests at a time.
    semaphore = asyncio.Semaphore(5)
    
    print(f"Starting async fetch for {len(california_station_ids)} stations...")

    # Create a single persistent session for all requests (much faster than opening new connections)
    async with aiohttp.ClientSession() as session:
        # Create a list of "tasks" (promises) to run
        tasks = [fetch_station(session, station_id, semaphore) for station_id in california_station_ids]
        
        # Run them all together and wait for them to finish
        results = await asyncio.gather(*tasks)
        
        # Rebuild the dictionary from the results
        for station_id, data in results:
            all_weather_data[station_id] = data

    # Save to JSON
    with open('california_weather.json', 'w', encoding='utf-8') as f:
        json.dump(all_weather_data, f, indent=2)
        
    end_time = time.time()
    print(f"\n Success! Data saved to california_weather.json")
    print(f"Total execution time: {round(end_time - start_time, 2)} seconds")

# # Run the async event loop (Windows user)
# if __name__ == "__main__":
#     # Windows sometimes throws a harmless but annoying error at the end of asyncio scripts.
#     # This specific setup prevents it.
#     asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
#     asyncio.run(main())

# Run the async event loop
if __name__ == "__main__":
    asyncio.run(main())