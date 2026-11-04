export type CityPlace = {
  name: string
  nameKo: string
  lat: number
  lng: number
  detail: string
  source: string
}

export type CityNeighborhoodGuide = {
  places: CityPlace[]
  food: string
}

// Points represent the place or street on VisitKorea's map, not a bus stop or entrance.
function place(
  name: string,
  nameKo: string,
  lat: number,
  lng: number,
  detail: string,
  visitKoreaId: number,
): CityPlace {
  return {
    name, nameKo, lat, lng, detail,
    source: `https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=${visitKoreaId}`,
  }
}

export const cityNeighborhoods: Record<string, CityNeighborhoodGuide> = {
  'seoul': {
    food: "At Gwangjang look for bindaetteok (빈대떡), a mung-bean pancake fried on a griddle, and small seaweed rice rolls called kimbap (김밥). On Yeonmujang-gil the draw is coffee and bakeries in former workshops.",
    places: [
      place(
        "Seongsu café street", "성수동 카페거리", 37.54320, 127.05660,
        "Follow Yeonmujang-gil past shoemakers’ workshops and red-brick warehouses. Some doors still lead to working factories; others open into coffee shops, bakeries or clothing stores.",
        112801,
      ),
      place(
        "Gwangjang Market", "광장시장", 37.57011, 126.99971,
        "Enter the covered food aisles from North Gate 2 for griddles and counter seats. Beyond the food stalls, the market also sells cloth and household goods.",
        106345,
      ),
      place(
        "Seochon", "서촌마을", 37.57807, 126.97295,
        "West of Gyeongbokgung Palace, narrow lanes run between tiled-roof houses, small galleries and older shops. A pin marks the neighborhood; the side streets are the walk.",
        70257,
      ),
    ],
  },
  'busan': {
    food: "At Jagalchi, hoe (회) means raw fish served in slices. Ask for the price and any separate preparation or table charge before choosing a fish. Jeonpo is a separate stop for coffee and pastries.",
    places: [
      place(
        "Jeonpo café street", "전포카페거리", 35.15542, 129.06734,
        "Near Seomyeon, converted workshops and houses now hold coffee bars, bakeries and small shops. Look into the side lanes rather than staying on the main road.",
        192977,
      ),
      place(
        "Jagalchi Market", "자갈치시장", 35.09661, 129.03058,
        "Walk the harbor-side row of seafood stalls, then step inside for live fish tanks. Dried fish and fresh catches occupy different parts of the market.",
        69318,
      ),
      place(
        "Gamcheon Culture Village", "감천문화마을", 35.09746, 129.01060,
        "Colorful houses follow the slope above the coast. Follow the public mural lanes and expect stairs; many of the doors beside the artwork lead straight into people’s homes.",
        72894,
      ),
    ],
  },
  'jeju': {
    food: "At Dongmun, look for galchi (갈치), the long silver cutlassfish sold at the seafood stalls. Jeju citrus is sold as fruit and juice; the varieties on display change with the harvest.",
    places: [
      place(
        "Dongmun Market", "동문재래시장", 33.51153, 126.52605,
        "In the old center of Jeju City, fruit and produce stalls sit beside the fish market. Walk into the covered aisles to see the catch before looking for a meal.",
        91650,
      ),
      place(
        "Handam coastal path", "한담해안산책로", 33.45920, 126.31060,
        "West of Jeju City, the path follows black volcanic rock between Aewol and Gwakji. Bring the coast into view from the path itself; the nearby cafés sit above it.",
        113111,
      ),
      place(
        "Seogwipo Maeil Olle Market", "서귀포매일올레시장", 33.25015, 126.56322,
        "A long covered market runs through central Seogwipo, with produce and seafood in adjoining aisles. It is on the south side of the island; Dongmun is in Jeju City on the north side.",
        90960,
      ),
    ],
  },
  'gyeongju': {
    food: "Hwangnam-ppang (황남빵) is a small baked pastry filled with red bean paste. For a sit-down meal, ssambap (쌈밥) comes with leaves to wrap around rice and the small dishes on the table.",
    places: [
      place(
        "Hwangnidan-gil", "황리단길", 35.83741, 129.20995,
        "Old houses along Poseok-ro and its side lanes hold cafés, photo studios and small shops. The rooflines stay low here, and the grass mounds of Daereungwon are just east of the street.",
        174203,
      ),
      place(
        "Cheonmachong and the tomb park", "천마총·대릉원", 35.83864, 129.21047,
        "Paths wind around royal burial mounds in the middle of the city. Cheonmachong is the tomb where the painted horse saddle flap that gave it its name was found.",
        112226,
      ),
      place(
        "Woljeonggyo Bridge", "월정교", 35.82909, 129.21732,
        "South of the tomb park, a reconstructed timber bridge spans the stream in Gyo-dong. Walk along the bank for a side view of its roof and pillars, then cross the covered walkway.",
        57372,
      ),
    ],
  },
  'jeonju': {
    food: "Look for kongnamul-gukbap (콩나물국밥) near Nambu Market, a bowl of rice and bean sprouts in broth. Jeonju bibimbap (전주비빔밥) is mixed at the table with vegetables and chili paste.",
    places: [
      place(
        "Gyeonggijeon", "경기전", 35.81516, 127.14985,
        "In the Hanok Village, this walled shrine houses a portrait of King Taejo. Turn off the shop-lined street into its courtyards and tree groves.",
        108728,
      ),
      place(
        "Nambu Market", "남부시장", 35.81278, 127.14754,
        "South of Pungnammun Gate, follow the covered ground-floor aisles past food shops and dry goods. Building 6 has a separate row of small shops upstairs.",
        75565,
      ),
      place(
        "Jaman mural lanes", "자만벽화마을", 35.81400, 127.15720,
        "Walk uphill on the opposite side of the main road from the Hanok Village. The murals are on the walls of a residential neighborhood; use the public lanes and leave doorways clear.",
        195024,
      ),
    ],
  },
  'gangneung': {
    food: "In Chodang, order sundubu (순두부), soft tofu traditionally set with salt water from the East Sea. A plain bowl lets you taste the curds themselves. The coffee houses facing Anmok Beach are a separate coastal stop.",
    places: [
      place(
        "Anmok coffee street", "안목 커피거리", 37.77260, 128.94732,
        "Coffee shops face the sand at Anmok Beach. Walk the seafront to see the shoreline, then step inside to compare the beans and roasts on a café’s menu.",
        66485,
      ),
      place(
        "Chodang tofu village", "초당두부마을", 37.79189, 128.91521,
        "South of Gyeongpo Beach, streets around Chodangsundubu-gil are lined with tofu restaurants. Look for 순두부 on the signs to find the local soft curds.",
        109344,
      ),
      place(
        "Gangneung Jungang Market", "강릉 중앙시장", 37.75400, 128.89863,
        "The central market is downtown, inland from the beaches. Explore both the market building and the adjoining alleys where vendors set up beside permanent shops.",
        66096,
      ),
    ],
  },
  'sokcho': {
    food: "In Abai Village, ojingeo-sundae (오징어순대) is stuffed squid served in slices. Abai-sundae (아바이순대) is a different, sausage-style dish. Downtown, look for dakgangjeong (닭강정), bite-size fried chicken in a sticky glaze.",
    places: [
      place(
        "Abai Village", "아바이마을", 38.20068, 128.59489,
        "Refugees from northern Korea settled these waterside lanes after the Korean War. Along the restaurant alley, stuffed squid and Hamheung-style cold noodles tell part of that history.",
        107594,
      ),
      place(
        "Sokcho fish market", "속초관광수산시장", 38.20394, 128.59052,
        "The main building and surrounding lanes sell very different things. Follow the signs for the raw-fish center, or stay in the alleys for chicken, salted seafood and sundae.",
        75204,
      ),
      place(
        "Yeonggeumjeong", "영금정", 38.21189, 128.60179,
        "Near the lighthouse, a short footbridge reaches a pavilion above the rocks. From there you can watch the waves breaking below without stepping onto the rocks.",
        81275,
      ),
    ],
  },
  'tongyeong': {
    food: "Chungmu gimbap (충무김밥) has thin, plain rice rolls with spicy squid and radish served alongside. For something sweet by the port, kkulppang (꿀빵) is fried dough with a sweet bean filling and sticky glaze.",
    places: [
      place(
        "Jungang Market", "통영 중앙시장", 34.84529, 128.42461,
        "The harbor faces one edge of the market and Dongpirang rises behind it. Walk between the fish stalls and waterfront before taking the uphill lanes into the village.",
        77738,
      ),
      place(
        "Dongpirang", "동피랑마을", 34.84531, 128.42762,
        "Murals cover the walls of hillside lanes above the harbor. The climb gives a different view of the boats below; keep to the lanes between the houses.",
        113285,
      ),
      place(
        "Harbor kkulppang street", "통영항 꿀빵거리", 34.84454, 128.42429,
        "Beside the central market, several shops make the small glazed buns once carried by sailors. Walk along the port to see the harbor and compare the fillings in the shop windows.",
        1564046,
      ),
    ],
  },
  'namhae': {
    food: "Myeolchi-ssambap (멸치쌈밥) uses larger anchovies cooked in sauce. Take an anchovy and a spoonful of rice and fold them into a leaf. In the German Village, menus also feature sausages and beer.",
    places: [
      place(
        "German Village exhibition hall", "남해 파독전시관", 34.79974, 128.03841,
        "The museum in the German Village tells the story of Korean miners and nurses who worked in Germany. Look around the red-roofed village lanes on either side of a visit to the hall.",
        68074,
      ),
      place(
        "Daraengi Village", "가천 다랭이마을", 34.72794, 127.89437,
        "Terraced rice fields descend a steep slope toward the sea. Stay on the signed walking paths between the plots; the fields belong to working farms.",
        90688,
      ),
      place(
        "Sangju Silver Sand Beach", "상주 은모래비치", 34.72218, 127.98745,
        "On the southern coast, a curving band of pale sand faces the bay with Geumsan behind it. The beach is a separate stop from the German Village and Daraengi.",
        103281,
      ),
    ],
  },
  'jirisan': {
    food: "On the Hadong side, Hwagae Market sells local tea, chestnuts and mountain greens. Look for sanchae-bibimbap (산채비빔밥), rice topped with an assortment of seasoned mountain vegetables.",
    places: [
      place(
        "Hwagae Market, Hadong", "화개장터", 35.18799, 127.62407,
        "At the meeting of Hwagae Stream and the Seomjin River, stalls sell tea, wild greens and chestnuts. This is a market town below Jirisan, separate from the hiking trailheads.",
        80298,
      ),
      place(
        "Ssanggyesa, Hadong", "쌍계사", 35.23857, 127.66083,
        "Follow the valley inland from Hwagae toward this temple in the southern foothills. Cherry trees line the approach; the temple courtyards are a walk of their own.",
        111834,
      ),
      place(
        "Hwaeomsa, Gurye", "화엄사", 35.25552, 127.49715,
        "On the Gurye side of Jirisan, a separate valley leads to Hwaeomsa and its temple halls. Allow for a road journey between Gurye and the two Hadong stops.",
        111755,
      ),
    ],
  },
  'yeosu': {
    food: "At the pocha stalls, look for seafood cooked to order. Elsewhere in Yeosu, gejang (게장) is raw crab marinated in soy sauce or chili seasoning; gat-kimchi (갓김치) is the local mustard-leaf kimchi.",
    places: [
      place(
        "Nangman Pocha street", "낭만포차거리", 34.73655, 127.74950,
        "Evening seafood stalls gather under Geobukseon Bridge near Hamel Lighthouse. The waterfront gives a clear view of the bridge lights from the street.",
        60013,
      ),
      place(
        "Yi Sun-sin Square", "이순신광장", 34.73986, 127.73571,
        "Look for the full-size turtle-ship replica in this harbor-front square. The nearby waterfront continues east toward the bridge and the pocha stalls.",
        33693,
      ),
      place(
        "Odongdo", "오동도", 34.74432, 127.76411,
        "A breakwater connects the mainland to the island on foot. Beyond it, wooded paths lead past camellias toward the lighthouse and sea views.",
        93901,
      ),
    ],
  },
  'andong': {
    food: "In the old market, jjimdak (찜닭) is chicken braised with glass noodles and vegetables in a soy-based sauce. It comes on a platter; check the portion size and spice level when ordering.",
    places: [
      place(
        "Jjimdak alley", "안동 찜닭골목", 36.56521, 128.72852,
        "Inside the downtown old market, chicken restaurants stand side by side along one alley. The signs read 찜닭, the dish that grew out of this market’s chicken trade.",
        14987,
      ),
      place(
        "Hahoe Village", "하회마을", 36.55061, 128.52829,
        "Traditional houses sit inside a bend in the Nakdong River. The lanes run past occupied homes; this is a separate outing west of downtown, not part of the market walk.",
        111087,
      ),
      place(
        "Woryeonggyo Bridge", "월영교", 36.57677, 128.76009,
        "East of downtown, a wooden pedestrian bridge crosses the water and passes a roofed pavilion. Walk out onto the bridge for a view along the river.",
        80957,
      ),
    ],
  },
  'suwon': {
    food: "On Chicken Street, tongdak (통닭) is fried chicken, traditionally cooked in a large cauldron. Plain fried chicken is usually listed as 후라이드; 양념 is the version coated in sweet-spicy sauce.",
    places: [
      place(
        "Haengnidan-gil", "행리단길", 37.28534, 127.01276,
        "Between Hwahongmun and Hwaseo Park, the lanes of Haenggung-dong hold cafés, small shops and exhibition spaces inside the fortress walls.",
        217723,
      ),
      place(
        "Hwaseomun Gate", "화서문", 37.28561, 127.00966,
        "At the western gate, follow the curve of the outer defensive wall to see how it shields the arch. The gate sits at the Hwaseo Park end of the neighborhood walk.",
        108760,
      ),
      place(
        "Suwon chicken street", "수원통닭거리", 37.27944, 127.01764,
        "A short alley off Paldal-ro is lined with fried-chicken shops. Look for the big metal cauldrons used to fry chicken and the tongdak signs along the street.",
        176166,
      ),
    ],
  },
  'chuncheon': {
    food: "Dakgalbi (닭갈비) here is chicken stir-fried on a hot plate with cabbage and a chili seasoning. Ask about bokkeumbap (볶음밥) at the end of the meal: rice is fried in the sauce left on the plate.",
    places: [
      place(
        "Myeongdong dakgalbi alley", "춘천 명동 닭갈비 골목", 37.87920, 127.72750,
        "In central Chuncheon, restaurants along this lane cook chicken and vegetables on hot iron plates. Look for the Korean name 명동닭갈비골목; this Myeongdong is in Chuncheon.",
        108005,
      ),
      place(
        "Yukrimgogae", "육림고개", 37.87754, 127.72952,
        "This sloping downtown street has small craft shops and places to eat near the old Yukrim Cinema. Pair it with neighboring Myeongdong on foot.",
        43252,
      ),
      place(
        "Soyanggang Skywalk", "소양강스카이워크", 37.89338, 127.72427,
        "North of downtown, this glass-floored walkway extends over the river to a round viewing platform. The riverfront and the dakgalbi alley are separate stops.",
        68510,
      ),
    ],
  },
  'damyang-boseong': {
    food: "In Damyang, daetongbap (대통밥) is rice steamed in a bamboo tube, often served with grilled tteokgalbi (떡갈비). In Boseong, order nokcha (녹차) to taste the tea grown on the hillside.",
    places: [
      place(
        "Juknokwon bamboo garden, Damyang", "담양 죽녹원", 35.32776, 126.98556,
        "Follow the stone steps and shaded paths through the tall bamboo above town. The riverside trees of Gwanbangjerim are nearby on the Damyang side of this guide.",
        93987,
      ),
      place(
        "Gwanbangjerim riverside, Damyang", "담양 관방제림", 35.32392, 126.98559,
        "Mature trees line the bank of Damyangcheon. The trees were planted to protect the bank from floods and now shade a riverside walk near the bamboo garden.",
        89164,
      ),
      place(
        "Daehan Dawon tea fields, Boseong", "보성 대한다원", 34.71565, 127.07880,
        "A cedar-lined entrance leads to rows of tea bushes up the hillside. The higher viewpoints involve a climb. Boseong and Damyang are separate counties, so these fields need their own journey.",
        110794,
      ),
    ],
  },
}
