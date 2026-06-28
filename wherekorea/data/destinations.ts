import type { Destination } from './types'

// live_weather_snapshot is static seed for internal development.
// Real 7-day weather integration replaces these values before public ship.
// Format: "This week · {temp range} · {condition}" per data-policy.md

export const destinations: Destination[] = [
  {
    slug: 'seoul',
    name: 'Seoul',
    image: {
      src: 'https://images.unsplash.com/photo-1758509444769-95567facc5b0?auto=format&fit=crop&w=800&q=80',
      alt: 'Seoul cityscape with Namsan Tower at night',
    },
    card_vibe: 'Urban anchor',
    vibe: "Korea's urban anchor — neighborhoods, food markets, and palace history all within subway distance",
    recommended_stay: '4+ days',
    live_weather_snapshot: 'This week · 13–21°C · partly cloudy',
    card_budget_level: '$$',
    tags: ['city', 'history / traditional'],

    hero_summary:
      "Korea's capital and primary gateway. The most layered city in the country — history, food, and contemporary culture within subway distance of each other.",
    why: "The most efficient place to start a Korea trip. Everything connects from here by KTX, bus, or budget flight. The city rewards depth and punishes rushing — plan for more time than you think you need.",
    best_for:
      "First-time visitors, urban explorers, food-driven travel, and anyone using Korea as a base for day trips or onward connections.",
    skip_if:
      "You want quiet, nature, or a slow pace. Seoul rewards effort but does not offer rest.",
    travel_time: {
      from_seoul: '—',
      from_incheon_airport: '~1h by AREX train',
      from_busan_station: '~2h 15m KTX',
    },
    no_car_friendliness: 'Easy',
    local_movement:
      "One of the best subway systems in the world. All major traveler areas are well connected and walkable. A T-money card covers everything.",
    car_recommended: false,
    seasonal_weather_context:
      "Typical in April: mild days 15–21°C, cool evenings, low rain. Cherry blossoms peak late March to mid-April. May is warm and dry. Summer (July–August) is hot and humid.",
    food: "Street food at Gwangjang and Namdaemun markets, Korean BBQ in Mapo, raw seafood towers at Noryangjin. Eating well here is easy and cheap across every price point.",
    detail_budget: {
      low: '~₩60,000–80,000/day',
      mid: '~₩130,000–180,000/day',
      high: '₩300,000+/day',
      notes:
        "Budget range is wide. Guesthouses and convenience store meals keep costs low. Mid includes a mid-range hotel and restaurant meals.",
    },
    crowd_friction: 'High',
    crowd_notes:
      "Peak weekends and national holidays push major tourist areas hard. Hongdae, Insadong, and Bukchon are busiest. Most major palaces have entry queues on weekends.",
    insider_tips: [
      "Gyeongbokgung Palace is quieter midweek. Bukchon Hanok Village is best explored before 9am.",
      "The Han River parks (Yeouido, Banpo) are almost entirely local — a good option for a quiet afternoon away from tourist circuits.",
      "Euljiro 3-ga area for late-night drinking with an authentic mix of old workshop culture and young crowds.",
    ],
    similar_destinations: ['busan', 'jeonju'],
    useful_links: [],
    crowd_peak_months: [4, 5, 10],
    trust: {
      budget: { source: 'estimate', confidence: 'medium', last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-06-28' },
    },
  },

  {
    slug: 'busan',
    name: 'Busan',
    image: {
      src: 'https://images.unsplash.com/photo-1538574027501-286b64ee38f8?auto=format&fit=crop&w=800&q=80',
      alt: 'Gamcheon Culture Village colorful hillside houses, Busan',
    },
    card_vibe: 'Coastal city energy',
    vibe: "Coastal city energy — beaches, raw seafood markets, and a looser pace than Seoul",
    recommended_stay: '3 days',
    live_weather_snapshot: 'This week · 14–20°C · mostly clear',
    card_budget_level: '$$',
    tags: ['coastal', 'city'],

    hero_summary:
      "Korea's second city, built around a harbor. Coastal energy, fresh seafood, and a strong local identity that feels meaningfully different from Seoul.",
    why: "Best if you want coastal city character without the full mainland feel. Busan has its own food culture, its own pace, and a harbor-facing identity. The KTX from Seoul makes it a viable 2-night extension of almost any Korea itinerary.",
    best_for:
      "Coastal city contrast with Seoul, seafood lovers, beach time in summer, and travelers who want a strong second city on a Korea trip.",
    skip_if:
      "You want wilderness or deep history. Busan is urban and coastal — not a heritage destination.",
    travel_time: {
      from_seoul: '~2h 15m KTX',
      from_incheon_airport: '~2h 45m KTX',
      from_busan_station: '—',
    },
    no_car_friendliness: 'Easy',
    local_movement:
      "Subway connects all major traveler areas: Haeundae, Seomyeon, BIFF Square, Nampo-dong. Most districts are walkable once you arrive.",
    car_recommended: false,
    seasonal_weather_context:
      "Typical in April: mild and clear, 14–20°C, lower humidity than summer. Spring and autumn are the best seasons. Summer beach season (July–August) is very crowded.",
    food: "Jagalchi fish market for raw seafood and hwe. Milmyeon (cold noodles) and ssiat hotteok (seed-filled pancake) as local snacks. Seomyeon for late-night pork belly streets.",
    detail_budget: {
      low: '~₩55,000–75,000/day',
      mid: '~₩120,000–160,000/day',
      high: '₩250,000+/day',
      notes:
        "Slightly cheaper than Seoul overall. Beach-area accommodation spikes in summer.",
    },
    crowd_friction: 'Medium',
    crowd_notes:
      "Haeundae beach is extremely crowded in July–August. Spring and autumn are much more pleasant. Gwangalli and Nampo are busy year-round on weekends.",
    insider_tips: [
      "Gamcheon Culture Village is photogenic but gets crowded by midday. Early morning or a weekday visit is much better.",
      "Gwangalli bridge view from the beach at night is arguably better than Haeundae — and less crowded.",
      "Busan is the better base if you plan to visit Gyeongju — a 40-minute KTX ride away.",
    ],
    similar_destinations: ['seoul', 'tongyeong', 'gyeongju'],
    useful_links: [],
    crowd_peak_months: [7, 8],
    trust: {
      budget: { source: 'estimate', confidence: 'medium', last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-06-28' },
    },
  },

  {
    slug: 'jeju',
    name: 'Jeju',
    image: {
      src: 'https://images.unsplash.com/photo-1749382871869-4c8dcaa4a540?auto=format&fit=crop&w=800&q=80',
      alt: 'Jeju black volcanic lava rock meets the ocean',
    },
    card_vibe: 'Island escape',
    vibe: "Island escape — volcanic scenery, ocean roads, and a pace that only works with a rental car",
    recommended_stay: '4+ days',
    live_weather_snapshot: 'This week · 13–19°C · breezy, dry',
    card_budget_level: '$$$',
    tags: ['coastal', 'nature', 'couple'],

    hero_summary:
      "Korea's main island escape. Volcanic craters, coast roads, haenyeo seafood, and a slower pace — best explored with a rental car.",
    why: "The only destination in Korea where you can genuinely leave the mainland rhythm behind. The landscape is distinct, the food culture is its own, and the island rewards a slow itinerary. Cannot be done properly without a car.",
    best_for:
      "Nature travel, couples, hiking Hallasan, anyone wanting to leave the mainland behind, or road-trip style itineraries.",
    skip_if:
      "You can't or won't rent a car. Public transport covers some areas but misses too much to make a Jeju trip worthwhile.",
    travel_time: {
      from_seoul: '~1h flight from Gimpo Airport',
      from_incheon_airport: '~1h flight',
      from_busan_station: '~1h flight from Gimhae Airport',
    },
    no_car_friendliness: 'Hard',
    local_movement:
      "Buses connect Jeju City to main towns but are slow and infrequent outside the city. A rental car opens the island fully. Taxis are an option but expensive for full-day exploration.",
    car_recommended: true,
    seasonal_weather_context:
      "Typical in April: warm and pleasant, 13–19°C, ocean breezes. Yellow canola fields peak in late March to early April. Summer is humid. Autumn (October) brings clear skies and comfortable hiking weather.",
    food: "Black pork (heuk dwaeji) is the local specialty — better at smaller restaurants away from tourist strips. Haenyeo-caught seafood near Seongsan. Hallabong citrus and green tea products are genuinely worth bringing home.",
    detail_budget: {
      low: '~₩75,000–95,000/day',
      mid: '~₩150,000–190,000/day',
      high: '₩350,000+/day',
      notes:
        "Car rental adds a meaningful daily cost on top of this. Accommodation near Seongsan or the south coast is pricier than Jeju City.",
    },
    crowd_friction: 'High',
    crowd_notes:
      "Extremely crowded during Korean holidays and summer. Sunrise peak at Seongsan Ilchulbong can mean 6am queues. Hallasan summit permits for the main routes sell out quickly.",
    insider_tips: [
      "Book Hallasan summit permits (Seongpanak or Gwaneumsa routes) well in advance — they fill up.",
      "The east coast (Seongsan, Udo Island) is the most scenic part of the island but also the most crowded. Arrive early.",
      "Manjanggul lava tube is often overlooked by first-timers and is genuinely impressive — plan 1.5 hours.",
    ],
    similar_destinations: ['namhae', 'tongyeong'],
    useful_links: [],
    crowd_peak_months: [7, 8],
    trust: {
      budget: { source: 'estimate', confidence: 'medium', last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-06-28' },
    },
  },

  {
    slug: 'gyeongju',
    name: 'Gyeongju',
    image: {
      src: 'https://images.unsplash.com/photo-1748274035731-32c83e10661e?auto=format&fit=crop&w=800&q=80',
      alt: 'Tumuli Park burial mounds in green park, Gyeongju',
    },
    card_vibe: 'Open-air history',
    vibe: "Open-air history — royal Silla burial mounds, Buddhist temples, and a calm heritage pace",
    recommended_stay: '1–2 days',
    live_weather_snapshot: 'This week · 12–20°C · clear',
    card_budget_level: '$',
    tags: ['history / traditional', 'nature', 'couple'],

    hero_summary:
      "The ancient Silla capital. More open-air museum than city — royal burial mounds, Buddhist cave carvings, and a pace that rewards slow walking.",
    why: "The most concentrated historic site density in Korea. The Silla kingdom left behind burial mounds, pagodas, and carved Buddhas within a small city grid. Best as a day trip from Busan or a deliberate overnight.",
    best_for:
      "History-focused travelers, cycling around the burial mounds, a day trip or overnight from Busan, or a quiet cultural break.",
    skip_if:
      "You need urban energy or coastal access. Gyeongju is quiet, inland, and slow-paced.",
    travel_time: {
      from_seoul: '~2h KTX to Singyeongju Station',
      from_incheon_airport: '~3h KTX',
      from_busan_station: '~40m KTX',
    },
    no_car_friendliness: 'Okay',
    local_movement:
      "Tumuli Park and the city center are walkable. Bulguksa Temple and Seokguram Grotto require a bus or taxi — manageable but not seamless.",
    car_recommended: false,
    seasonal_weather_context:
      "Typical in April: clear and mild, ideal for outdoor sites. Cherry blossoms at Bomun Lake and along the Gyeongju stream peak late March to mid-April. Summer is hot and can be humid.",
    food: "Ssambap (rice and vegetables wrapped in leaves) is the local specialty. Gyeongju bread (hwangnam ppang — red bean pastry) as a souvenir snack. Modest dining city — budget-friendly across the board.",
    detail_budget: {
      low: '~₩45,000–60,000/day',
      mid: '~₩90,000–130,000/day',
      high: '₩200,000+/day',
      notes: "One of the cheaper destinations in this set. Most sites have low entry fees or are free.",
    },
    crowd_friction: 'Medium',
    crowd_notes:
      "Cherry blossom season (late March–April) brings significant crowds to Bomun Lake and Tumuli Park. National holidays spike attendance at Bulguksa. Otherwise manageable.",
    insider_tips: [
      "Cheomseongdae observatory and Tumuli Park are best at dusk — the light on the mounds is striking and crowds thin out.",
      "Yangdong Folk Village is 20 minutes away and often empty — a more authentic experience than the main city circuit.",
      "Most major sites cluster within cycling distance of each other. Renting a bike at the station is the best way to cover them.",
    ],
    similar_destinations: ['jeonju', 'busan'],
    useful_links: [],
    crowd_peak_months: [4, 10],
    trust: {
      budget: { source: 'estimate', confidence: 'medium', last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-06-28' },
    },
  },

  {
    slug: 'jeonju',
    name: 'Jeonju',
    image: {
      src: 'https://images.unsplash.com/photo-1653230675261-fe00bde32c8e?auto=format&fit=crop&w=800&q=80',
      alt: 'Aerial view of Jeonju Hanok Village traditional tiled rooftops',
    },
    card_vibe: 'Hanok village & bibimbap',
    vibe: "Hanok village, bibimbap origin, and a short-stay cultural hit that rewards one night",
    recommended_stay: '1–2 days',
    live_weather_snapshot: 'This week · 12–21°C · dry',
    card_budget_level: '$',
    tags: ['history / traditional', 'solo'],

    hero_summary:
      "A compact cultural city anchored by its preserved hanok village. Best known for bibimbap and a walkable, food-rich center that rewards a one-night stay.",
    why: "Worth it for the food alone. The bibimbap here is genuinely different from everywhere else — stone bowl, local ingredients, proper accompaniments. The hanok village is preserved rather than reconstructed, and the overnight atmosphere after day-trippers leave is much better than the daytime tourist traffic suggests.",
    best_for:
      "Food-focused travel, hanok overnight experience, day trip from Seoul or Busan, or a short cultural break between bigger cities.",
    skip_if:
      "You're looking for more than 2 days of content. The main circuit gets done fast and there is not much beyond it.",
    travel_time: {
      from_seoul: '~1h 40m KTX',
      from_incheon_airport: '~2h 30m',
      from_busan_station: '~1h 30m KTX',
    },
    no_car_friendliness: 'Easy',
    local_movement:
      "The hanok village and city center are entirely walkable. All main traveler attractions are within easy walking distance of each other.",
    car_recommended: false,
    seasonal_weather_context:
      "Typical in April: mild and dry, 12–21°C. One of the better seasons — not too hot, not crowded with summer travelers. The hanok village gardens are at their best in spring.",
    food: "Jeonju bibimbap in the proper stone bowl at dozens of local restaurants near the hanok village. Makgeolli (rice wine) is cheap and widely available. The street food strip along the main hanok alley is the most fun way to eat here.",
    detail_budget: {
      low: '~₩45,000–60,000/day',
      mid: '~₩90,000–120,000/day',
      high: '₩180,000+/day',
      notes:
        "Budget-friendly destination. Staying inside the hanok village costs more but is a meaningfully different experience.",
    },
    crowd_friction: 'Medium',
    crowd_notes:
      "Hanok village weekends are noticeably crowded, especially in spring and autumn. Weekdays are significantly quieter. Day-trippers from Seoul clear out by evening.",
    insider_tips: [
      "Stay inside the hanok village if budget allows. The evening atmosphere after day-trippers leave is the best version of Jeonju.",
      "Nambu Market is a short walk from the hanok village and much less touristy — better for a genuine local market experience.",
      "Omokdae hilltop park above the village has a good overview and almost no visitors.",
    ],
    similar_destinations: ['gyeongju', 'busan'],
    useful_links: [],
    crowd_peak_months: [5, 10],
    trust: {
      budget: { source: 'estimate', confidence: 'low', last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'low', last_verified: '2026-06-28' },
    },
  },

  {
    slug: 'gangneung',
    name: 'Gangneung',
    image: {
      src: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=800&q=80',
      alt: 'Gangneung east coast shoreline with breaking waves',
    },
    card_vibe: 'East coast & café culture',
    vibe: "East coast cafés, clean beaches, and a fast KTX hop from Seoul",
    recommended_stay: '1–2 days',
    live_weather_snapshot: 'This week · 11–19°C · clear',
    card_budget_level: '$$',
    tags: ['coastal', 'nature', 'couple'],

    hero_summary:
      "The east coast's most accessible city. Clean beaches, a serious café culture, and an easy KTX connection from Seoul that makes it a viable long-weekend trip.",
    why: "The fastest way to reach Korea's east coast from Seoul. The café culture here has built a genuine scene rather than just copying Seoul trends. Combine Gyeongpo Lake, Anmok Beach coffee street, and Jumunjin port and one night covers it well.",
    best_for:
      "Short east coast trip, café-focused travel, beach time, or a long weekend base for exploring the surrounding coast.",
    skip_if:
      "You want rugged nature or serious hiking. Gangneung is coastal and café-oriented — Sokcho is the better choice for that.",
    travel_time: {
      from_seoul: '~1h 30m KTX',
      from_incheon_airport: '~2h 30m KTX',
      from_busan_station: '~3h KTX',
    },
    no_car_friendliness: 'Okay',
    local_movement:
      "City buses reach Gyeongpo Beach and the main café district, but connections are slow. A taxi or rental car makes exploring the coast easier.",
    car_recommended: false,
    seasonal_weather_context:
      "Typical in April: east coast spring, 11–19°C, clean air, low rain. Good beach weather starts June. Summer is popular but crowded. Autumn is excellent for coastal walks.",
    food: "Ojingeo (grilled squid) at Jumunjin port strip. Chodang tofu — silken tofu made with seawater, a genuine Gangneung specialty. Coffee is a serious local pursuit — the Anmok Beach café strip is worth the trip on its own.",
    detail_budget: {
      low: '~₩55,000–70,000/day',
      mid: '~₩120,000–160,000/day',
      high: '₩250,000+/day',
      notes: "Accommodation near the beach costs more. Mid-range options in the city center are better value.",
    },
    crowd_friction: 'Medium',
    crowd_notes:
      "Summer beach season (July–August) is very crowded. Gyeongpo Lake cherry blossom season brings day-trippers from Seoul. Weekends are consistently busy year-round.",
    insider_tips: [
      "Anmok Beach coffee street is more interesting than the central cafés — a longer strip with more variety and better atmosphere.",
      "Jumunjin port is 20 minutes north and has a better raw seafood atmosphere than the central market.",
      "The KTX makes this a viable overnight trip from Seoul on a Friday evening — no car needed for the core circuit.",
    ],
    similar_destinations: ['sokcho'],
    useful_links: [],
    crowd_peak_months: [7, 8],
    trust: {
      budget: { source: 'estimate', confidence: 'low',    last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-06-28' },
    },
  },

  {
    slug: 'sokcho',
    name: 'Sokcho',
    image: {
      src: 'https://images.unsplash.com/photo-1547690395-5adca25d2ae3?auto=format&fit=crop&w=800&q=80',
      alt: 'Seoraksan National Park mountain ridges, Sokcho',
    },
    card_vibe: 'Seoraksan & market seafood',
    vibe: "Market seafood, Seoraksan trailheads, and a wilder east coast feel than Gangneung",
    recommended_stay: '3 days',
    live_weather_snapshot: 'This week · 10–18°C · clear',
    card_budget_level: '$$',
    tags: ['coastal', 'mountain / hiking', 'nature'],

    hero_summary:
      "A smaller east coast city with a strong market character, direct access to Seoraksan National Park, and less polish than Gangneung.",
    why: "For travelers who want east coast with more edge. The Abai Village market, the Seoraksan trailhead access, and the rawer port atmosphere set it apart from Gangneung. A better base if hiking is the primary reason you are going east.",
    best_for:
      "Hiking Seoraksan, east coast road trips, seafood market culture, or anyone wanting more substance than cafés and beaches.",
    skip_if:
      "You want beaches and cafés over mountains and markets. Gangneung is the better choice for that.",
    travel_time: {
      from_seoul: '~2h 30m express bus from Seoul Express Bus Terminal',
      from_incheon_airport: '~3h bus',
      from_busan_station: '~4h 30m',
    },
    no_car_friendliness: 'Okay',
    local_movement:
      "Buses reach Seoraksan park entrance and the main market area. Getting around the wider coast without a car is slower but manageable for the core circuit.",
    car_recommended: false,
    seasonal_weather_context:
      "Typical in April: cool east coast spring, 10–17°C. Mountain trails at Seoraksan open fully as snow clears. Autumn (October) is the best season — foliage on the trails is exceptional.",
    food: "Abai Sundae (blood sausage stuffed with rice and vegetables) in Abai Village — the real reason to visit the market. Dak gangjeong (crispy fried chicken in sauce) near the bus terminal is locally famous. Ganjang gejang (raw crab marinated in soy) if budget allows.",
    detail_budget: {
      low: '~₩55,000–70,000/day',
      mid: '~₩110,000–150,000/day',
      high: '₩230,000+/day',
      notes: "Comparable to Gangneung. Accommodation near the park entrance costs a premium in autumn.",
    },
    crowd_friction: 'Medium',
    crowd_notes:
      "Seoraksan peaks significantly during autumn foliage season (October). Ulsanbawi hike has weekend queues at the cable car. The market and beach areas are busy in summer.",
    insider_tips: [
      "The cable ferry across to Abai Village is a 10-second crossing and costs almost nothing. Do not miss it.",
      "Ulsanbawi rock is a better hike than Daecheongbong for most travelers — shorter, more dramatic views, and no permit required.",
      "Sokcho is noticeably less developed than Gangneung. That is the point — plan for a slower, less designed experience.",
    ],
    similar_destinations: ['gangneung', 'jirisan'],
    useful_links: [],
    crowd_peak_months: [7, 8, 10],
    trust: {
      budget: { source: 'estimate', confidence: 'low',    last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-06-28' },
    },
  },

  {
    slug: 'tongyeong',
    name: 'Tongyeong',
    image: {
      src: 'https://images.unsplash.com/photo-1640529447335-8c46bcbe1e8f?auto=format&fit=crop&w=800&q=80',
      alt: 'Tongyeong harbor filled with boats at sunset',
    },
    card_vibe: 'Southern harbor & islands',
    vibe: "Harbor town with island ferries, raw seafood, and a slower southern coastal rhythm",
    recommended_stay: '1–2 days',
    live_weather_snapshot: 'This week · 14–21°C · clear',
    card_budget_level: '$',
    tags: ['coastal', 'nature', 'couple'],

    hero_summary:
      "A southern harbor city with an island-dotted coastline. Slower, cheaper, and less visited than the east coast.",
    why: "Worth it if you want to experience the south coast without a car and on a budget. Island ferries, raw oyster markets, and a harbor character that has not been smoothed over for tourists. Best combined with a Busan base.",
    best_for:
      "Southern coast slow travel, island day trips, seafood on a budget, or a quiet overnight from Busan.",
    skip_if:
      "You need urban energy or fast transport connections. Tongyeong is remote and the journey matters.",
    travel_time: {
      from_seoul: '~3h 30m bus',
      from_incheon_airport: '~4h bus',
      from_busan_station: '~1h 30m bus',
    },
    no_car_friendliness: 'Okay',
    local_movement:
      "The central dock area and Dongpirang Village are walkable. The cable car and outer island ferries are accessible by local bus or taxi.",
    car_recommended: false,
    seasonal_weather_context:
      "Typical in April: warm south coast spring, 14–21°C, pleasant for harbor walks and ferry trips. Summer is warm but manageable. One of the better spring destinations.",
    food: "Gulf oysters and sea squirt (meongge) at the central dock market — the best raw seafood eating in the south at budget prices. Mul hoe (cold raw fish broth) is the local specialty — refreshing and unusual.",
    detail_budget: {
      low: '~₩45,000–60,000/day',
      mid: '~₩85,000–120,000/day',
      high: '₩180,000+/day',
      notes: "One of the cheapest destinations in this set. Seafood at the dock market is excellent value.",
    },
    crowd_friction: 'Low',
    crowd_notes:
      "Quiet most of the year. Slightly busier during cherry blossom season and summer weekends. One of the least-crowded southern coastal destinations.",
    insider_tips: [
      "Dongpirang murals village is quieter than Busan equivalents and worth an hour — the view over the harbor is genuinely good.",
      "Ferry to Somaemuldo island is a full-day trip but one of the best island experiences on the south coast. Book in advance in summer.",
      "The Skyline Luge is a tourist attraction but the cable car view over the islands is worth the ticket.",
    ],
    similar_destinations: ['namhae', 'busan'],
    useful_links: [],
    crowd_peak_months: [7, 8],
    trust: {
      budget: { source: 'estimate', confidence: 'low', last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'low', last_verified: '2026-06-28' },
    },
  },

  {
    slug: 'namhae',
    name: 'Namhae',
    image: {
      src: 'https://images.unsplash.com/photo-1750164556117-422fe43efd5a?auto=format&fit=crop&w=800&q=80',
      alt: 'Namhae terraced rice fields with village on hillside',
    },
    card_vibe: 'Scenic southern island',
    vibe: "Scenic southern island — terraced hillsides, quiet bays, and the best views require a car",
    recommended_stay: '1–2 days',
    live_weather_snapshot: 'This week · 14–22°C · mostly clear',
    card_budget_level: '$',
    tags: ['coastal', 'nature', 'couple'],

    hero_summary:
      "An island connected to the mainland by bridge. Terraced garlic fields, quiet coastal bays, and scenic drives — best explored with a car.",
    why: "The right choice if you want Jeju-level scenery without the crowds, the flight, or the cost. Terraced hillsides, coastal drives, and near-empty beaches in spring and autumn. Genuinely remote and rewarding.",
    best_for:
      "Scenic drives, slow nature travel, couples wanting something quieter than Jeju, or road-trip itineraries from Busan.",
    skip_if:
      "You can't drive or rent a car. Public transport exists but misses most of what makes Namhae worth visiting.",
    travel_time: {
      from_seoul: '~4h bus',
      from_incheon_airport: '~4h 30m bus',
      from_busan_station: '~1h 30m bus',
    },
    no_car_friendliness: 'Hard',
    local_movement:
      "Buses connect the main villages but run infrequently. The island's scenic drives and most notable viewpoints are not practical without a car.",
    car_recommended: true,
    seasonal_weather_context:
      "Typical in April: warm and scenic, 14–22°C. Spring wildflowers on the terraced hillsides. Summer is pleasant and not as crowded as the east coast. Autumn foliage is quieter here.",
    food: "Grilled eel (jangeo) is the island specialty — ubiquitous and good. Namhae garlic is used in everything and is genuinely flavourful. Simple seafood at village restaurants is better and cheaper than tourist-oriented places near German Village.",
    detail_budget: {
      low: '~₩50,000–65,000/day',
      mid: '~₩100,000–140,000/day',
      high: '₩200,000+/day',
      notes: "Car rental adds cost. Accommodation in the island villages is cheap. Overall one of the more budget-friendly options with a car.",
    },
    crowd_friction: 'Low',
    crowd_notes:
      "Quiet outside of spring wildflower season. German Village draws some day-trippers but not heavily. One of the most crowd-free destinations in this set.",
    insider_tips: [
      "Boriam Temple on the ridge has sunrise views across the south coast. Worth the early start.",
      "German Village is charming but small — 30 minutes is enough. Do not make it the reason to come.",
      "The coast road between Namhae town and Sangju Beach is one of the better drives in the south — unhurried and scenic.",
    ],
    similar_destinations: ['tongyeong', 'jeju'],
    useful_links: [],
    crowd_peak_months: [7, 8],
    trust: {
      budget: { source: 'estimate', confidence: 'low', last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'low', last_verified: '2026-06-28' },
    },
  },

  {
    slug: 'jirisan',
    name: 'Jirisan',
    image: {
      src: 'https://images.unsplash.com/photo-1761024439802-489f82d5d791?auto=format&fit=crop&w=800&q=80',
      alt: 'Jirisan rocky autumn hillside with colorful foliage',
    },
    card_vibe: 'Mountain solitude',
    vibe: "Korea's largest mainland mountain — serious multi-day trails and forest solitude",
    recommended_stay: '3 days',
    live_weather_snapshot: 'This week · 8–17°C · clear, cool mornings',
    card_budget_level: '$',
    tags: ['mountain / hiking', 'nature', 'solo'],

    hero_summary:
      "Korea's largest mainland mountain range, spanning three provinces. Multi-day ridge hiking, mountain village culture, and forest solitude.",
    why: "Korea's mountain answer for hikers who want more than a day walk. The Nogodan–Cheonwangbong ridge traverse is a proper multi-day route through forest, bamboo groves, and open ridgelines. Not a casual destination — plan and prepare.",
    best_for:
      "Hikers doing the ridge traverse, nature immersion, or travelers wanting a proper mountain stay away from cities.",
    skip_if:
      "You want casual day hiking. Jirisan is serious terrain and better with preparation and 2 or more days.",
    travel_time: {
      from_seoul: '~3h to Namwon or Gurye by KTX + local bus',
      from_incheon_airport: '~3h 30m',
      from_busan_station: '~1h 30m to Jinju, then ~40m by bus',
    },
    no_car_friendliness: 'Hard',
    local_movement:
      "Trail access is possible by bus from Gurye or Namwon but connections are infrequent. A car makes it easier to reach different trailheads and mountain towns.",
    car_recommended: true,
    seasonal_weather_context:
      "Typical in April: mountain spring — warm in lower valleys, still cool on upper ridges. Snow possible above 1,500m in early April. Autumn (October) is the best season for the ridge traverse — clear skies and foliage.",
    food: "Mountain towns (Gurye, Namwon) have simple local food: mountain herb bibimbap, acorn jelly (dotorimuk), and doenjang jjigae with foraged mountain vegetables. Eating is functional here — the mountain is the reason to come.",
    detail_budget: {
      low: '~₩40,000–55,000/day',
      mid: '~₩80,000–110,000/day',
      high: '₩170,000+/day',
      notes: "Cheapest destination in this set. Mountain shelter accommodation is basic and inexpensive.",
    },
    crowd_friction: 'Low',
    crowd_notes:
      "Busy during autumn foliage and spring cherry blossoms on lower trails. The high ridge is quiet most of the year. Nogodan peak near Gurye gets more weekend foot traffic than the rest of the range.",
    insider_tips: [
      "The Nogodan–Cheonwangbong ridge traverse is a 3-day route. Book mountain shelter (dapionso) accommodation well in advance, especially in autumn.",
      "Gurye is a better base than Namwon for trail access and has more hiker-oriented food.",
      "Spring wild garlic (sanmaneul) season means small village roadside stalls selling fresh mountain greens — worth stopping for.",
    ],
    similar_destinations: ['sokcho', 'namhae'],
    useful_links: [],
    crowd_peak_months: [5, 10],
    trust: {
      budget: { source: 'estimate', confidence: 'low',    last_verified: '2026-06-28' },
      crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-06-28' },
    },
  },
]

export function getDestinationBySlug(slug: string): Destination | undefined {
  return destinations.find((d) => d.slug === slug)
}
