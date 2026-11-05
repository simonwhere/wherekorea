import type { Destination } from './types'

// live_weather_snapshot is static seed for internal development.
// Real 7-day weather integration replaces these values before public ship.
// Format: "This week · {temp range} · {condition}" per data-policy.md

export const destinations: Destination[] = [
  {
    slug: 'seoul',
    name: 'Seoul',
    search_names: ['서울', '성수동', 'Seongsu Station, Exit 3', '성수역 3번 출구', 'Daelim Changgo warehouse', '대림창고', 'Somunnan Seongsu Gamjatang', '소문난성수감자탕'],
    hotspots: [
      { name: 'Seongsu-dong', note: 'Fashion shops and cafés' },
      { name: 'Gwanghwamun & Seochon', note: 'Gyeongbokgung Palace and the low-rise alleys to its west' },
      { name: 'Bukchon & Ikseon-dong', note: 'hanok lanes and cafe alleys — Bukchon is residential; check restricted visiting hours and the zone map before going' },
      { name: 'Euljiro', note: 'Workshops, noodle shops and rooftop bars' },
      { name: 'Hannam-dong', note: 'Leeum Museum, galleries and restaurants along the hillside' },
      { name: 'Hongdae & Yeonnam', note: 'Nightlife and cafés beside the linear park' },
    ],
    base_appeal: 10,
    best_months: [4, 5, 6, 9, 10, 11],
    image: {
      src: 'https://images.unsplash.com/photo-1758509444769-95567facc5b0?auto=format&fit=crop&w=800&q=80',
      alt: 'Seoul skyline with Namsan Tower beyond the Han River',
      credit: 'Mita 64 / Unsplash',
      sourceUrl: 'https://unsplash.com/photos/cityscape-with-namsan-tower-under-cloudy-sky-RT3a2TK1RgY',
      licenseUrl: 'https://unsplash.com/license',
    },
    card_vibe: 'Palaces, markets & neighborhoods',
    vibe: "Royal palaces, food markets and neighborhoods linked by subway",
    recommended_stay: '4+ days',
    live_weather_snapshot: 'This week · 13–21°C · partly cloudy',
    card_budget_level: '$$',
    tags: ['city', 'history / traditional'],

    hero_summary:
      "Korea's capital, with royal palaces, traditional markets, galleries and riverside parks across its neighborhoods.",
    why: "Palace grounds in Gwanghwamun, hanok lanes in Bukchon and cafés in Seongsu show different parts of the city. The subway links these areas, with walks and transfers between stops.",
    best_for:
      "Gyeongbokgung Palace, traditional markets, Han River parks and neighborhood cafés.",
    skip_if:
      "Neighborhoods are spread across the city. Allow time for subway transfers and the walk from each station.",
    travel_time: {
      from_seoul: '—',
      from_incheon_airport: '~1h by AREX train',
      from_busan_station: '~2h 15m KTX',
    },
    no_car_friendliness: 'Easy',
    local_movement:
      "Subways and city buses connect the main districts. A standard T-money card is a rechargeable payment card, not an unlimited travel pass. Transfers and the final walk vary by route.",
    car_recommended: false,
    seasonal_weather_context:
      "Spring (Apr–May) and autumn (Sep–Nov) are generally mild. Cherry blossoms usually appear in spring and ginkgo turns yellow in autumn. Summer is hot, humid and rainy in spells; winter is often below freezing.",
    food: "Market food at Gwangjang, Mangwon and Tongin; charcoal-grilled galbi in Mapo; knife-cut noodles around Namdaemun. Seongsu and Yeonnam have many cafés and dessert shops.",
    detail_budget: {
      low: '~₩60,000–80,000/day',
      mid: '~₩130,000–180,000/day',
      high: '₩300,000+/day',
      notes:
        "Guesthouses and hotels cover a wide price range. Mid includes a mid-range room and restaurant meals.",
    },
    crowd_friction: 'High',
    crowd_notes:
      "Hongdae, Insadong, Bukchon and major palaces draw crowds on weekends and national holidays. Palace entry queues vary by day.",
    insider_tips: [
      "For Bukchon, check the official restricted-zone map first. Tourist access to the red zone is restricted from 17:00 until 10:00 the next day; respect the Sunday rest-day guidance and residents' privacy.",
      "Yeouido and Banpo have riverside paths and open park space along the Han River.",
      "Euljiro 3-ga has bars and restaurants among working workshops and older buildings.",
    ],
    similar_destinations: ['busan', 'jeonju'],
    useful_links: [],
    crowd_peak_months: [], // visitor data: flat year-round (metro city)
    trust: {
      travel_time: { source: 'estimate', confidence: 'medium', last_verified: '2026-07-17' },
      budget: { source: 'estimate', confidence: 'medium', last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-07-11' },
    },
  },

  {
    slug: 'busan',
    name: 'Busan',
    hotspots: [
      { name: 'Yeongdo', note: 'Huinnyeoul clifftop lanes and warehouse cafés' },
      { name: 'Haeundae & Haeridan-gil', note: 'Beachfront walks, the Sky Capsule and café alleys' },
      { name: 'Jeonpo & Seomyeon', note: 'Cafés among former tool shops, with restaurants and nightlife nearby' },
      { name: 'Gwangalli', note: 'Beachfront views of the illuminated bridge' },
      { name: 'Gamcheon Culture Village', note: 'Colorful hillside houses, murals and stepped lanes' },
      { name: 'Nampo & Jagalchi', note: 'BIFF Square, street food and the seafood market' },
    ],
    base_appeal: 9,
    best_months: [5, 6, 7, 8, 9, 10],
    image: {
      src: 'https://images.unsplash.com/photo-1768295982614-5dcd1c6eeb2b?auto=format&fit=crop&w=800&q=80',
      alt: 'Gwangan Bridge and the Busan skyline across the bay',
      credit: 'Álvaro Bernal / Unsplash',
      sourceUrl: 'https://unsplash.com/photos/modern-suspension-bridge-over-blue-water-with-cityscape-k9-_5lNayJo',
      licenseUrl: 'https://unsplash.com/license',
    },
    card_vibe: 'Beaches, bridges & seafood',
    vibe: "City beaches, hillside neighborhoods and seafood markets around the harbor",
    recommended_stay: '3 days',
    live_weather_snapshot: 'This week · 14–20°C · mostly clear',
    card_budget_level: '$$',
    tags: ['coastal', 'city'],

    hero_summary:
      "A large port city with sandy beaches, hillside neighborhoods and seafood markets. The coast stretches across several districts.",
    why: "Haeundae and Gwangalli have beachfront walks; Nampo and Jagalchi center on markets and the harbor. Yeongdo and Gamcheon add clifftop lanes and hillside views.",
    best_for:
      "Haeundae and Gwangalli beaches, Jagalchi seafood market and Gamcheon hillside lanes.",
    skip_if:
      "Beach and harbor districts are spread out. Some hillside stops need a bus connection or an uphill walk.",
    travel_time: {
      from_seoul: '~2h 15m KTX',
      from_incheon_airport: '~3h 30m AREX + KTX (transfer at Seoul Stn)',
      from_busan_station: '—',
    },
    no_car_friendliness: 'Easy',
    local_movement:
      "Metro lines connect the main districts. Beaches and hillside neighborhoods can involve a final walk or bus connection from the station.",
    car_recommended: false,
    seasonal_weather_context:
      "July–August is hot and humid, with busy beaches. Spring and autumn are generally milder for walking. Winter sea winds can feel cold even when temperatures are above freezing.",
    food: "Dwaeji gukbap is pork soup served with rice. Other regional dishes include milmyeon, cold wheat noodles, and ssiat hotteok, a seed-filled pancake. Jagalchi has fish stalls and seafood restaurants.",
    detail_budget: {
      low: '~₩55,000–75,000/day',
      mid: '~₩120,000–160,000/day',
      high: '₩250,000+/day',
      notes:
        "Slightly cheaper than Seoul overall. Beach-area accommodation spikes in summer.",
    },
    crowd_friction: 'Medium',
    crowd_notes:
      "Haeundae beach is crowded in July–August. Gwangalli and Nampo are also busy on weekends outside summer.",
    insider_tips: [
      "Gamcheon has steep lanes and stairs. Mornings and weekdays generally have fewer visitors.",
      "Gwangalli Beach faces the illuminated Gwangan Bridge after dark.",
      "KTX trains connect Busan and Gyeongju stations. Gyeongju's central historic area needs a separate onward journey from the station.",
    ],
    similar_destinations: ['seoul', 'tongyeong', 'gyeongju'],
    useful_links: [],
    crowd_peak_months: [10],
    trust: {
      travel_time: { source: 'estimate', confidence: 'medium', last_verified: '2026-07-17' },
      budget: { source: 'estimate', confidence: 'medium', last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-07-11' },
    },
  },

  {
    slug: 'jeju',
    name: 'Jeju',
    hotspots: [
      { name: 'Seongsan', note: 'sunrise-crater town and the gateway ferry to Udo' },
      { name: 'Aewol coast', note: 'lava-rock cafes on the sunset side of the island' },
      { name: 'Hyeopjae & Hallim', note: 'Sandy beaches with views toward Biyangdo' },
      { name: 'Seogwipo old town', note: 'Olle Market, the harbor and access to coastal walks' },
      { name: 'Udo', note: 'Island reached by ferry from the Seongsan area' },
      { name: 'Hallasan area', note: 'Summit routes require reservations; check trail access before visiting' },
    ],
    base_appeal: 9,
    best_months: [4, 5, 6, 7, 8, 9, 10],
    image: {
      src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d1/Daepo_Jusangjeolli_Cliff_02.jpg/960px-Daepo_Jusangjeolli_Cliff_02.jpg',
      alt: 'Columnar basalt cliffs and waves at Daepo Jusangjeolli, Jeju',
      credit: 'Bernard Gagnon / Wikimedia Commons · CC0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Daepo_Jusangjeolli_Cliff_02.jpg',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
    card_vibe: 'Volcanic coast & Hallasan',
    vibe: "Volcanic craters, black-rock shores and coastal roads around Hallasan",
    recommended_stay: '4+ days',
    live_weather_snapshot: 'This week · 13–19°C · breezy, dry',
    card_budget_level: '$$$',
    tags: ['coastal', 'nature', 'couple'],

    hero_summary:
      "A volcanic island with coastal roads, black-rock shores and Hallasan at its center. Towns, beaches and trailheads are spread around the island.",
    why: "Seongsan's crater, the beaches around Hyeopjae and Hallasan's trails show different parts of the island. Seogwipo and Jeju City have markets and onward bus connections.",
    best_for:
      "Volcanic coastal walks, Seongsan Ilchulbong, Hallasan trails and Seogwipo's markets.",
    skip_if:
      "Cross-island journeys take time. Bus frequencies vary, and Hallasan summit routes require reservations.",
    travel_time: {
      from_seoul: '~1h flight from Gimpo Airport',
      from_incheon_airport: 'Via Gimpo + flight; allow airport-transfer and check-in time',
      from_busan_station: '~1h flight from Gimhae Airport',
    },
    no_car_friendliness: 'Hard',
    local_movement:
      "Express, trunk and local buses connect the main towns, with transfers at major hubs. Frequencies and last departures vary by route. A rental car makes scattered coastal stops easier to reach.",
    car_recommended: true,
    seasonal_weather_context:
      "Canola blooms in spring; summer is warm and humid. Autumn is generally cooler for walking. Winter is windy at the coast, while mountain conditions are colder and can affect trail access.",
    food: "Black pork barbecue, gogi-guksu pork noodle soup and seafood associated with haenyeo diving are regional staples. Hallabong citrus and other local citrus varieties appear in markets and desserts.",
    detail_budget: {
      low: '~₩75,000–95,000/day',
      mid: '~₩150,000–190,000/day',
      high: '₩350,000+/day',
      notes:
        "Car rental adds a meaningful daily cost on top of this. Accommodation near Seongsan or the south coast is pricier than Jeju City.",
    },
    crowd_friction: 'High',
    crowd_notes:
      "Korean holidays and summer bring crowds to coastal sights. Seongsan Ilchulbong is busy around sunrise; Hallasan summit reservations are limited.",
    insider_tips: [
      "Check reservations and trail notices for Hallasan's Seongpanak and Gwaneumsa summit routes.",
      "Udo ferries leave from the Seongsan area. Check return sailings and weather-related notices before crossing.",
      "Check the official opening status of Manjanggul lava tube before traveling there.",
    ],
    similar_destinations: ['namhae', 'tongyeong'],
    useful_links: [],
    crowd_peak_months: [10],
    trust: {
      travel_time: { source: 'estimate', confidence: 'medium', last_verified: '2026-07-17' },
      budget: { source: 'estimate', confidence: 'medium', last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-07-11' },
    },
  },

  {
    slug: 'gyeongju',
    name: 'Gyeongju',
    search_names: ['경주', 'Hwangnidan-gil on Poseok-ro', '황리단길 · 포석로', 'Rice cakes at Bitgguri', '빛꾸리', 'Cheonmachong Tomb', '천마총', 'Cheomseongdae Observatory', '첨성대'],
    hotspots: [
      { name: 'Hwangnidan-gil', note: 'Hanok cafés and shops near the central historic area' },
      { name: 'Daereungwon & Cheomseongdae', note: 'Royal burial mounds and a stone observatory within walking distance' },
      { name: 'Bulguksa & Seokguram', note: 'Buddhist temple and grotto outside the city center' },
      { name: 'Wolji night zone', note: 'Donggung Palace and Wolji Pond, illuminated after dark' },
      { name: 'Namsan', note: 'Mountain trails with Buddhist carvings and historic sites' },
    ],
    base_appeal: 6,
    best_months: [4, 10, 11],
    image: {
      src: 'https://images.unsplash.com/photo-1748274035731-32c83e10661e?auto=format&fit=crop&w=800&q=80',
      alt: 'Tumuli Park burial mounds in green park, Gyeongju',
      credit: 'Darwin Vegher / Unsplash',
      sourceUrl: 'https://unsplash.com/photos/mounds-of-earth-in-a-green-park-sEwEffWZnBQ',
      licenseUrl: 'https://unsplash.com/license',
    },
    card_vibe: 'Royal tombs & Buddhist temples',
    vibe: "Silla royal burial mounds, a stone observatory and Buddhist temples",
    recommended_stay: '1–2 days',
    live_weather_snapshot: 'This week · 12–20°C · clear',
    card_budget_level: '$',
    tags: ['history / traditional', 'nature', 'couple'],

    hero_summary:
      "The former Silla capital, with royal burial mounds and palace grounds near the center. Bulguksa Temple and Seokguram Grotto lie outside town.",
    why: "Daereungwon, Cheomseongdae and the central heritage area can be explored on foot or by bike. Temple visits require a separate bus or taxi journey.",
    best_for:
      "Silla burial mounds, Cheomseongdae Observatory, Wolji Pond and Bulguksa Temple.",
    skip_if:
      "The KTX station, city center and outer temples are separate stops. Allow for onward buses or taxis.",
    travel_time: {
      from_seoul: '~2h KTX to Gyeongju Station (formerly Singyeongju)',
      from_incheon_airport: '~3h 15m AREX + KTX',
      from_busan_station: '~30m KTX',
    },
    no_car_friendliness: 'Okay',
    local_movement:
      "Tumuli Park and the central historic area are walkable. Bulguksa Temple and Seokguram Grotto require a bus or taxi from the center.",
    car_recommended: false,
    seasonal_weather_context:
      "Bomun Lake has cherry blossoms in spring; peak dates vary each year. Summers are hot and humid. Autumn is cooler, and winters are cold and dry.",
    food: "Ssambap combines rice and side dishes wrapped in leaves. Hwangnam ppang is a small red-bean pastry sold around the historic center.",
    detail_budget: {
      low: '~₩45,000–60,000/day',
      mid: '~₩90,000–130,000/day',
      high: '₩200,000+/day',
      notes: "Accommodation, meals and site admissions make up the main daily costs. Outer temples add transport costs.",
    },
    crowd_friction: 'Medium',
    crowd_notes:
      "Spring blossom season brings crowds to Bomun Lake and Tumuli Park. Bulguksa is also busy on national holidays.",
    insider_tips: [
      "Cheomseongdae and the nearby burial mounds share a central walking area.",
      "Yangdong Folk Village is outside the central historic area and needs a separate journey.",
      "Gyeongju Station is outside the center. Check the bus or taxi connection to the first stop before arrival.",
    ],
    similar_destinations: ['jeonju', 'busan'],
    useful_links: [],
    crowd_peak_months: [4, 10, 11],
    trust: {
      travel_time: { source: 'estimate', confidence: 'medium', last_verified: '2026-07-17' },
      budget: { source: 'estimate', confidence: 'medium', last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-07-11' },
    },
  },

  {
    slug: 'jeonju',
    name: 'Jeonju',
    search_names: ['전주 한옥마을', '전주한옥마을', 'Jeonju Hanok Village', 'Gyeonggijeon Shrine', '경기전', 'Jeondong Cathedral', '전동성당', 'Nambu Market', '남부시장'],
    hotspots: [
      { name: 'Hanok Village', note: 'Traditional tiled-roof houses, guesthouses and food streets' },
      { name: 'Gaekridan-gil', note: 'Bars and restaurants west of the hanok village' },
      { name: 'Nambu Market', note: 'Market stalls and a night market; check current operating dates' },
      { name: 'Jaman & Omokdae', note: 'Hillside murals and views over the hanok rooftops' },
      { name: 'Seohak-dong art village', note: 'Galleries and studios across the stream' },
    ],
    base_appeal: 5,
    best_months: [4, 5, 9, 10, 11],
    image: {
      src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Jeonju_Hanok_Maeul_01.jpg/960px-Jeonju_Hanok_Maeul_01.jpg',
      alt: 'Traditional tiled rooftops of Jeonju Hanok Village',
      credit: 'Bernard Gagnon / Wikimedia Commons · CC0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Jeonju_Hanok_Maeul_01.jpg',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
    card_vibe: 'Hanok village & bibimbap',
    vibe: "Hanok lanes, bibimbap and food markets around a walkable village center",
    recommended_stay: '1–2 days',
    live_weather_snapshot: 'This week · 12–21°C · dry',
    card_budget_level: '$',
    tags: ['history / traditional', 'solo'],

    hero_summary:
      "A city known for bibimbap and its hanok village. Traditional guesthouses, food streets and rooftop viewpoints cluster around the village.",
    why: "The hanok lanes, Nambu Market and Omokdae viewpoint are close enough to explore on foot. Hanok guesthouses offer overnight stays within the village.",
    best_for:
      "Hanok village walks, bibimbap, Nambu Market and views from Omokdae.",
    skip_if:
      "Jeonju Station is outside the hanok-village area. A city bus or taxi is needed for the onward journey.",
    travel_time: {
      from_seoul: '~1h 40m KTX from Yongsan to Jeonju Station',
      from_incheon_airport: 'Direct airport bus; check the operator for journey time',
      from_busan_station: '~3h express bus (no direct rail)',
    },
    no_car_friendliness: 'Easy',
    local_movement:
      "The hanok-village area works well on foot. Jeonju Station is separate: allow a city bus or taxi to the village, and check onward transport for places outside this area.",
    car_recommended: false,
    seasonal_weather_context:
      "Spring and autumn are generally mild for walking. Summer is hot and humid; winter is cold, with occasional snow.",
    food: "Jeonju is known for bibimbap, kongnamul gukbap bean-sprout soup and makgeolli served with side dishes. Choco pies are a common bakery souvenir.",
    detail_budget: {
      low: '~₩45,000–60,000/day',
      mid: '~₩90,000–120,000/day',
      high: '₩180,000+/day',
      notes:
        "Hanok guesthouse rates vary by room and location. Rooms inside the village can cost more than those outside it.",
    },
    crowd_friction: 'Medium',
    crowd_notes:
      "The hanok village is busy on weekends, especially in spring and autumn. Weekdays and evenings generally have fewer day visitors.",
    insider_tips: [
      "Hanok guesthouses are inside and around the village; check room type and bathroom arrangements before booking.",
      "Nambu Market is a short walk from the hanok village. Check the night market's current operating dates separately.",
      "Omokdae hilltop park overlooks the hanok rooftops.",
    ],
    similar_destinations: ['gyeongju', 'busan'],
    useful_links: [],
    crowd_peak_months: [10],
    trust: {
      travel_time: { source: 'estimate', confidence: 'medium', last_verified: '2026-07-17' },
      budget: { source: 'estimate', confidence: 'low', last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-07-11' },
    },
  },

  {
    slug: 'gangneung',
    name: 'Gangneung',
    hotspots: [
      { name: 'Anmok coffee street', note: 'A row of cafés facing the beach' },
      { name: 'Chodang-dong', note: 'Sundubu restaurants and tofu-gelato shops' },
      { name: 'Gyeongpo', note: 'long beach plus a flat bike loop around the lagoon' },
      { name: 'Jumunjin', note: 'fish-market lunch and the famous seaside bus-stop photo spot' },
      { name: 'Myeongju-dong', note: 'Old-town lanes with cafés and bookshops' },
    ],
    base_appeal: 5,
    best_months: [6, 7, 8, 9, 10],
    image: {
      src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fb/Anmok_Beach_20220430_008.jpg/960px-Anmok_Beach_20220430_008.jpg',
      alt: 'Coffee sculpture on Anmok Beach in Gangneung',
      credit: 'Mobius6 / Wikimedia Commons · CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Anmok_Beach_20220430_008.jpg',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
    card_vibe: 'East coast & café culture',
    vibe: "Beachfront cafés, Gyeongpo Lake and Chodang tofu restaurants",
    recommended_stay: '1–2 days',
    live_weather_snapshot: 'This week · 11–19°C · clear',
    card_budget_level: '$$',
    tags: ['coastal', 'nature', 'couple'],

    hero_summary:
      "An east coast city with beachfront cafés, sandy beaches and Gyeongpo Lake. KTX trains connect Seoul with Gangneung Station.",
    why: "Anmok has cafés along the sand, Gyeongpo has a beach and lakeside paths, and Chodang has tofu restaurants. These areas are separate from the railway station.",
    best_for:
      "Anmok Beach cafés, Gyeongpo Lake walks, Chodang tofu and Jumunjin port.",
    skip_if:
      "The station, beaches and northern port are separate stops. Coastal bus connections can be slow.",
    travel_time: {
      from_seoul: '~1h 50m KTX',
      from_incheon_airport: '~3h 20m AREX + KTX',
      from_busan_station: '~3h 55m KTX-Eum from Bujeon Stn',
    },
    no_car_friendliness: 'Okay',
    local_movement:
      "City buses reach Gyeongpo Beach and the main café district, but connections are slow. A taxi or rental car makes exploring the coast easier.",
    car_recommended: false,
    seasonal_weather_context:
      "Summer brings beach visitors and humid weather. Autumn is cooler for coastal walks. Winters are cold, with occasional heavy snow that can affect transport.",
    food: "Chodang sundubu is silken tofu traditionally set with seawater. Other foods include spicy jang-kalguksu noodles, squid around Jumunjin and tofu-flavored gelato. Anmok has beachfront coffee shops.",
    detail_budget: {
      low: '~₩55,000–70,000/day',
      mid: '~₩120,000–160,000/day',
      high: '₩250,000+/day',
      notes: "Beachfront accommodation can cost more than rooms in the city center, especially in summer.",
    },
    crowd_friction: 'Medium',
    crowd_notes:
      "Summer beach season (July–August) is very crowded. Gyeongpo Lake cherry blossom season brings day-trippers from Seoul. Weekends are consistently busy year-round.",
    insider_tips: [
      "Anmok's cafés line the beachfront rather than the city center.",
      "Jumunjin port is north of central Gangneung; allow a separate bus or taxi journey.",
      "Gangneung Station is inland. Check the onward connection to Gyeongpo or Anmok when choosing a train.",
    ],
    similar_destinations: ['sokcho'],
    useful_links: [],
    crowd_peak_months: [7, 8, 10],
    trust: {
      travel_time: { source: 'estimate', confidence: 'medium', last_verified: '2026-07-17' },
      budget: { source: 'estimate', confidence: 'low',    last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-07-11' },
    },
  },

  {
    slug: 'sokcho',
    name: 'Sokcho',
    hotspots: [
      { name: 'Seoraksan area', note: 'Ulsanbawi hiking route and park cable car; check access and operating notices' },
      { name: 'Jungang Market area', note: 'Market stalls selling dakgangjeong, sweet fried chicken' },
      { name: 'Abai Village', note: 'cross the harbor on the hand-pulled gaetbae boat' },
      { name: 'Yeongnangho Lake', note: 'flat lakeside loop with Seorak views' },
      { name: 'Yangyang surf belt', note: 'Jukdo and Surfyy Beach, south of Sokcho in neighboring Yangyang' },
    ],
    base_appeal: 5,
    best_months: [7, 8, 9, 10],
    image: {
      src: 'https://images.unsplash.com/photo-1547690395-5adca25d2ae3?auto=format&fit=crop&w=800&q=80',
      alt: 'Seoraksan National Park mountain ridges, Sokcho',
      credit: 'Tom Hill / Unsplash',
      sourceUrl: 'https://unsplash.com/photos/mountain-ranges-bUhZj-B4lYs',
      licenseUrl: 'https://unsplash.com/license',
    },
    card_vibe: 'Seoraksan & market seafood',
    vibe: "Seoraksan trail access, harbor markets and Abai Village by the water",
    recommended_stay: '3 days',
    live_weather_snapshot: 'This week · 10–18°C · clear',
    card_budget_level: '$$',
    tags: ['coastal', 'mountain / hiking', 'nature'],

    hero_summary:
      "An east coast city with seafood markets, Abai Village and bus access to Seoraksan National Park.",
    why: "The harbor and market area are in town, while Seoraksan's trails lie inland. Yeongnangho Lake adds a lakeside walking route with mountain views.",
    best_for:
      "Seoraksan trails, Jungang Market, Abai Village and Yeongnangho Lake.",
    skip_if:
      "Seoraksan is outside the city center. Trail access and cable-car operation depend on current conditions.",
    travel_time: {
      from_seoul: '~2h 30m express bus',
      from_incheon_airport: '~3h 30m direct bus (4/day)',
      from_busan_station: '~5h+ intercity bus',
    },
    no_car_friendliness: 'Okay',
    local_movement:
      "Buses reach Seoraksan park entrance and the main market area. Getting around the wider coast without a car is slower but manageable for the core circuit.",
    car_recommended: false,
    seasonal_weather_context:
      "Summer brings beach visitors. Seoraksan's autumn foliage draws crowds, usually in October; timing varies. Snow and seasonal closures can affect mountain trails in winter and spring.",
    food: "Abai sundae and squid sundae are associated with Abai Village. Jungang Market has dakgangjeong, sweet-crispy fried chicken. Mulhoe is cold raw-fish soup served around the coast.",
    detail_budget: {
      low: '~₩55,000–70,000/day',
      mid: '~₩110,000–150,000/day',
      high: '₩230,000+/day',
      notes: "Comparable to Gangneung. Accommodation near the park entrance costs a premium in autumn.",
    },
    crowd_friction: 'Medium',
    crowd_notes:
      "Seoraksan's entrances and cable car are busy during autumn foliage season. Market and beach areas draw summer crowds.",
    insider_tips: [
      "The hand-pulled gaetbae boat connects the harbor side with Abai Village; check current operating hours.",
      "Check the national park's trail notices before starting the Ulsanbawi route.",
      "The market, coast and national park are separate areas. Check bus connections and return departures for mountain visits.",
    ],
    similar_destinations: ['gangneung', 'jirisan'],
    useful_links: [],
    crowd_peak_months: [7, 8, 10],
    trust: {
      travel_time: { source: 'estimate', confidence: 'medium', last_verified: '2026-07-17' },
      budget: { source: 'estimate', confidence: 'low',    last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-07-11' },
    },
  },

  {
    slug: 'tongyeong',
    name: 'Tongyeong',
    hotspots: [
      { name: 'Gangguan & Jungang Market', note: 'Harbor walks, fish stalls and seafood restaurants' },
      { name: 'Dongpirang & Seopirang', note: 'Mural-covered hillsides overlooking the port' },
      { name: 'Mireuksan cable car zone', note: 'Cable-car access to views across the islands' },
      { name: 'Bongsugol', note: 'cherry-blossom cafe lane around the Jeon Hyucklim museum' },
      { name: 'Island day trips', note: 'Somaemuldo or Yeonhwado from the passenger terminal' },
    ],
    base_appeal: 4,
    best_months: [4, 5, 7, 8, 9],
    image: {
      src: 'https://images.unsplash.com/photo-1761654887830-1a45f7a35ede?auto=format&fit=crop&crop=bottom&w=960&h=400&q=80',
      alt: 'Fishing boats and waterfront buildings in Tongyeong harbor',
      credit: 'Cecelia Chang / Unsplash',
      sourceUrl: 'https://unsplash.com/photos/boats-docked-in-a-harbor-with-buildings-and-mountains-wOid2J10iFI',
      licenseUrl: 'https://unsplash.com/license',
    },
    card_vibe: 'Southern harbor & islands',
    vibe: "Island ferries, seafood markets and hillside lanes around the harbor",
    recommended_stay: '1–2 days',
    live_weather_snapshot: 'This week · 14–21°C · clear',
    card_budget_level: '$',
    tags: ['coastal', 'nature', 'couple'],

    hero_summary:
      "A southern harbor city surrounded by islands. Ferries leave from the passenger terminal, and hillside lanes overlook the fishing port.",
    why: "Gangguan harbor and Jungang Market form a compact waterfront area. Dongpirang has hilltop views, while the Mireuksan cable car looks across the surrounding islands.",
    best_for:
      "Gangguan harbor, Dongpirang murals, Mireuksan views and ferries to nearby islands.",
    skip_if:
      "Long-distance access is by bus. Island visits depend on ferry schedules and weather.",
    travel_time: {
      from_seoul: '~4h 10m express bus',
      from_incheon_airport: '~5h limousine (via Jinju)',
      from_busan_station: '~1h 30m bus',
    },
    no_car_friendliness: 'Okay',
    local_movement:
      "The central dock area and Dongpirang Village are walkable. The cable car and outer island ferries are accessible by local bus or taxi.",
    car_recommended: false,
    seasonal_weather_context:
      "Spring and autumn are generally mild along the harbor. Summer is warm and humid. Oysters are associated with the cooler months; sea conditions can affect ferries throughout the year.",
    food: "Chungmu gimbap pairs plain rice rolls with spicy squid and radish. Harbor markets sell oysters and sea squirt, while kkulppang are honey-coated pastries.",
    detail_budget: {
      low: '~₩45,000–60,000/day',
      mid: '~₩85,000–120,000/day',
      high: '₩180,000+/day',
      notes: "Island ferries and the cable car add to daily spending. Seafood prices vary by dish and season.",
    },
    crowd_friction: 'Low',
    crowd_notes:
      "Spring blossom season and summer weekends bring more visitors to the harbor and cable car.",
    insider_tips: [
      "Dongpirang's mural lanes climb above the harbor and include steep sections.",
      "Check both outbound and return sailings for Somaemuldo before buying ferry tickets.",
      "Mireuksan cable-car operation depends on weather; check the operator's current notice.",
    ],
    similar_destinations: ['namhae', 'busan'],
    useful_links: [],
    crowd_peak_months: [10],
    trust: {
      travel_time: { source: 'estimate', confidence: 'medium', last_verified: '2026-07-17' },
      budget: { source: 'estimate', confidence: 'low', last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-07-11' },
    },
  },

  {
    slug: 'namhae',
    name: 'Namhae',
    hotspots: [
      { name: 'Boriam & Geumsan', note: 'Hillside hermitage with views over the southern coast' },
      { name: 'Darangee Village', note: 'terraced rice paddies dropping straight into the sea' },
      { name: 'German Village & Mulgeon', note: 'German-style houses and the coastal forest below' },
      { name: 'Sangju & Mijo', note: 'Sangju Beach and Mijo fishing port' },
    ],
    base_appeal: 3,
    best_months: [4, 5, 7, 8],
    image: {
      src: 'https://images.unsplash.com/photo-1750778183205-0d370b98de32?auto=format&fit=crop&w=800&q=80',
      alt: 'Boriam Hermitage temple eaves overlooking Namhae coast and islands',
      credit: 'Seungho Park-Lee / Unsplash',
      sourceUrl: 'https://unsplash.com/photos/a-temple-overlooks-a-lush-mountainous-landscape-bNEesEd5eHE',
      licenseUrl: 'https://unsplash.com/license',
    },
    card_vibe: 'Rice terraces & coastal roads',
    vibe: "Terraced fields, coastal villages and Boriam's hillside views",
    recommended_stay: '1–2 days',
    live_weather_snapshot: 'This week · 14–22°C · mostly clear',
    card_budget_level: '$',
    tags: ['coastal', 'nature', 'couple'],

    hero_summary:
      "A bridge-linked southern island with terraced fields, coastal villages and roads along the bays. Main stops are spread across the island.",
    why: "Darangee Village's terraces face the sea, Boriam overlooks the coast and Sangju has a sandy beach. Coastal roads link the island's villages and viewpoints.",
    best_for:
      "Darangee Village terraces, Boriam Hermitage, Sangju Beach and coastal drives.",
    skip_if:
      "Village buses are infrequent. Scattered viewpoints and coastal stops are easier to reach by car.",
    travel_time: {
      from_seoul: '~4h 30m intercity bus from Seoul Nambu',
      from_incheon_airport: '~6h (transfer in Seoul)',
      from_busan_station: '~2h+ bus',
    },
    no_car_friendliness: 'Hard',
    local_movement:
      "Buses connect the main villages but run infrequently. A car gives more direct access to coastal roads and viewpoints.",
    car_recommended: true,
    seasonal_weather_context:
      "Terraced fields change with the growing seasons. Spring and autumn are generally mild, summer is warm, and winter brings fewer beach visitors.",
    food: "Myeolchi ssambap pairs braised anchovies with leaf wraps. Grilled eel and dishes using Namhae garlic are also local specialties.",
    detail_budget: {
      low: '~₩50,000–65,000/day',
      mid: '~₩100,000–140,000/day',
      high: '₩200,000+/day',
      notes: "Car rental adds to daily spending. Village guesthouses and pensions vary in price by location and season.",
    },
    crowd_friction: 'Low',
    crowd_notes:
      "Spring visits and summer beach weekends bring more traffic. German Village also draws day visitors.",
    insider_tips: [
      "Boriam Hermitage overlooks the southern coast from the ridge.",
      "German Village and the Mulgeon coastal forest are separate nearby stops.",
      "The road between Namhae town and Sangju Beach follows sections of the coast.",
    ],
    similar_destinations: ['tongyeong', 'jeju'],
    useful_links: [],
    crowd_peak_months: [4, 7, 8, 10],
    trust: {
      travel_time: { source: 'estimate', confidence: 'medium', last_verified: '2026-07-17' },
      budget: { source: 'estimate', confidence: 'low', last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-07-11' },
    },
  },

  {
    slug: 'jirisan',
    name: 'Jirisan',
    hotspots: [
      { name: 'Nogodan & Seongsamjae', note: 'Ridge trail reached from Seongsamjae; check access and reservation notices' },
      { name: 'Cheonwangbong & Jungsan-ri', note: 'Summit routes from the eastern side of the mountain' },
      { name: 'Hwaeomsa & Gurye', note: 'Temple and town on the western side of the park' },
      { name: 'Ssanggyesa & Hwagae', note: 'the spring cherry-blossom road and Hadong tea country' },
      { name: 'Dulle-gil', note: 'Walking routes through foothills and villages' },
    ],
    base_appeal: 4,
    best_months: [5, 6, 9, 10, 11],
    image: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Korea-Mountain-Jirisan-07.jpg/960px-Korea-Mountain-Jirisan-07.jpg',
      alt: 'Autumn ridgeline of Jirisan National Park',
      credit: 'eimoberg / Wikimedia Commons · CC BY 2.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Korea-Mountain-Jirisan-07.jpg',
      licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
    },
    card_vibe: 'Mountain trails & valley temples',
    vibe: "High ridges, forest trails and temple towns across three provinces",
    recommended_stay: '3 days',
    live_weather_snapshot: 'This week · 8–17°C · clear, cool mornings',
    card_budget_level: '$',
    tags: ['mountain / hiking', 'nature', 'solo'],

    hero_summary:
      "A mountain park spanning three provinces, with high ridges, forest trails and valley temples. Routes range from foothill walks to multi-day ridge hikes.",
    why: "High ridge routes connect Nogodan and Cheonwangbong. Hwaeomsa, Ssanggyesa and the Dulle-gil paths provide lower-elevation walks around the park.",
    best_for:
      "Ridge hiking, forest paths, Hwaeomsa and Ssanggyesa temples, and foothill village walks.",
    skip_if:
      "Trailheads are far apart. Mountain routes need preparation, current access checks and shelter reservations for overnight stays.",
    travel_time: {
      from_seoul: '~3h KTX + bus',
      from_incheon_airport: '~5h (multiple transfers)',
      from_busan_station: '~1h 30m to Jinju + ~1h bus',
    },
    no_car_friendliness: 'Hard',
    local_movement:
      "Trail access is possible by bus from Gurye or Namwon but connections are infrequent. A car makes it easier to reach different trailheads and mountain towns.",
    car_recommended: true,
    seasonal_weather_context:
      "Spring brings wildflowers to lower slopes, while snow can remain higher up. Summer is green and wet; autumn brings foliage. Winter mountain routes require suitable equipment and current trail checks.",
    food: "Sanchae jeongsik is a set meal built around mountain greens. Towns around the park also serve black pork and, around Hadong, jaecheop clam soup.",
    detail_budget: {
      low: '~₩40,000–55,000/day',
      mid: '~₩80,000–110,000/day',
      high: '₩170,000+/day',
      notes: "Mountain shelters and village accommodation offer different facilities. Travel between trailheads adds to local transport costs.",
    },
    crowd_friction: 'Low',
    crowd_notes:
      "Autumn foliage and spring blossoms bring visitors to the trails and temple roads. Nogodan is busy on weekends.",
    insider_tips: [
      "The Nogodan–Cheonwangbong ridge traverse involves multiple days. Check route access and reserve mountain shelters before departure.",
      "Gurye and Namwon serve different sides of the park. Match the arrival town to the trailhead.",
      "Village markets sell seasonal mountain greens in spring.",
    ],
    similar_destinations: ['sokcho', 'namhae'],
    useful_links: [],
    crowd_peak_months: [3, 4, 10, 11], // spring blossom (Gurye/Hadong) + autumn foliage — visitor-data verified
    trust: {
      travel_time: { source: 'estimate', confidence: 'medium', last_verified: '2026-07-17' },
      budget: { source: 'estimate', confidence: 'low',    last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-07-11' },
    },
  },

  // ── Expansion v1.1 (docs/expansion-v1.1.md) ──────────────────────────────

  {
    slug: 'yeosu',
    name: 'Yeosu',
    hotspots: [
      { name: 'Pocha & Jongpo waterfront', note: 'the night harbor — seafood tents from evening, cable car overhead' },
      { name: 'Odongdo & Expo zone', note: 'camellia-island breakwater walk beside the old Expo grounds' },
      { name: 'Dolsan cafe belt', note: 'Cafés overlooking the sea from Dolsan Island' },
      { name: 'Hyangiram', note: 'Cliffside hermitage reached through boulders and stairways' },
      { name: 'Gosodong mural village', note: 'hillside lanes with the night-sea view over the harbor' },
    ],
    base_appeal: 6,
    best_months: [4, 5, 6, 7, 8, 9, 10],
    image: {
      src: 'https://images.unsplash.com/photo-1651375562199-65caae096ace?auto=format&fit=crop&w=800&q=80',
      alt: 'Yeosu harbor with cable cars crossing toward Dolsan Island',
      credit: 'Suzi Kim / Unsplash',
      sourceUrl: 'https://unsplash.com/photos/a-bridge-over-a-body-of-water-YRyD9WHMxLc',
      licenseUrl: 'https://unsplash.com/license',
    },
    card_vibe: 'Night sea & cable car',
    vibe: 'Harbor lights, cable-car views and seafood streets beside island bridges',
    recommended_stay: '1–2 days',
    live_weather_snapshot: 'This week · 14–22°C · mostly clear',
    card_budget_level: '$',
    tags: ['coastal', 'city', 'couple'],

    hero_summary:
      "A southern harbor city with island bridges, waterfront food stalls and a cable car crossing toward Dolsan. The harbor is illuminated after dark.",
    why: "The waterfront has evening walks and seafood restaurants. Odongdo adds an island path, while Dolsan has coastal cafés and Hyangiram Hermitage.",
    best_for:
      "Harbor night views, the marine cable car, Odongdo walks and seafood around Jongpo.",
    skip_if:
      "Dolsan's coastal stops extend beyond the central waterfront. Cable-car operation depends on weather.",
    travel_time: {
      from_seoul: '~3h KTX',
      from_incheon_airport: '~4h 20m+',
      from_busan_station: '~3h+ bus',
    },
    no_car_friendliness: 'Okay',
    local_movement:
      "The central waterfront, Odongdo and cable-car area connect by walking routes or taxi. City buses reach farther stops, including parts of Dolsan.",
    car_recommended: false,
    seasonal_weather_context:
      "Spring and autumn are generally mild; summer is humid. Winter waterfront walks can be windy. Sea conditions affect ferries and cable-car operation.",
    food: "Gejang baekban is a set meal with raw marinated crab. Other regional foods include gat kimchi made with mustard leaves and seodae-hoe, sole served with chili-vinegar seasoning. Waterfront pocha stalls serve seafood in the evening.",
    detail_budget: {
      low: '~₩50,000–65,000/day',
      mid: '~₩95,000–135,000/day',
      high: '₩200,000+/day',
      notes: "Budget-friendly outside summer weekends. Waterfront hotels charge a premium for night-view rooms.",
    },
    crowd_friction: 'Medium',
    crowd_peak_months: [10],
    crowd_notes:
      "Summer weekends and holiday evenings bring crowds to the waterfront and cable car. Weeknights generally have fewer visitors.",
    insider_tips: [
      "The cable car overlooks the harbor; check the last departure and weather notices before visiting.",
      "Odongdo is reached along a breakwater and has camellias that flower around early spring.",
      "Check the menu price and serving size when ordering seafood set meals.",
    ],
    similar_destinations: ['tongyeong', 'busan', 'namhae'],
    useful_links: [],
    trust: {
      travel_time: { source: 'estimate', confidence: 'medium', last_verified: '2026-07-17' },
      budget: { source: 'estimate', confidence: 'low', last_verified: '2026-07-11' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-07-11' },
    },
  },

  {
    slug: 'andong',
    name: 'Andong',
    hotspots: [
      { name: 'Hahoe & Buyongdae', note: 'Riverside folk village and a viewpoint across the river bend' },
      { name: 'Woryeonggyo area', note: 'Wooden footbridge illuminated after dark' },
      { name: 'Gu Market jjimdak alley', note: 'Market restaurants serving Andong braised chicken' },
      { name: 'Dosan Seowon area', note: 'the Confucian academy landscape upriver' },
    ],
    base_appeal: 5,
    best_months: [4, 5, 9, 10],
    image: {
      src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Hahoe_Folk_Village_03.jpg/960px-Hahoe_Folk_Village_03.jpg',
      alt: 'Thatched and tiled houses in Hahoe Folk Village, Andong',
      credit: 'Bernard Gagnon / Wikimedia Commons · CC0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Hahoe_Folk_Village_03.jpg',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
    card_vibe: 'Hahoe village & mask dance',
    vibe: "A riverside folk village, mask-dance traditions and Confucian academies",
    recommended_stay: '1–2 days',
    live_weather_snapshot: 'This week · 11–21°C · clear',
    card_budget_level: '$',
    tags: ['history / traditional', 'solo'],

    hero_summary:
      "Hahoe is a UNESCO-listed village beside a river bend, with traditional homes still in use. Andong also has mask-dance traditions and Confucian academies.",
    why: "Hahoe's lanes pass traditional homes, with Buyongdae overlooking the river and village. Dosan Seowon and Woryeonggyo Bridge are separate stops outside the village.",
    best_for:
      "Hahoe Folk Village, mask-dance performances, Dosan Seowon and Woryeonggyo Bridge.",
    skip_if:
      "Hahoe, Dosan Seowon and central Andong are spread out. Check return buses and current performance times.",
    travel_time: {
      from_seoul: '~2h KTX-Eum',
      from_incheon_airport: 'Airport bus; check departures, or travel via Seoul',
      from_busan_station: '~2h 30m bus',
    },
    no_car_friendliness: 'Okay',
    local_movement:
      "Bus 210 connects Andong Station and Hahoe Village. For the train back, board the 210 toward Kyobo Life at the village stop (하회마을, 540854) and get off at 안동역(안동터미널). Woryeonggyo-bound branches of bus 112 leave from the old downtown station.",
    car_recommended: false,
    seasonal_weather_context:
      "Spring is generally mild and dry, summer is hot, and autumn is cooler. Winter is cold and dry. Check the current mask-dance festival dates separately.",
    food: "Andong jjimdak is braised chicken served in the old market. Heotjesabap, a meal based on ceremonial dishes, and salted mackerel are other regional specialties.",
    detail_budget: {
      low: '~₩45,000–60,000/day',
      mid: '~₩85,000–120,000/day',
      high: '₩170,000+/day',
      notes: "Hanok stays inside Hahoe can cost more than rooms in town. Festival dates can affect room rates and availability.",
    },
    crowd_friction: 'Low',
    crowd_peak_months: [10, 11],
    crowd_notes:
      "Hahoe receives day-trip groups, especially around midday on weekends. The mask-dance festival brings additional visitors; dates vary by year.",
    insider_tips: [
      "Hahoe is residential. Respect private homes and check the arrangements for village guesthouses.",
      "Buyongdae overlooks the river bend and village. Check current access separately from the Hahoe village entrance.",
      "Woryeonggyo Bridge is illuminated after dark; return transport needs a separate check from Hahoe.",
    ],
    similar_destinations: ['gyeongju', 'jeonju'],
    useful_links: [],
    trust: {
      travel_time: { source: 'estimate', confidence: 'medium', last_verified: '2026-07-17' },
      budget: { source: 'estimate', confidence: 'low', last_verified: '2026-07-11' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-07-11' },
    },
  },

  {
    slug: 'suwon',
    name: 'Suwon',
    hotspots: [
      { name: 'Haenggung-dong', note: 'Cafés and mural lanes around Hwaseong Haenggung Palace' },
      { name: 'Hwaseong wall walk', note: 'Fortress walls, gates and towers across the hillside' },
      { name: 'Tongdak street', note: 'old-school whole fried chicken by Paldalmun gate' },
      { name: 'Nammun Market', note: 'Connected markets around the south gate' },
    ],
    base_appeal: 5,
    best_months: [4, 5, 6, 9, 10, 11],
    image: {
      src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Hwaseong_Fortress_01.jpg/960px-Hwaseong_Fortress_01.jpg',
      alt: 'Hwaseong Fortress walls curving toward a watchtower in Suwon',
      credit: 'Bernard Gagnon / Wikimedia Commons · CC0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Hwaseong_Fortress_01.jpg',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
    card_vibe: 'Fortress walls & food streets',
    vibe: 'Hwaseong fortress walls, palace courtyards and market food streets',
    recommended_stay: '1–2 days',
    live_weather_snapshot: 'This week · 13–22°C · partly cloudy',
    card_budget_level: '$',
    tags: ['history / traditional', 'city'],

    hero_summary:
      "A city south of Seoul with the UNESCO-listed Hwaseong Fortress. Walls and towers rise above palace courtyards, markets and food streets.",
    why: "The fortress wall connects gates and hilltop views. Below it, Haenggung-dong has cafés and murals, and the markets around Paldalmun have food stalls and fried-chicken restaurants.",
    best_for:
      "Hwaseong wall walks, Haenggung Palace, Haenggung-dong cafés and the fried-chicken street.",
    skip_if:
      "Suwon Station needs an onward bus or taxi to the fortress area. Wall sections include slopes and exposed paths.",
    travel_time: {
      from_seoul: '~30m train · ~1h subway to Suwon Station',
      from_incheon_airport: '~1h 30m',
      from_busan_station: '~2h 40m KTX',
    },
    no_car_friendliness: 'Easy',
    local_movement:
      "Trains and subways arrive at Suwon Station, with onward buses or taxis to Paldalmun and the fortress area. Wall walks include slopes and stairs.",
    car_recommended: false,
    seasonal_weather_context:
      "Spring and autumn are generally mild. Exposed wall sections are hot in summer and cold in winter, with little shelter from wind.",
    food: "Suwon wanggalbi is grilled beef ribs. Tongdak golmok near the market area has restaurants serving whole fried chicken.",
    detail_budget: {
      low: '~₩45,000–60,000/day',
      mid: '~₩90,000–120,000/day',
      high: '₩180,000+/day',
      notes: "The daily range includes accommodation. Beef-rib meals generally cost more than market food or fried chicken.",
    },
    crowd_friction: 'Medium',
    crowd_peak_months: [], // visitor data: flat year-round (metro city)
    crowd_notes:
      "Spring blossoms and autumn weekends bring day-trip crowds to the wall and Haenggung palace square. Weekday mornings are quiet along most of the loop.",
    insider_tips: [
      "The wall section above Paldalmun involves a climb. Check the route map before choosing a starting gate.",
      "Yeonmudae offers an archery activity; check current operating times and ticket availability.",
      "The palace square is illuminated in the evening. Check current access hours for palace interiors and paid sites separately.",
    ],
    similar_destinations: ['seoul', 'gyeongju'],
    useful_links: [],
    trust: {
      travel_time: { source: 'estimate', confidence: 'medium', last_verified: '2026-07-17' },
      budget: { source: 'estimate', confidence: 'low', last_verified: '2026-07-11' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-07-11' },
    },
  },

  {
    slug: 'chuncheon',
    name: 'Chuncheon',
    hotspots: [
      { name: 'Nami Island', note: 'in Chuncheon, with the mainland gateway at Gapyeong — check the ferry or zipwire before visiting' },
      { name: 'Soyanggang Skywalk area', note: 'glass walkway out over the lake' },
      { name: 'Dakgalbi alley', note: 'Restaurants specializing in spicy stir-fried chicken' },
      { name: 'Uiamho lake path', note: 'Lakeside walking and cycling paths' },
      { name: 'Gimyujeong & Gangchon', note: 'Rail-bike routes along the former railway' },
    ],
    base_appeal: 4,
    best_months: [4, 5, 6, 9, 10],
    image: {
      src: 'https://images.unsplash.com/photo-1644765662414-19212b854c64?auto=format&fit=crop&w=800&q=80',
      alt: 'Tree-lined walking path on Nami Island near Chuncheon',
      credit: 'Daniel Bernard / Unsplash',
      sourceUrl: 'https://unsplash.com/photos/a-group-of-people-walking-down-a-tree-lined-street-7oberiN-Ocs',
      licenseUrl: 'https://unsplash.com/license',
    },
    card_vibe: 'Lakes & Nami Island',
    vibe: 'Lakeside paths, Nami Island tree lanes and dakgalbi restaurants',
    recommended_stay: '1–2 days',
    live_weather_snapshot: 'This week · 11–21°C · clear',
    card_budget_level: '$',
    tags: ['nature', 'couple'],

    hero_summary:
      "A lake city surrounded by mountains, with lakeside paths and dakgalbi restaurants. Nami Island is reached through a separate mainland gateway at Gapyeong.",
    why: "Uiamho has lakeside paths, the city center has dakgalbi restaurants, and Nami Island has tree-lined walks. These stops use different arrival points and local connections.",
    best_for:
      "Uiamho lakeside paths, dakgalbi restaurants, Nami Island walks and rail-bike routes.",
    skip_if:
      "Nami Island and central Chuncheon use different station connections. Island access includes a separate crossing.",
    travel_time: {
      from_seoul: '~1h 10m ITX from Yongsan',
      from_incheon_airport: '~2h 30m bus',
      from_busan_station: '~4h 30m+ (KTX + ITX)',
    },
    no_car_friendliness: 'Easy',
    local_movement:
      "ITX trains serve Chuncheon and Gapyeong. For Nami Island, continue from Gapyeong to the mainland gateway and check the crossing. Central Chuncheon and lakeside stops need local buses or taxis.",
    car_recommended: false,
    seasonal_weather_context:
      "Spring brings new leaves and autumn brings foliage to the lakeside and island paths. Summer is humid; winters are cold, with possible snow and icy surfaces.",
    food: "Dakgalbi is spicy stir-fried chicken cooked with vegetables. Myeongdong Dakgalbi Street has specialist restaurants. Makguksu, cold buckwheat noodles, is another regional dish.",
    detail_budget: {
      low: '~₩45,000–60,000/day',
      mid: '~₩90,000–120,000/day',
      high: '₩170,000+/day',
      notes: "Nami Island admission and optional activities add to the daily total. Lakeside accommodation rates vary by season.",
    },
    crowd_friction: 'Medium',
    crowd_peak_months: [10, 11],
    crowd_notes:
      "Nami Island is busy on weekends and holidays, especially in spring and autumn foliage season. Weekday mornings generally have fewer visitors.",
    insider_tips: [
      "Check Nami Island's current crossing times and return departure before traveling to the gateway.",
      "Uiamho has lakeside cycling paths; check the route and rental return arrangements.",
      "Gangchon rail-bike routes have their own departure points and booked time slots.",
    ],
    similar_destinations: ['gangneung', 'sokcho'],
    useful_links: [],
    trust: {
      travel_time: { source: 'estimate', confidence: 'medium', last_verified: '2026-07-17' },
      budget: { source: 'estimate', confidence: 'low', last_verified: '2026-07-11' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-07-11' },
    },
  },

  {
    slug: 'damyang-boseong',
    name: 'Damyang & Boseong',
    hotspots: [
      { name: 'Juknokwon & noodle street', note: 'Bamboo walking paths and riverside noodle restaurants' },
      { name: 'Metasequoia road & Meta Provence', note: 'Tree-lined paths and a nearby village of cafés and shops' },
      { name: 'Daehan Dawon', note: 'Terraced tea fields with walking paths up the slope' },
      { name: 'Yulpo', note: 'Beach and green-tea seawater bathhouse' },
      { name: 'Changpyeong slow city', note: 'Hanok lanes bordered by stone walls' },
    ],
    base_appeal: 4,
    best_months: [4, 5, 6, 7],
    image: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Boseong_Green_Tea_Field_South_Korea_Travel_Photography_%28253061695%29.jpeg/1280px-Boseong_Green_Tea_Field_South_Korea_Travel_Photography_%28253061695%29.jpeg',
      alt: 'Sunlight over the terraced green tea fields of Boseong',
      credit: 'Giuseppe Milo / Wikimedia Commons · CC BY 3.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Boseong_Green_Tea_Field_South_Korea_Travel_Photography_(253061695).jpeg',
      licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    },
    card_vibe: 'Bamboo & green tea',
    vibe: "Bamboo forests and terraced green tea fields — South Jeolla's garden landscapes",
    recommended_stay: '1–2 days',
    live_weather_snapshot: 'This week · 13–22°C · mostly clear',
    card_budget_level: '$',
    tags: ['nature', 'couple'],

    hero_summary:
      "Two separate South Jeolla counties: Damyang has bamboo paths and gardens, while Boseong has terraced tea fields. Travel between them needs a separate journey.",
    why: "Juknokwon's paths run through bamboo, and Daehan Dawon's paths climb between tea rows. Damyang also has a tree-lined road and traditional village lanes.",
    best_for:
      "Juknokwon bamboo paths, Damyang's tree-lined road and Boseong's tea terraces.",
    skip_if:
      "Damyang and Boseong are separate counties. Rural bus connections between them are limited; a car makes the journey more direct.",
    travel_time: {
      from_seoul: '~3h KTX + bus',
      from_incheon_airport: '~5h+ (limousine to Gwangju)',
      from_busan_station: '~3h 40m (bus + transfer)',
    },
    no_car_friendliness: 'Hard',
    local_movement:
      "Buses reach Juknokwon and the tea plantations via Gwangju and Boseong-eup. Connections between Damyang and Boseong are slow; check each leg and the return service separately.",
    car_recommended: true,
    seasonal_weather_context:
      "Tea fields have fresh growth in spring and early summer. Bamboo paths provide shade, though summer is still humid. Autumn is generally mild; any winter evening events need a current schedule check.",
    food: "Damyang is known for tteok-galbi, grilled short-rib patties, and daetongbap, rice steamed in bamboo. Boseong cafés serve green tea, tea-flavored noodles and ice cream.",
    detail_budget: {
      low: '~₩45,000–60,000/day',
      mid: '~₩85,000–120,000/day',
      high: '₩170,000+/day',
      notes: "Travel between the two counties adds transport costs. Car rental is separate from the daily accommodation-and-meals estimate.",
    },
    crowd_friction: 'Low',
    crowd_peak_months: [10, 11],
    crowd_notes:
      "Spring weekends and green-tea festival dates bring more visitors to Daehan Dawon. Check current festival dates separately.",
    insider_tips: [
      "Daehan Dawon's paths climb through the tea terraces; check opening hours before arrival.",
      "Juknokwon's bamboo paths and Damyang's riverside noodle street are nearby stops.",
      "Metasequoia Road is separate from Juknokwon. Check local transport or parking for each stop.",
    ],
    similar_destinations: ['jeonju', 'namhae'],
    useful_links: [],
    trust: {
      travel_time: { source: 'estimate', confidence: 'medium', last_verified: '2026-07-17' },
      budget: { source: 'estimate', confidence: 'low', last_verified: '2026-07-11' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-07-11' },
    },
  },
]

export function getDestinationBySlug(slug: string): Destination | undefined {
  return destinations.find((d) => d.slug === slug)
}
