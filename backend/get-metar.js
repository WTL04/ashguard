// Patrick Clarke
// get-metar.js
// 3/1/'26

// To run: node get-metar.js

/*
// Actual list of 165 weather stations.
const californiaStationIDs = [
  "KNGZ", // Alameda NAS, CA
  "KAAT", // Alturas, CA
  "KAPV", // Apple Valley, CA
  "KACV", // Arcata/Eureka, CA
  "KAUN", // Auburn Muni, CA
  "KAVX", // Avalon, CA
  "KBFL", // Bakersfield, CA
  "KBAB", // Beale AFB/Marysv, CA
  "KBUO", // Beaumont, CA
  "KBYS", // Bicycle Lake, CA
  "KL35", // Big Bear City, CA
  "KBIH", // Bishop, CA
  "KBLH", // Blythe, CA
  "KL08", // Borrego Springs, CA
  "KO57", // Bridgeport, CA
  "KBAN", // Bridgeport(Mcmwt, CA
  "KBUR", // Burbank, CA
  "KBNY", // Burney, CA
  "KC83", // Byron, CA
  "KCXL", // Calexico Intl, CA
  "KCMA", // Camarillo, CA
  "KCZZ", // Campo, CA
  "KNFG", // Camp Pendleton, CA
  "KCRQ", // Carlsbad, CA
  "KO59", // Cedarville, CA
  "KCIC", // Chico Municipal, CA
  "KNID", // China Lake (NAF), CA
  "KCNO", // Chino, CA
  "KO22", // Columbia, CA
  "KCCR", // Concord, CA
  "KAJO", // Corona Muni, CA
  "KSNA", // Costa Mesa, CA
  "KCEC", // Crescent City, CA
  "KDAG", // Daggett, CA
  "KDWA", // Davis Yolo Cnty, CA
  "KEDU", // Davis, CA
  "KDLO", // Delano, CA
  "KEDW", // Edwards AFB, CA
  "K9L2", // Edwards N-Aux, CA
  "KNJK", // El Centro NAF, CA
  "KEMT", // El Monte, CA
  "KBLU", // Emigrant Gap, CA
  "KEKA", // Eureka/Murray, CA
  "KL18", // Fallbrook Airpar, CA
  "KFOT", // Fortuna, CA
  "KFCH", // Fresno Chandler, CA
  "KFAT", // Fresno, CA
  "KFUL", // Fullerton, CA
  "KGOO", // Grass Valley, CA
  "KHAF", // Half Moon Bay, CA
  "KHJO", // Hanford, CA
  "KO18", // Hanford, CA
  "KHHR", // Hawthorne, CA
  "KHWD", // Hayward, CA
  "KHES", // Healdsburg, CA
  "KHMT", // Hemet, CA
  "KCVH", // Hollister Muni, CA
  "KHGT", // Hunter Ligget, CA
  "KNRS", // Imperial Beach, CA
  "KIPL", // Imperial, CA
  "KIYK", // Inyokern, CA
  "KJAQ", // Jackson, CA
  "KWJF", // Lancaster/Fox, CA
  "KPOC", // La Verne/Bracket, CA
  "KWHP", // La / Whiteman, CA
  "KNLC", // Lemoore NAS/Reev, CA
  "KLHM", // Lincoln, CA
  "KLLR", // Little River, CA
  "KLVK", // Livermore, CA
  "KLPC", // Lompoc, CA
  "KLGB", // Long Beach, CA
  "KSLI", // Los Alamitos AAF, CA
  "KCQT", // Los Angeles, CA
  "KLAX", // Los Angeles, CA
  "KMAE", // Madera, CA
  "KMMH", // Mammoth/June Lak, CA
  "KMYV", // Marysville, CA
  "KMHR", // Mather Field, CA
  "KMCC", // Mcclellan AFB, CA
  "KMER", // Merced/Castle AF, CA
  "KMCE", // Merced, CA
  "KNKX", // Miramar NAS/San, CA
  "KMOD", // Modesto, CA
  "KNUQ", // Moffett NAS/Mtn, CA
  "KMHV", // Mojave, CA
  "KSIY", // Montague/Siskiyo, CA
  "KMRY", // Monterey, CA
  "KMHS", // Mount Shasta, CA
  "KMWS", // Mount Wilson, CA
  "KF70", // Murrieta/Temecul, CA
  "KAPC", // Napa, CA
  "KEED", // Needles, CA
  "K3A6", // Newhall, CA
  "KNZY", // North Island NAS, CA
  "KDVO", // Novato/Gnoss Fld, CA
  "KOAK", // Oakland, CA
  "KL52", // Oceano Cnty, CA
  "KOKB", // Oceanside, CA
  "KNXF", // Oceanside/Red-B, CA
  "KONT", // Ontario, CA
  "KOVE", // Oroville, CA
  "KOXR", // Oxnard, CA
  "KGXA", // Palmdale, CA
  "KPMD", // Palmdale, CA
  "KPSP", // Palm Springs, CA
  "KPAO", // Palo Alto, CA
  "KPRB", // Paso Robles, CA
  "KO69", // Petaluma, CA
  "KPVF", // Placerville, CA
  "KNTD", // Point Mugu NAS, CA
  "KPTV", // Porterville, CA
  "K87Q", // Pt. Piedras Blan, CA
  "KRNM", // Ramona, CA
  "KRBL", // Red Bluff, CA
  "KRDD", // Redding, CA
  "KREI", // Redlands, CA
  "KO32", // Reedley, CA
  "KO88", // Rio Vista, CA
  "KRAL", // Riverside, CA
  "KRIV", // Riverside/March, CA
  "KSAC", // Sacramento, CA
  "KSMF", // Sacramento/Metro, CA
  "KSNS", // Salinas, CA
  "KCPU", // San Andreas, CA
  "KSBD", // San Bernardino, CA
  "KSQL", // San Carlos Airpo, CA
  "KNUC", // San Clemente Is., CA
  "KSDB", // Sandberg, CA
  "KSDM", // San Diego/Brown, CA
  "KSAN", // San Diego, CA
  "KMYF", // San Diego/Mntgmy, CA
  "KSEE", // San Diego/Santee, CA
  "KSFO", // San Francisco, CA
  "KSJC", // San Jose, CA
  "KRHV", // San Jose/Reid, CA
  "KSBP", // San Luis Obispo, CA
  "KE16", // San Martin, CA
  "KNSI", // San Nicolas Isla, CA
  "KSBA", // Santa Barbara, CA
  "KSMX", // Santa Maria, CA
  "KSMO", // Santa Monica, CA
  "KSTS", // Santa Rosa, CA
  "KIZA", // Santa Ynez, CA
  "KO87", // Shelter Cove, CA
  "KTVL", // South Lake Tahoe, CA
  "KSCK", // Stockton, CA
  "KSVE", // Susanville Muni, CA
  "KTSP", // Tehachapi, CA
  "KTRM", // Thermal/Palm Spg, CA
  "KTOA", // Torrance Municip, CA
  "KTCY", // Tracy, CA
  "KSUU", // Travis AFB/Fairf, CA
  "KO86", // Trinity Center, CA
  "KTRK", // Truckee Tahoe, CA
  "KNXP", // Twentynine Palms, CA
  "KUKI", // Ukiah, CA
  "KCCB", // Upland, CA
  "KVCB", // Vacaville, CA
  "KVBG", // Vandenberg AFB, CA
  "KXVW", // Vandenberg Range, CA
  "KVNY", // Van Nuys, CA
  "KVCV", // Victorville, CA
  "KVIS", // Visalia Muni, CA
  "KWVI", // Watsonville, CA
  "KO54"  // Weaverville, CA
];
*/

// Small list of 10 to test.
const californiaStationIDs = [
  "KNGZ", // Alameda NAS, CA
  "KAAT", // Alturas, CA
  "KAPV", // Apple Valley, CA
  "KACV", // Arcata/Eureka, CA
  "KAUN", // Auburn Muni, CA
  "KAVX", // Avalon, CA
  "KBFL", // Bakersfield, CA
  "KBAB", // Beale AFB/Marysv, CA
  "KBUO", // Beaumont, CA
  "KBYS", // Bicycle Lake, CA
  "KL35", // Big Bear City, CA
];


// Printing an individual array entry.
// console.log(californiaStationIDs[0]);

const fs = require('fs');

async function fetchAllWeather() {
  const allWeatherData = {};
  
  // NWS REQUIRES a User-Agent header. Change this to your own info.
  const headers = {
    'User-Agent': 'MyWeatherApp/1.0 (your-email@example.com)',
    'Accept': 'application/geo+json'
  };

  console.log(`Starting fetch for ${californiaStationIDs.length} stations...`);

  // 2. Loop through each ID sequentially
  for (const id of californiaStationIDs) {
    try {
      console.log(`Fetching data for ${id}...`);
      const response = await fetch(`https://api.weather.gov/stations/${id}/observations/latest`, { headers });
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      allWeatherData[id] = data; // Store the data under the station's ID

      // 3. Pause for 500 milliseconds to respect NWS rate limits
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`Failed to fetch ${id}: ${error.message}`);
      allWeatherData[id] = { error: error.message }; // Log the error in the JSON so it doesn't break the whole process
    }
  }

  // 4. Save the compiled object to a JSON file
  fs.writeFileSync('california_weather.json', JSON.stringify(allWeatherData, null, 2));
  console.log('✅ Success! Data saved to california_weather.json');
}

// Run the function
fetchAllWeather();