/**
 * countryData.js
 *
 * Hardcoded country dataset for the travel globe app.
 * Pure ES module, no imports. Exposes:
 *   - COUNTRIES: array of country objects (name, iso2, capital, lat, lng,
 *     flag, population, continent, island, fact)
 *   - normalizeCountryName(s): lookup-key normalizer (lowercase, trimmed,
 *     accents stripped, punctuation removed)
 *   - findCountryByName(name): alias-aware lookup -> country object | null
 *   - CONTINENT_BY_COUNTRY: { normalizedName -> continent }
 *
 * lat/lng are the country's capital city. Population figures are recent
 * approximate estimates. Facts are intended to be accurate and delightful.
 */

export const COUNTRIES = [
  // ---------------------------------------------------------------- Africa
  { name: "Algeria", iso2: "DZ", capital: "Algiers", lat: 36.75, lng: 3.06, flag: "🇩🇿", population: 45400000, continent: "Africa", island: false, fact: "Algeria is Africa's largest country, and over four-fifths of it is Sahara desert." },
  { name: "Angola", iso2: "AO", capital: "Luanda", lat: -8.84, lng: 13.23, flag: "🇦🇴", population: 35600000, continent: "Africa", island: false, fact: "Luanda has repeatedly ranked among the most expensive cities in the world for expats." },
  { name: "Benin", iso2: "BJ", capital: "Porto-Novo", lat: 6.50, lng: 2.62, flag: "🇧🇯", population: 13700000, continent: "Africa", island: false, fact: "Benin is the birthplace of the Vodun (Voodoo) religion, which has an official national holiday." },
  { name: "Botswana", iso2: "BW", capital: "Gaborone", lat: -24.65, lng: 25.91, flag: "🇧🇼", population: 2600000, continent: "Africa", island: false, fact: "Botswana is home to the world's largest population of African elephants, over 130,000." },
  { name: "Burkina Faso", iso2: "BF", capital: "Ouagadougou", lat: 12.37, lng: -1.52, flag: "🇧🇫", population: 23000000, continent: "Africa", island: false, fact: "Burkina Faso hosts FESPACO, the largest African film festival on the continent." },
  { name: "Burundi", iso2: "BI", capital: "Gitega", lat: -3.43, lng: 29.93, flag: "🇧🇮", population: 13200000, continent: "Africa", island: false, fact: "Burundi's drummers of Gitega are recognized by UNESCO as a masterpiece of cultural heritage." },
  { name: "Cape Verde", iso2: "CV", capital: "Praia", lat: 14.93, lng: -23.51, flag: "🇨🇻", population: 600000, continent: "Africa", island: true, fact: "Cape Verde's islands were uninhabited until Portuguese sailors arrived in the 1460s." },
  { name: "Cameroon", iso2: "CM", capital: "Yaoundé", lat: 3.85, lng: 11.50, flag: "🇨🇲", population: 28000000, continent: "Africa", island: false, fact: "Cameroon is nicknamed 'Africa in miniature' for its huge range of climates and terrain." },
  { name: "Central African Republic", iso2: "CF", capital: "Bangui", lat: 4.39, lng: 18.56, flag: "🇨🇫", population: 5600000, continent: "Africa", island: false, fact: "The CAR sits almost exactly at the geographic center of the African continent." },
  { name: "Chad", iso2: "TD", capital: "N'Djamena", lat: 12.11, lng: 15.04, flag: "🇹🇩", population: 18300000, continent: "Africa", island: false, fact: "Lake Chad has shrunk by about 90% since the 1960s, devastating the regional fishery." },
  { name: "Comoros", iso2: "KM", capital: "Moroni", lat: -11.70, lng: 43.26, flag: "🇰🇲", population: 850000, continent: "Africa", island: true, fact: "Comoros supplies most of the world's ylang-ylang, the flower behind classic perfumes." },
  { name: "Democratic Republic of the Congo", iso2: "CD", capital: "Kinshasa", lat: -4.32, lng: 15.31, flag: "🇨🇩", population: 102000000, continent: "Africa", island: false, fact: "The Congo River is the world's deepest, plunging to over 220 meters in places." },
  { name: "Republic of the Congo", iso2: "CG", capital: "Brazzaville", lat: -4.27, lng: 15.27, flag: "🇨🇬", population: 6100000, continent: "Africa", island: false, fact: "Brazzaville and Kinshasa face each other across the river, the closest pair of capitals on Earth." },
  { name: "Djibouti", iso2: "DJ", capital: "Djibouti", lat: 11.59, lng: 43.15, flag: "🇩🇯", population: 1100000, continent: "Africa", island: false, fact: "Lake Assal in Djibouti is the lowest point in Africa and one of the saltiest lakes on Earth." },
  { name: "Egypt", iso2: "EG", capital: "Cairo", lat: 30.04, lng: 31.24, flag: "🇪🇬", population: 111000000, continent: "Africa", island: false, fact: "The Great Pyramid was the tallest human-made structure for nearly 4,000 years." },
  { name: "Equatorial Guinea", iso2: "GQ", capital: "Malabo", lat: 3.75, lng: 8.78, flag: "🇬🇶", population: 1700000, continent: "Africa", island: false, fact: "It is the only sovereign African nation where Spanish is an official language." },
  { name: "Eritrea", iso2: "ER", capital: "Asmara", lat: 15.34, lng: 38.93, flag: "🇪🇷", population: 3600000, continent: "Africa", island: false, fact: "Asmara is a UNESCO site for its remarkably preserved 1930s Italian Art Deco architecture." },
  { name: "Eswatini", iso2: "SZ", capital: "Mbabane", lat: -26.32, lng: 31.14, flag: "🇸🇿", population: 1200000, continent: "Africa", island: false, fact: "Eswatini is one of the world's last absolute monarchies, ruled by a king and queen mother." },
  { name: "Ethiopia", iso2: "ET", capital: "Addis Ababa", lat: 9.03, lng: 38.74, flag: "🇪🇹", population: 126000000, continent: "Africa", island: false, fact: "Ethiopia follows its own calendar with 13 months and is roughly 7-8 years behind the Gregorian one." },
  { name: "Gabon", iso2: "GA", capital: "Libreville", lat: 0.39, lng: 9.45, flag: "🇬🇦", population: 2400000, continent: "Africa", island: false, fact: "Nearly 90% of Gabon is covered in rainforest, and forest elephants roam its beaches." },
  { name: "Gambia", iso2: "GM", capital: "Banjul", lat: 13.45, lng: -16.58, flag: "🇬🇲", population: 2700000, continent: "Africa", island: false, fact: "The Gambia is mainland Africa's smallest country, a thin sliver wrapped around its river." },
  { name: "Ghana", iso2: "GH", capital: "Accra", lat: 5.60, lng: -0.19, flag: "🇬🇭", population: 33500000, continent: "Africa", island: false, fact: "Ghana was the first sub-Saharan African nation to gain independence from colonial rule, in 1957." },
  { name: "Guinea", iso2: "GN", capital: "Conakry", lat: 9.64, lng: -13.58, flag: "🇬🇳", population: 14000000, continent: "Africa", island: false, fact: "Guinea holds some of the largest bauxite reserves on the planet, the ore behind aluminum." },
  { name: "Guinea-Bissau", iso2: "GW", capital: "Bissau", lat: 11.86, lng: -15.60, flag: "🇬🇼", population: 2100000, continent: "Africa", island: false, fact: "The Bijagós Archipelago off its coast is a biosphere reserve where saltwater hippos swim." },
  { name: "Ivory Coast", iso2: "CI", capital: "Yamoussoukro", lat: 6.83, lng: -5.29, flag: "🇨🇮", population: 28200000, continent: "Africa", island: false, fact: "Yamoussoukro's basilica is one of the largest churches in the world, rivaling St. Peter's." },
  { name: "Kenya", iso2: "KE", capital: "Nairobi", lat: -1.29, lng: 36.82, flag: "🇰🇪", population: 54000000, continent: "Africa", island: false, fact: "Nairobi is the only major capital city with a national park full of wild lions inside its limits." },
  { name: "Lesotho", iso2: "LS", capital: "Maseru", lat: -29.31, lng: 27.48, flag: "🇱🇸", population: 2300000, continent: "Africa", island: false, fact: "Lesotho is the only country entirely above 1,000 meters in elevation." },
  { name: "Liberia", iso2: "LR", capital: "Monrovia", lat: 6.30, lng: -10.80, flag: "🇱🇷", population: 5300000, continent: "Africa", island: false, fact: "Liberia was founded by freed American slaves, and its capital honors U.S. president James Monroe." },
  { name: "Libya", iso2: "LY", capital: "Tripoli", lat: 32.89, lng: 13.19, flag: "🇱🇾", population: 6900000, continent: "Africa", island: false, fact: "The hottest reliably recorded air temperature on Earth was long credited to Libya's desert." },
  { name: "Madagascar", iso2: "MG", capital: "Antananarivo", lat: -18.88, lng: 47.51, flag: "🇲🇬", population: 30300000, continent: "Africa", island: true, fact: "About 90% of Madagascar's wildlife, including all its lemurs, exists nowhere else on Earth." },
  { name: "Malawi", iso2: "MW", capital: "Lilongwe", lat: -13.96, lng: 33.79, flag: "🇲🇼", population: 20400000, continent: "Africa", island: false, fact: "Lake Malawi has more fish species than any other lake on Earth, most found nowhere else." },
  { name: "Mali", iso2: "ML", capital: "Bamako", lat: 12.64, lng: -8.00, flag: "🇲🇱", population: 22600000, continent: "Africa", island: false, fact: "Timbuktu was a medieval hub of scholarship holding hundreds of thousands of manuscripts." },
  { name: "Mauritania", iso2: "MR", capital: "Nouakchott", lat: 18.08, lng: -15.98, flag: "🇲🇷", population: 4900000, continent: "Africa", island: false, fact: "The Richat Structure, the 'Eye of the Sahara', is so vast it's used as a landmark from space." },
  { name: "Mauritius", iso2: "MU", capital: "Port Louis", lat: -20.16, lng: 57.50, flag: "🇲🇺", population: 1300000, continent: "Africa", island: true, fact: "Mauritius was the only home of the dodo, hunted to extinction within a century of human arrival." },
  { name: "Morocco", iso2: "MA", capital: "Rabat", lat: 34.02, lng: -6.84, flag: "🇲🇦", population: 37500000, continent: "Africa", island: false, fact: "Morocco's Fez has the world's oldest continuously operating university, founded in 859 AD." },
  { name: "Mozambique", iso2: "MZ", capital: "Maputo", lat: -25.97, lng: 32.58, flag: "🇲🇿", population: 33900000, continent: "Africa", island: false, fact: "Mozambique's flag is the only national flag in the world featuring a modern assault rifle." },
  { name: "Namibia", iso2: "NA", capital: "Windhoek", lat: -22.56, lng: 17.08, flag: "🇳🇦", population: 2600000, continent: "Africa", island: false, fact: "Namibia's Sossusvlei has some of the tallest sand dunes on Earth, soaring over 300 meters." },
  { name: "Niger", iso2: "NE", capital: "Niamey", lat: 13.51, lng: 2.11, flag: "🇳🇪", population: 26200000, continent: "Africa", island: false, fact: "Niger has one of the youngest populations on Earth, with a median age under 15." },
  { name: "Nigeria", iso2: "NG", capital: "Abuja", lat: 9.07, lng: 7.40, flag: "🇳🇬", population: 223000000, continent: "Africa", island: false, fact: "Nigeria is Africa's most populous nation, and Lagos is one of the fastest-growing megacities." },
  { name: "Rwanda", iso2: "RW", capital: "Kigali", lat: -1.94, lng: 30.06, flag: "🇷🇼", population: 13800000, continent: "Africa", island: false, fact: "Rwanda banned plastic bags in 2008 and Kigali is among the cleanest cities in Africa." },
  { name: "Sao Tome and Principe", iso2: "ST", capital: "São Tomé", lat: 0.34, lng: 6.73, flag: "🇸🇹", population: 230000, continent: "Africa", island: true, fact: "This tiny island nation sits almost exactly where the equator meets the prime meridian." },
  { name: "Senegal", iso2: "SN", capital: "Dakar", lat: 14.69, lng: -17.45, flag: "🇸🇳", population: 17700000, continent: "Africa", island: false, fact: "Lake Retba near Dakar turns bright pink from salt-loving algae thriving in its waters." },
  { name: "Seychelles", iso2: "SC", capital: "Victoria", lat: -4.62, lng: 55.45, flag: "🇸🇨", population: 100000, continent: "Africa", island: true, fact: "Seychelles is home to the coco de mer, which produces the heaviest seed of any plant on Earth." },
  { name: "Sierra Leone", iso2: "SL", capital: "Freetown", lat: 8.48, lng: -13.23, flag: "🇸🇱", population: 8600000, continent: "Africa", island: false, fact: "Freetown was founded as a settlement for freed slaves, giving the city its name." },
  { name: "Somalia", iso2: "SO", capital: "Mogadishu", lat: 2.05, lng: 45.34, flag: "🇸🇴", population: 17600000, continent: "Africa", island: false, fact: "Somalia has the longest mainland coastline in continental Africa." },
  { name: "South Africa", iso2: "ZA", capital: "Pretoria", lat: -25.75, lng: 28.19, flag: "🇿🇦", population: 60400000, continent: "Africa", island: false, fact: "South Africa is the only country with three capital cities: Pretoria, Cape Town, and Bloemfontein." },
  { name: "South Sudan", iso2: "SS", capital: "Juba", lat: 4.85, lng: 31.58, flag: "🇸🇸", population: 11000000, continent: "Africa", island: false, fact: "South Sudan became the world's newest sovereign country when it gained independence in 2011." },
  { name: "Sudan", iso2: "SD", capital: "Khartoum", lat: 15.50, lng: 32.56, flag: "🇸🇩", population: 47000000, continent: "Africa", island: false, fact: "Sudan has more ancient pyramids than Egypt, with over 200 built by the Kushite kingdom." },
  { name: "Tanzania", iso2: "TZ", capital: "Dodoma", lat: -6.16, lng: 35.75, flag: "🇹🇿", population: 65000000, continent: "Africa", island: false, fact: "Tanzania has Africa's highest peak, Kilimanjaro, and its deepest lake, Tanganyika." },
  { name: "Togo", iso2: "TG", capital: "Lomé", lat: 6.13, lng: 1.22, flag: "🇹🇬", population: 8800000, continent: "Africa", island: false, fact: "Togo's Koutammakou region features clay tower-houses that UNESCO recognizes as living heritage." },
  { name: "Tunisia", iso2: "TN", capital: "Tunis", lat: 36.81, lng: 10.18, flag: "🇹🇳", population: 12400000, continent: "Africa", island: false, fact: "The desert sets of Star Wars' planet Tatooine were filmed in Tunisia, which inspired the name." },
  { name: "Uganda", iso2: "UG", capital: "Kampala", lat: 0.35, lng: 32.58, flag: "🇺🇬", population: 47200000, continent: "Africa", island: false, fact: "Uganda holds more than half of the world's remaining mountain gorillas." },
  { name: "Zambia", iso2: "ZM", capital: "Lusaka", lat: -15.39, lng: 28.32, flag: "🇿🇲", population: 20000000, continent: "Africa", island: false, fact: "Victoria Falls on the Zambia-Zimbabwe border is the largest sheet of falling water on Earth." },
  { name: "Zimbabwe", iso2: "ZW", capital: "Harare", lat: -17.83, lng: 31.05, flag: "🇿🇼", population: 16300000, continent: "Africa", island: false, fact: "Great Zimbabwe's stone city was built without mortar and gave the nation its name." },

  // ----------------------------------------------------------------- Asia
  { name: "Afghanistan", iso2: "AF", capital: "Kabul", lat: 34.53, lng: 69.17, flag: "🇦🇫", population: 41100000, continent: "Asia", island: false, fact: "Afghanistan's Band-e-Amir was its first national park, a chain of stunning deep-blue lakes." },
  { name: "Armenia", iso2: "AM", capital: "Yerevan", lat: 40.18, lng: 44.51, flag: "🇦🇲", population: 2800000, continent: "Asia", island: false, fact: "Armenia was the first nation in the world to adopt Christianity as its state religion, in 301 AD." },
  { name: "Azerbaijan", iso2: "AZ", capital: "Baku", lat: 40.41, lng: 49.87, flag: "🇦🇿", population: 10300000, continent: "Asia", island: false, fact: "Azerbaijan is nicknamed the 'Land of Fire' for the natural gas flames that burn on its hillsides." },
  { name: "Bahrain", iso2: "BH", capital: "Manama", lat: 26.23, lng: 50.59, flag: "🇧🇭", population: 1500000, continent: "Asia", island: true, fact: "Bahrain's 'Tree of Life' is a 400-year-old mesquite thriving alone in the desert with no water source." },
  { name: "Bangladesh", iso2: "BD", capital: "Dhaka", lat: 23.81, lng: 90.41, flag: "🇧🇩", population: 173000000, continent: "Asia", island: false, fact: "Bangladesh sits on the world's largest river delta and shelters the Sundarbans' Bengal tigers." },
  { name: "Bhutan", iso2: "BT", capital: "Thimphu", lat: 27.47, lng: 89.64, flag: "🇧🇹", population: 790000, continent: "Asia", island: false, fact: "Bhutan measures Gross National Happiness and is the world's only carbon-negative country." },
  { name: "Brunei", iso2: "BN", capital: "Bandar Seri Begawan", lat: 4.90, lng: 114.94, flag: "🇧🇳", population: 450000, continent: "Asia", island: false, fact: "Brunei's water village Kampong Ayer has housed people on stilts for over a thousand years." },
  { name: "Cambodia", iso2: "KH", capital: "Phnom Penh", lat: 11.56, lng: 104.92, flag: "🇰🇭", population: 16900000, continent: "Asia", island: false, fact: "Angkor Wat is the largest religious monument on Earth and appears on Cambodia's flag." },
  { name: "China", iso2: "CN", capital: "Beijing", lat: 39.90, lng: 116.40, flag: "🇨🇳", population: 1412000000, continent: "Asia", island: false, fact: "All of China runs on a single time zone despite spanning five geographic ones." },
  { name: "Cyprus", iso2: "CY", capital: "Nicosia", lat: 35.18, lng: 33.36, flag: "🇨🇾", population: 1300000, continent: "Asia", island: true, fact: "Nicosia is the world's last divided capital, split between Greek and Turkish Cypriot zones." },
  { name: "Georgia", iso2: "GE", capital: "Tbilisi", lat: 41.72, lng: 44.79, flag: "🇬🇪", population: 3700000, continent: "Asia", island: false, fact: "Georgia is widely considered the birthplace of wine, made there for over 8,000 years." },
  { name: "India", iso2: "IN", capital: "New Delhi", lat: 28.61, lng: 77.21, flag: "🇮🇳", population: 1428000000, continent: "Asia", island: false, fact: "India is now the world's most populous country and the only one with a wild tiger and lion population." },
  { name: "Indonesia", iso2: "ID", capital: "Jakarta", lat: -6.21, lng: 106.85, flag: "🇮🇩", population: 277000000, continent: "Asia", island: true, fact: "Indonesia is made of over 17,000 islands and is home to the Komodo dragon." },
  { name: "Iran", iso2: "IR", capital: "Tehran", lat: 35.69, lng: 51.39, flag: "🇮🇷", population: 89000000, continent: "Asia", island: false, fact: "Iran's Dasht-e Lut desert recorded some of the hottest surface temperatures ever measured from space." },
  { name: "Iraq", iso2: "IQ", capital: "Baghdad", lat: 33.32, lng: 44.36, flag: "🇮🇶", population: 44500000, continent: "Asia", island: false, fact: "Mesopotamia, in modern Iraq, is where writing and the first cities were invented." },
  { name: "Israel", iso2: "IL", capital: "Jerusalem", lat: 31.77, lng: 35.21, flag: "🇮🇱", population: 9700000, continent: "Asia", island: false, fact: "The Dead Sea shore in Israel is the lowest dry land on Earth, over 430 meters below sea level." },
  { name: "Japan", iso2: "JP", capital: "Tokyo", lat: 35.68, lng: 139.69, flag: "🇯🇵", population: 124000000, continent: "Asia", island: true, fact: "Japan has more than 5 million vending machines, selling everything from hot soup to fresh eggs." },
  { name: "Jordan", iso2: "JO", capital: "Amman", lat: 31.95, lng: 35.93, flag: "🇯🇴", population: 11300000, continent: "Asia", island: false, fact: "Petra, carved into rose-red cliffs, was lost to the Western world for over 600 years." },
  { name: "Kazakhstan", iso2: "KZ", capital: "Astana", lat: 51.17, lng: 71.43, flag: "🇰🇿", population: 19600000, continent: "Asia", island: false, fact: "Kazakhstan is the largest landlocked country on Earth and launches rockets from Baikonur." },
  { name: "Kuwait", iso2: "KW", capital: "Kuwait City", lat: 29.38, lng: 47.99, flag: "🇰🇼", population: 4300000, continent: "Asia", island: false, fact: "Kuwait once recorded the hottest temperature in Asia, hitting 54°C in the shade." },
  { name: "Kyrgyzstan", iso2: "KG", capital: "Bishkek", lat: 42.87, lng: 74.59, flag: "🇰🇬", population: 6800000, continent: "Asia", island: false, fact: "Lake Issyk-Kul in Kyrgyzstan never freezes despite sitting high in the snowy Tian Shan mountains." },
  { name: "Laos", iso2: "LA", capital: "Vientiane", lat: 17.97, lng: 102.60, flag: "🇱🇦", population: 7600000, continent: "Asia", island: false, fact: "Laos is the most heavily bombed country per capita in history, from the Vietnam War era." },
  { name: "Lebanon", iso2: "LB", capital: "Beirut", lat: 33.89, lng: 35.50, flag: "🇱🇧", population: 5300000, continent: "Asia", island: false, fact: "The cedar tree on Lebanon's flag has symbolized the country since biblical times." },
  { name: "Malaysia", iso2: "MY", capital: "Kuala Lumpur", lat: 3.14, lng: 101.69, flag: "🇲🇾", population: 33900000, continent: "Asia", island: false, fact: "Malaysia's rainforests are over 130 million years old, far older than the Amazon." },
  { name: "Maldives", iso2: "MV", capital: "Malé", lat: 4.18, lng: 73.51, flag: "🇲🇻", population: 520000, continent: "Asia", island: true, fact: "The Maldives is the flattest country on Earth, with its highest natural point under 3 meters." },
  { name: "Mongolia", iso2: "MN", capital: "Ulaanbaatar", lat: 47.89, lng: 106.91, flag: "🇲🇳", population: 3400000, continent: "Asia", island: false, fact: "Ulaanbaatar is the coldest capital city in the world, and a third of Mongolians are nomads." },
  { name: "Myanmar", iso2: "MM", capital: "Naypyidaw", lat: 19.76, lng: 96.08, flag: "🇲🇲", population: 54200000, continent: "Asia", island: false, fact: "Myanmar's capital Naypyidaw has 20-lane highways that are almost completely empty of traffic." },
  { name: "Nepal", iso2: "NP", capital: "Kathmandu", lat: 27.72, lng: 85.32, flag: "🇳🇵", population: 30500000, continent: "Asia", island: false, fact: "Nepal has the only non-rectangular national flag in the world and is home to Mount Everest." },
  { name: "North Korea", iso2: "KP", capital: "Pyongyang", lat: 39.04, lng: 125.76, flag: "🇰🇵", population: 26100000, continent: "Asia", island: false, fact: "North Korea uses the Juche calendar, counting years from the 1912 birth of Kim Il-sung." },
  { name: "Oman", iso2: "OM", capital: "Muscat", lat: 23.59, lng: 58.41, flag: "🇴🇲", population: 4600000, continent: "Asia", island: false, fact: "Oman produces most of the world's frankincense, traded since the days of the pharaohs." },
  { name: "Pakistan", iso2: "PK", capital: "Islamabad", lat: 33.69, lng: 73.06, flag: "🇵🇰", population: 240000000, continent: "Asia", island: false, fact: "Pakistan has K2, the world's second-tallest and most dangerous mountain to climb." },
  { name: "Palestine", iso2: "PS", capital: "Ramallah", lat: 31.90, lng: 35.20, flag: "🇵🇸", population: 5400000, continent: "Asia", island: false, fact: "Jericho, in the West Bank, is among the oldest continuously inhabited cities on Earth." },
  { name: "Philippines", iso2: "PH", capital: "Manila", lat: 14.60, lng: 120.98, flag: "🇵🇭", population: 117000000, continent: "Asia", island: true, fact: "The Philippines is made of over 7,600 islands and texts more than almost any nation on Earth." },
  { name: "Qatar", iso2: "QA", capital: "Doha", lat: 25.29, lng: 51.53, flag: "🇶🇦", population: 2700000, continent: "Asia", island: false, fact: "Qatar is the only country whose name begins with a Q, and is among the world's richest per capita." },
  { name: "Saudi Arabia", iso2: "SA", capital: "Riyadh", lat: 24.71, lng: 46.68, flag: "🇸🇦", population: 36900000, continent: "Asia", island: false, fact: "Saudi Arabia has no rivers, yet it holds the holiest cities of Islam, Mecca and Medina." },
  { name: "Singapore", iso2: "SG", capital: "Singapore", lat: 1.35, lng: 103.82, flag: "🇸🇬", population: 5900000, continent: "Asia", island: true, fact: "Singapore is one of only three surviving city-states and turns its airport into a garden with a waterfall." },
  { name: "South Korea", iso2: "KR", capital: "Seoul", lat: 37.57, lng: 126.98, flag: "🇰🇷", population: 51700000, continent: "Asia", island: false, fact: "South Korea has the world's fastest average internet and counts a newborn as one year old." },
  { name: "Sri Lanka", iso2: "LK", capital: "Sri Jayawardenepura Kotte", lat: 6.89, lng: 79.92, flag: "🇱🇰", population: 22000000, continent: "Asia", island: true, fact: "Sri Lanka was the first country in the world to elect a female prime minister, in 1960." },
  { name: "Syria", iso2: "SY", capital: "Damascus", lat: 33.51, lng: 36.29, flag: "🇸🇾", population: 23200000, continent: "Asia", island: false, fact: "Damascus is one of the oldest continuously inhabited cities on the planet." },
  { name: "Taiwan", iso2: "TW", capital: "Taipei", lat: 25.03, lng: 121.57, flag: "🇹🇼", population: 23900000, continent: "Asia", island: true, fact: "Taiwan manufactures the majority of the world's most advanced semiconductor chips." },
  { name: "Tajikistan", iso2: "TJ", capital: "Dushanbe", lat: 38.56, lng: 68.79, flag: "🇹🇯", population: 10100000, continent: "Asia", island: false, fact: "More than 90% of Tajikistan is mountainous, dominated by the towering Pamir range." },
  { name: "Thailand", iso2: "TH", capital: "Bangkok", lat: 13.76, lng: 100.50, flag: "🇹🇭", population: 71800000, continent: "Asia", island: false, fact: "Bangkok's full ceremonial name is the longest city name in the world, with 168 letters." },
  { name: "Timor-Leste", iso2: "TL", capital: "Dili", lat: -8.56, lng: 125.57, flag: "🇹🇱", population: 1360000, continent: "Asia", island: true, fact: "Timor-Leste was the first new sovereign state of the 21st century, independent in 2002." },
  { name: "Turkey", iso2: "TR", capital: "Ankara", lat: 39.93, lng: 32.85, flag: "🇹🇷", population: 85300000, continent: "Asia", island: false, fact: "Istanbul is the only major city in the world that straddles two continents." },
  { name: "Turkmenistan", iso2: "TM", capital: "Ashgabat", lat: 37.96, lng: 58.33, flag: "🇹🇲", population: 6400000, continent: "Asia", island: false, fact: "The 'Door to Hell', a gas crater in the desert, has been burning continuously since 1971." },
  { name: "United Arab Emirates", iso2: "AE", capital: "Abu Dhabi", lat: 24.45, lng: 54.38, flag: "🇦🇪", population: 9500000, continent: "Asia", island: false, fact: "The UAE's Burj Khalifa is so tall you can watch the sunset twice by riding to the top." },
  { name: "Uzbekistan", iso2: "UZ", capital: "Tashkent", lat: 41.30, lng: 69.24, flag: "🇺🇿", population: 35600000, continent: "Asia", island: false, fact: "Uzbekistan is one of only two doubly landlocked countries, surrounded entirely by landlocked neighbors." },
  { name: "Vietnam", iso2: "VN", capital: "Hanoi", lat: 21.03, lng: 105.85, flag: "🇻🇳", population: 98900000, continent: "Asia", island: false, fact: "Vietnam's Son Doong is the largest cave in the world, big enough to hold a skyscraper." },
  { name: "Yemen", iso2: "YE", capital: "Sanaa", lat: 15.37, lng: 44.19, flag: "🇾🇪", population: 34400000, continent: "Asia", island: false, fact: "Yemen's Socotra island has dragon's blood trees that look like alien umbrellas." },

  // ---------------------------------------------------------------- Europe
  { name: "Albania", iso2: "AL", capital: "Tirana", lat: 41.33, lng: 19.82, flag: "🇦🇱", population: 2800000, continent: "Europe", island: false, fact: "Albania has more than 750,000 Cold War-era concrete bunkers scattered across the country." },
  { name: "Andorra", iso2: "AD", capital: "Andorra la Vella", lat: 42.51, lng: 1.52, flag: "🇦🇩", population: 80000, continent: "Europe", island: false, fact: "Andorra la Vella is the highest capital city in Europe and the country has no airport." },
  { name: "Austria", iso2: "AT", capital: "Vienna", lat: 48.21, lng: 16.37, flag: "🇦🇹", population: 9100000, continent: "Europe", island: false, fact: "Vienna has topped global rankings as the world's most livable city many times over." },
  { name: "Belarus", iso2: "BY", capital: "Minsk", lat: 53.90, lng: 27.57, flag: "🇧🇾", population: 9200000, continent: "Europe", island: false, fact: "Belarus shelters Europe's last primeval forest and its wild European bison." },
  { name: "Belgium", iso2: "BE", capital: "Brussels", lat: 50.85, lng: 4.35, flag: "🇧🇪", population: 11700000, continent: "Europe", island: false, fact: "Belgium once went 589 days without a government and still ran smoothly." },
  { name: "Bosnia and Herzegovina", iso2: "BA", capital: "Sarajevo", lat: 43.86, lng: 18.41, flag: "🇧🇦", population: 3200000, continent: "Europe", island: false, fact: "Sarajevo hosted the 1984 Winter Olympics and is where WWI was sparked in 1914." },
  { name: "Bulgaria", iso2: "BG", capital: "Sofia", lat: 42.70, lng: 23.32, flag: "🇧🇬", population: 6800000, continent: "Europe", island: false, fact: "Bulgaria gave the world the Cyrillic alphabet and produces most of the world's rose oil." },
  { name: "Croatia", iso2: "HR", capital: "Zagreb", lat: 45.81, lng: 15.98, flag: "🇭🇷", population: 3900000, continent: "Europe", island: false, fact: "The necktie originated in Croatia, where it was worn by 17th-century soldiers." },
  { name: "Czechia", iso2: "CZ", capital: "Prague", lat: 50.08, lng: 14.44, flag: "🇨🇿", population: 10500000, continent: "Europe", island: false, fact: "Czechs drink more beer per person than any other nation on Earth." },
  { name: "Denmark", iso2: "DK", capital: "Copenhagen", lat: 55.68, lng: 12.57, flag: "🇩🇰", population: 5900000, continent: "Europe", island: false, fact: "Denmark's flag is the oldest continuously used national flag in the world." },
  { name: "Estonia", iso2: "EE", capital: "Tallinn", lat: 59.44, lng: 24.75, flag: "🇪🇪", population: 1300000, continent: "Europe", island: false, fact: "Estonia pioneered digital citizenship and lets people vote and start companies online." },
  { name: "Finland", iso2: "FI", capital: "Helsinki", lat: 60.17, lng: 24.94, flag: "🇫🇮", population: 5600000, continent: "Europe", island: false, fact: "Finland has been ranked the world's happiest country for years running, and has 3 million saunas." },
  { name: "France", iso2: "FR", capital: "Paris", lat: 48.85, lng: 2.35, flag: "🇫🇷", population: 68000000, continent: "Europe", island: false, fact: "France is the most visited country on Earth and spans 12 time zones via its territories." },
  { name: "Germany", iso2: "DE", capital: "Berlin", lat: 52.52, lng: 13.40, flag: "🇩🇪", population: 84000000, continent: "Europe", island: false, fact: "Germany has no speed limit on large stretches of its famous Autobahn." },
  { name: "Greece", iso2: "GR", capital: "Athens", lat: 37.98, lng: 23.73, flag: "🇬🇷", population: 10400000, continent: "Europe", island: false, fact: "Greece has thousands of islands but only a few hundred are inhabited." },
  { name: "Hungary", iso2: "HU", capital: "Budapest", lat: 47.50, lng: 19.04, flag: "🇭🇺", population: 9600000, continent: "Europe", island: false, fact: "Budapest sits on over 100 thermal springs and has the largest thermal water cave system on Earth." },
  { name: "Iceland", iso2: "IS", capital: "Reykjavik", lat: 64.15, lng: -21.94, flag: "🇮🇸", population: 380000, continent: "Europe", island: true, fact: "Iceland has no mosquitoes, runs almost entirely on renewable energy, and names babies from a state list." },
  { name: "Ireland", iso2: "IE", capital: "Dublin", lat: 53.35, lng: -6.26, flag: "🇮🇪", population: 5100000, continent: "Europe", island: true, fact: "Ireland has no native snakes, a fact long credited in legend to Saint Patrick." },
  { name: "Italy", iso2: "IT", capital: "Rome", lat: 41.90, lng: 12.50, flag: "🇮🇹", population: 58800000, continent: "Europe", island: false, fact: "Italy has more UNESCO World Heritage sites than any other country on Earth." },
  { name: "Kosovo", iso2: "XK", capital: "Pristina", lat: 42.66, lng: 21.16, flag: "🇽🇰", population: 1600000, continent: "Europe", island: false, fact: "Kosovo is one of Europe's youngest countries and has one of its youngest populations." },
  { name: "Latvia", iso2: "LV", capital: "Riga", lat: 56.95, lng: 24.11, flag: "🇱🇻", population: 1800000, continent: "Europe", island: false, fact: "Riga has the largest collection of Art Nouveau architecture of any city in the world." },
  { name: "Liechtenstein", iso2: "LI", capital: "Vaduz", lat: 47.14, lng: 9.52, flag: "🇱🇮", population: 40000, continent: "Europe", island: false, fact: "Liechtenstein is one of the world's largest exporters of false teeth and can be rented as a whole country." },
  { name: "Lithuania", iso2: "LT", capital: "Vilnius", lat: 54.69, lng: 25.28, flag: "🇱🇹", population: 2800000, continent: "Europe", island: false, fact: "Lithuania has a self-declared artists' micro-republic, Užupis, with its own quirky constitution." },
  { name: "Luxembourg", iso2: "LU", capital: "Luxembourg", lat: 49.61, lng: 6.13, flag: "🇱🇺", population: 660000, continent: "Europe", island: false, fact: "Luxembourg was the first country to make all public transport completely free nationwide." },
  { name: "Malta", iso2: "MT", capital: "Valletta", lat: 35.90, lng: 14.51, flag: "🇲🇹", population: 540000, continent: "Europe", island: true, fact: "Malta's megalithic temples are older than Stonehenge and the Egyptian pyramids." },
  { name: "Moldova", iso2: "MD", capital: "Chișinău", lat: 47.01, lng: 28.86, flag: "🇲🇩", population: 2500000, continent: "Europe", island: false, fact: "Moldova's Mileștii Mici holds the world's largest wine collection, with nearly two million bottles." },
  { name: "Monaco", iso2: "MC", capital: "Monaco", lat: 43.74, lng: 7.42, flag: "🇲🇨", population: 39000, continent: "Europe", island: false, fact: "Monaco is the most densely populated country on Earth and smaller than New York's Central Park." },
  { name: "Montenegro", iso2: "ME", capital: "Podgorica", lat: 42.44, lng: 19.26, flag: "🇲🇪", population: 620000, continent: "Europe", island: false, fact: "Montenegro means 'black mountain' and its Bay of Kotor is Europe's southernmost fjord-like inlet." },
  { name: "Netherlands", iso2: "NL", capital: "Amsterdam", lat: 52.37, lng: 4.90, flag: "🇳🇱", population: 17800000, continent: "Europe", island: false, fact: "About a quarter of the Netherlands lies below sea level, reclaimed from the water." },
  { name: "North Macedonia", iso2: "MK", capital: "Skopje", lat: 41.99, lng: 21.43, flag: "🇲🇰", population: 2100000, continent: "Europe", island: false, fact: "Lake Ohrid here is one of the oldest and deepest lakes in Europe, around 1.4 million years old." },
  { name: "Norway", iso2: "NO", capital: "Oslo", lat: 59.91, lng: 10.75, flag: "🇳🇴", population: 5500000, continent: "Europe", island: false, fact: "Parts of Norway see the midnight sun, where the sun never sets for weeks in summer." },
  { name: "Poland", iso2: "PL", capital: "Warsaw", lat: 52.23, lng: 21.01, flag: "🇵🇱", population: 37700000, continent: "Europe", island: false, fact: "Poland's Crooked Forest has hundreds of pine trees that all bend sharply at the base." },
  { name: "Portugal", iso2: "PT", capital: "Lisbon", lat: 38.72, lng: -9.14, flag: "🇵🇹", population: 10300000, continent: "Europe", island: false, fact: "Lisbon is older than Rome and is one of the oldest capitals in Western Europe." },
  { name: "Romania", iso2: "RO", capital: "Bucharest", lat: 44.43, lng: 26.10, flag: "🇷🇴", population: 19000000, continent: "Europe", island: false, fact: "Romania's Palace of the Parliament is the heaviest building in the world." },
  { name: "Russia", iso2: "RU", capital: "Moscow", lat: 55.75, lng: 37.62, flag: "🇷🇺", population: 144000000, continent: "Europe", island: false, fact: "Russia is the largest country on Earth, spanning 11 time zones across two continents." },
  { name: "San Marino", iso2: "SM", capital: "San Marino", lat: 43.94, lng: 12.45, flag: "🇸🇲", population: 34000, continent: "Europe", island: false, fact: "San Marino claims to be the world's oldest surviving republic, founded in 301 AD." },
  { name: "Serbia", iso2: "RS", capital: "Belgrade", lat: 44.79, lng: 20.45, flag: "🇷🇸", population: 6600000, continent: "Europe", island: false, fact: "Serbia's Belgrade fortress has been fought over and rebuilt more than 100 times." },
  { name: "Slovakia", iso2: "SK", capital: "Bratislava", lat: 48.15, lng: 17.11, flag: "🇸🇰", population: 5400000, continent: "Europe", island: false, fact: "Slovakia has more castles and chateaux per capita than any other country in the world." },
  { name: "Slovenia", iso2: "SI", capital: "Ljubljana", lat: 46.06, lng: 14.51, flag: "🇸🇮", population: 2100000, continent: "Europe", island: false, fact: "Over half of Slovenia is covered in forest, making it one of Europe's greenest countries." },
  { name: "Spain", iso2: "ES", capital: "Madrid", lat: 40.42, lng: -3.70, flag: "🇪🇸", population: 48400000, continent: "Europe", island: false, fact: "Spain has the world's oldest restaurant still operating, dating to 1725 in Madrid." },
  { name: "Sweden", iso2: "SE", capital: "Stockholm", lat: 59.33, lng: 18.07, flag: "🇸🇪", population: 10500000, continent: "Europe", island: false, fact: "Sweden recycles so efficiently that it has imported garbage to fuel its power plants." },
  { name: "Switzerland", iso2: "CH", capital: "Bern", lat: 46.95, lng: 7.45, flag: "🇨🇭", population: 8800000, continent: "Europe", island: false, fact: "Switzerland has enough nuclear fallout shelter space for its entire population." },
  { name: "Ukraine", iso2: "UA", capital: "Kyiv", lat: 50.45, lng: 30.52, flag: "🇺🇦", population: 38000000, continent: "Europe", island: false, fact: "Ukraine has some of the world's richest black soil, making it a global breadbasket." },
  { name: "United Kingdom", iso2: "GB", capital: "London", lat: 51.51, lng: -0.13, flag: "🇬🇧", population: 67700000, continent: "Europe", island: true, fact: "The UK has no codified single-document constitution, relying instead on centuries of law and custom." },
  { name: "Vatican City", iso2: "VA", capital: "Vatican City", lat: 41.90, lng: 12.45, flag: "🇻🇦", population: 800, continent: "Europe", island: false, fact: "Vatican City is the smallest country in the world, both by area and by population." },

  // -------------------------------------------------------- North America
  { name: "Antigua and Barbuda", iso2: "AG", capital: "Saint John's", lat: 17.12, lng: -61.85, flag: "🇦🇬", population: 94000, continent: "North America", island: true, fact: "Antigua is said to have 365 beaches, one for every day of the year." },
  { name: "Bahamas", iso2: "BS", capital: "Nassau", lat: 25.06, lng: -77.35, flag: "🇧🇸", population: 410000, continent: "North America", island: true, fact: "The Bahamas has swimming pigs on Big Major Cay and the world's deepest blue hole." },
  { name: "Barbados", iso2: "BB", capital: "Bridgetown", lat: 13.10, lng: -59.62, flag: "🇧🇧", population: 280000, continent: "North America", island: true, fact: "Rum was invented in Barbados in the 1600s, and pop star Rihanna is a national hero there." },
  { name: "Belize", iso2: "BZ", capital: "Belmopan", lat: 17.25, lng: -88.77, flag: "🇧🇿", population: 410000, continent: "North America", island: false, fact: "Belize has the second-largest barrier reef in the world and the famous Great Blue Hole." },
  { name: "Canada", iso2: "CA", capital: "Ottawa", lat: 45.42, lng: -75.70, flag: "🇨🇦", population: 39600000, continent: "North America", island: false, fact: "Canada has more lakes than the rest of the world combined and the longest coastline on Earth." },
  { name: "Costa Rica", iso2: "CR", capital: "San José", lat: 9.93, lng: -84.08, flag: "🇨🇷", population: 5200000, continent: "North America", island: false, fact: "Costa Rica abolished its army in 1948 and runs almost entirely on renewable electricity." },
  { name: "Cuba", iso2: "CU", capital: "Havana", lat: 23.11, lng: -82.37, flag: "🇨🇺", population: 11200000, continent: "North America", island: true, fact: "Cuba has two currencies and some of the best-preserved vintage American cars on the planet." },
  { name: "Dominica", iso2: "DM", capital: "Roseau", lat: 15.30, lng: -61.39, flag: "🇩🇲", population: 73000, continent: "North America", island: true, fact: "Dominica has a Boiling Lake, the second-largest of its kind in the world." },
  { name: "Dominican Republic", iso2: "DO", capital: "Santo Domingo", lat: 18.49, lng: -69.93, flag: "🇩🇴", population: 11300000, continent: "North America", island: true, fact: "Santo Domingo was the first permanent European city in the Americas, founded in 1496." },
  { name: "El Salvador", iso2: "SV", capital: "San Salvador", lat: 13.69, lng: -89.19, flag: "🇸🇻", population: 6300000, continent: "North America", island: false, fact: "El Salvador was the first country to make Bitcoin official legal tender." },
  { name: "Grenada", iso2: "GD", capital: "Saint George's", lat: 12.06, lng: -61.75, flag: "🇬🇩", population: 113000, continent: "North America", island: true, fact: "Grenada is the 'Spice Isle', producing a huge share of the world's nutmeg." },
  { name: "Guatemala", iso2: "GT", capital: "Guatemala City", lat: 14.63, lng: -90.51, flag: "🇬🇹", population: 18100000, continent: "North America", island: false, fact: "Guatemala's Tikal pyramids appeared as a rebel base in the original Star Wars." },
  { name: "Haiti", iso2: "HT", capital: "Port-au-Prince", lat: 18.59, lng: -72.31, flag: "🇭🇹", population: 11700000, continent: "North America", island: true, fact: "Haiti was the first nation founded by a successful slave revolt, becoming independent in 1804." },
  { name: "Honduras", iso2: "HN", capital: "Tegucigalpa", lat: 14.07, lng: -87.19, flag: "🇭🇳", population: 10400000, continent: "North America", island: false, fact: "Honduras once experienced a 'rain of fish', a phenomenon locals celebrate every year." },
  { name: "Jamaica", iso2: "JM", capital: "Kingston", lat: 18.01, lng: -76.79, flag: "🇯🇲", population: 2800000, continent: "North America", island: true, fact: "Jamaica was the first Western nation to produce reggae and gave the world Bob Marley." },
  { name: "Mexico", iso2: "MX", capital: "Mexico City", lat: 19.43, lng: -99.13, flag: "🇲🇽", population: 128000000, continent: "North America", island: false, fact: "Mexico City is sinking by up to 50 cm a year because it was built on a drained lakebed." },
  { name: "Nicaragua", iso2: "NI", capital: "Managua", lat: 12.13, lng: -86.25, flag: "🇳🇮", population: 6900000, continent: "North America", island: false, fact: "Lake Nicaragua is the only freshwater lake on Earth known to host sharks." },
  { name: "Panama", iso2: "PA", capital: "Panama City", lat: 8.98, lng: -79.52, flag: "🇵🇦", population: 4400000, continent: "North America", island: false, fact: "Panama is the only place where you can watch the sun rise on the Pacific and set on the Atlantic." },
  { name: "Saint Kitts and Nevis", iso2: "KN", capital: "Basseterre", lat: 17.30, lng: -62.72, flag: "🇰🇳", population: 48000, continent: "North America", island: true, fact: "Saint Kitts and Nevis is the smallest country in the Americas by both area and population." },
  { name: "Saint Lucia", iso2: "LC", capital: "Castries", lat: 14.01, lng: -60.99, flag: "🇱🇨", population: 180000, continent: "North America", island: true, fact: "Saint Lucia has the world's only drive-in volcano, where you can park beside the steaming vents." },
  { name: "Saint Vincent and the Grenadines", iso2: "VC", capital: "Kingstown", lat: 13.16, lng: -61.22, flag: "🇻🇨", population: 100000, continent: "North America", island: true, fact: "Pirates of the Caribbean was filmed across this nation's lush volcanic islands." },
  { name: "Trinidad and Tobago", iso2: "TT", capital: "Port of Spain", lat: 10.66, lng: -61.51, flag: "🇹🇹", population: 1500000, continent: "North America", island: true, fact: "Trinidad invented the steel drum, the only acoustic instrument created in the 20th century." },
  { name: "United States", iso2: "US", capital: "Washington, D.C.", lat: 38.90, lng: -77.04, flag: "🇺🇸", population: 335000000, continent: "North America", island: false, fact: "The US has no official national language at the federal level." },

  // -------------------------------------------------------- South America
  { name: "Argentina", iso2: "AR", capital: "Buenos Aires", lat: -34.61, lng: -58.38, flag: "🇦🇷", population: 46000000, continent: "South America", island: false, fact: "Argentina has the world's southernmost city, Ushuaia, the gateway to Antarctica." },
  { name: "Bolivia", iso2: "BO", capital: "La Paz", lat: -16.50, lng: -68.15, flag: "🇧🇴", population: 12200000, continent: "South America", island: false, fact: "Bolivia's Salar de Uyuni is the world's largest salt flat and turns into a giant mirror when wet." },
  { name: "Brazil", iso2: "BR", capital: "Brasília", lat: -15.79, lng: -47.88, flag: "🇧🇷", population: 216000000, continent: "South America", island: false, fact: "Brasília was built from scratch in just 41 months and is shaped like an airplane from above." },
  { name: "Chile", iso2: "CL", capital: "Santiago", lat: -33.45, lng: -70.67, flag: "🇨🇱", population: 19600000, continent: "South America", island: false, fact: "Chile's Atacama Desert is the driest place on Earth, with spots where rain has never been recorded." },
  { name: "Colombia", iso2: "CO", capital: "Bogotá", lat: 4.71, lng: -74.07, flag: "🇨🇴", population: 52000000, continent: "South America", island: false, fact: "Colombia's Caño Cristales is called the 'river of five colors' for its vivid aquatic plants." },
  { name: "Ecuador", iso2: "EC", capital: "Quito", lat: -0.18, lng: -78.47, flag: "🇪🇨", population: 18200000, continent: "South America", island: false, fact: "Mount Chimborazo in Ecuador is the point on Earth's surface farthest from its center." },
  { name: "Guyana", iso2: "GY", capital: "Georgetown", lat: 6.80, lng: -58.16, flag: "🇬🇾", population: 800000, continent: "South America", island: false, fact: "Guyana's Kaieteur Falls is one of the most powerful single-drop waterfalls in the world." },
  { name: "Paraguay", iso2: "PY", capital: "Asunción", lat: -25.30, lng: -57.64, flag: "🇵🇾", population: 6800000, continent: "South America", island: false, fact: "Paraguay's Itaipú dam was for decades the largest producer of hydroelectric power on Earth." },
  { name: "Peru", iso2: "PE", capital: "Lima", lat: -12.05, lng: -77.04, flag: "🇵🇪", population: 34000000, continent: "South America", island: false, fact: "Peru is home to over 3,000 varieties of potato, where the crop was first domesticated." },
  { name: "Suriname", iso2: "SR", capital: "Paramaribo", lat: 5.85, lng: -55.20, flag: "🇸🇷", population: 620000, continent: "South America", island: false, fact: "Suriname is the most forested country on Earth, with over 90% covered in rainforest." },
  { name: "Uruguay", iso2: "UY", capital: "Montevideo", lat: -34.90, lng: -56.16, flag: "🇺🇾", population: 3400000, continent: "South America", island: false, fact: "Uruguay was the first country to win the football World Cup, hosting and winning in 1930." },
  { name: "Venezuela", iso2: "VE", capital: "Caracas", lat: 10.49, lng: -66.88, flag: "🇻🇪", population: 28800000, continent: "South America", island: false, fact: "Venezuela has Angel Falls, the tallest uninterrupted waterfall in the world." },

  // --------------------------------------------------------------- Oceania
  { name: "Australia", iso2: "AU", capital: "Canberra", lat: -35.28, lng: 149.13, flag: "🇦🇺", population: 26500000, continent: "Oceania", island: true, fact: "Australia is wider than the moon and home to more kangaroos than people." },
  { name: "Fiji", iso2: "FJ", capital: "Suva", lat: -18.14, lng: 178.44, flag: "🇫🇯", population: 930000, continent: "Oceania", island: true, fact: "Fiji is made of over 330 islands, and the international date line zigzags around it." },
  { name: "Kiribati", iso2: "KI", capital: "Tarawa", lat: 1.33, lng: 172.98, flag: "🇰🇮", population: 130000, continent: "Oceania", island: true, fact: "Kiribati is the only country to sit in all four hemispheres at once." },
  { name: "Marshall Islands", iso2: "MH", capital: "Majuro", lat: 7.09, lng: 171.38, flag: "🇲🇭", population: 42000, continent: "Oceania", island: true, fact: "Marshall Islanders navigated the open Pacific using intricate stick charts of ocean swells." },
  { name: "Micronesia", iso2: "FM", capital: "Palikir", lat: 6.92, lng: 158.16, flag: "🇫🇲", population: 110000, continent: "Oceania", island: true, fact: "Micronesia's Nan Madol is a mysterious ancient city built on a hundred artificial islands." },
  { name: "Nauru", iso2: "NR", capital: "Yaren", lat: -0.55, lng: 166.92, flag: "🇳🇷", population: 12500, continent: "Oceania", island: true, fact: "Nauru is the world's smallest island nation and has no official capital city." },
  { name: "New Zealand", iso2: "NZ", capital: "Wellington", lat: -41.29, lng: 174.78, flag: "🇳🇿", population: 5200000, continent: "Oceania", island: true, fact: "New Zealand was the first country in the world to give women the right to vote, in 1893." },
  { name: "Palau", iso2: "PW", capital: "Ngerulmud", lat: 7.50, lng: 134.62, flag: "🇵🇼", population: 18000, continent: "Oceania", island: true, fact: "Palau's Jellyfish Lake is filled with millions of stingless jellyfish you can swim among." },
  { name: "Papua New Guinea", iso2: "PG", capital: "Port Moresby", lat: -9.44, lng: 147.18, flag: "🇵🇬", population: 10300000, continent: "Oceania", island: true, fact: "Papua New Guinea has over 800 languages, more than any other country on Earth." },
  { name: "Samoa", iso2: "WS", capital: "Apia", lat: -13.83, lng: -171.77, flag: "🇼🇸", population: 220000, continent: "Oceania", island: true, fact: "Samoa skipped a whole day in 2011, jumping the date line to align with trading partners." },
  { name: "Solomon Islands", iso2: "SB", capital: "Honiara", lat: -9.43, lng: 159.95, flag: "🇸🇧", population: 720000, continent: "Oceania", island: true, fact: "The Solomon Islands are home to people with naturally blonde hair and dark skin." },
  { name: "Tonga", iso2: "TO", capital: "Nuku'alofa", lat: -21.14, lng: -175.20, flag: "🇹🇴", population: 105000, continent: "Oceania", island: true, fact: "Tonga is the only Pacific island nation never to have been formally colonized." },
  { name: "Tuvalu", iso2: "TV", capital: "Funafuti", lat: -8.52, lng: 179.20, flag: "🇹🇻", population: 11000, continent: "Oceania", island: true, fact: "Tuvalu earns millions licensing its '.tv' internet domain to streaming companies." },
  { name: "Vanuatu", iso2: "VU", capital: "Port Vila", lat: -17.73, lng: 168.32, flag: "🇻🇺", population: 320000, continent: "Oceania", island: true, fact: "Vanuatu's Mount Yasur is one of the world's most accessible active volcanoes." }
];

/**
 * Normalize an arbitrary string into a stable lookup key:
 * lowercase, trimmed, accents/diacritics stripped, punctuation removed.
 * Returns '' for falsy input.
 */
export function normalizeCountryName(s) {
  if (!s) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .trim()
    .replace(/[.,'’`"()\-_/]/g, ' ') // common punctuation -> space
    .replace(/\s+/g, ' ')
    .trim();
}

// alias (raw text) -> canonical country name as it appears in COUNTRIES
const ALIASES = {
  "usa": "United States",
  "us": "United States",
  "u.s.a.": "United States",
  "u.s.": "United States",
  "united states of america": "United States",
  "america": "United States",
  "uk": "United Kingdom",
  "u.k.": "United Kingdom",
  "britain": "United Kingdom",
  "great britain": "United Kingdom",
  "england": "United Kingdom",
  "uae": "United Arab Emirates",
  "south korea": "South Korea",
  "korea, south": "South Korea",
  "republic of korea": "South Korea",
  "north korea": "North Korea",
  "korea, north": "North Korea",
  "dprk": "North Korea",
  "russia": "Russia",
  "russian federation": "Russia",
  "czech republic": "Czechia",
  "czechia": "Czechia",
  "drc": "Democratic Republic of the Congo",
  "democratic republic of the congo": "Democratic Republic of the Congo",
  "dr congo": "Democratic Republic of the Congo",
  "congo-kinshasa": "Democratic Republic of the Congo",
  "republic of the congo": "Republic of the Congo",
  "congo": "Republic of the Congo",
  "congo-brazzaville": "Republic of the Congo",
  "ivory coast": "Ivory Coast",
  "cote d'ivoire": "Ivory Coast",
  "côte d'ivoire": "Ivory Coast",
  "burma": "Myanmar",
  "myanmar": "Myanmar",
  "the netherlands": "Netherlands",
  "holland": "Netherlands",
  "vatican": "Vatican City",
  "vatican city": "Vatican City",
  "holy see": "Vatican City",
  "swaziland": "Eswatini",
  "eswatini": "Eswatini",
  "cape verde": "Cape Verde",
  "cabo verde": "Cape Verde",
  "east timor": "Timor-Leste",
  "timor-leste": "Timor-Leste",
  "macedonia": "North Macedonia",
  "north macedonia": "North Macedonia",
  "turkiye": "Turkey",
  "türkiye": "Turkey"
};

// Build the lookup map: normalized name/alias -> country object.
const COUNTRY_LOOKUP = (() => {
  const map = new Map();
  for (const country of COUNTRIES) {
    map.set(normalizeCountryName(country.name), country);
  }
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    const target = COUNTRIES.find(c => c.name === canonical);
    if (target) {
      const key = normalizeCountryName(alias);
      if (!map.has(key)) map.set(key, target);
    }
  }
  return map;
})();

/**
 * Alias-aware lookup. Returns the matching COUNTRIES object, or null.
 */
export function findCountryByName(name) {
  const key = normalizeCountryName(name);
  if (!key) return null;
  return COUNTRY_LOOKUP.get(key) || null;
}

/**
 * Map of normalizeCountryName(country.name) -> continent string.
 */
export const CONTINENT_BY_COUNTRY = COUNTRIES.reduce((acc, country) => {
  acc[normalizeCountryName(country.name)] = country.continent;
  return acc;
}, {});
