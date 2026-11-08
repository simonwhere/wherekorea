import type { WalkGuide, WalkPhoto } from './types'

function visitKorea(place: string, id: number) {
  return { label: `VisitKorea · ${place}`, url: `https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=${id}` }
}

function commonsPhoto(file: string, alt: string, author: string, original: string, license: string, licenseUrl: string): WalkPhoto {
  return {
    src: `/walks/south-coast/${file}.webp`, alt,
    credit: `${author} / Wikimedia Commons · resized and converted to WebP`,
    source: `https://commons.wikimedia.org/wiki/File:${original}`, license, licenseUrl,
  }
}

const ujin = visitKorea('Ujin Haejangguk menu and hours', 52937)
const halmae = visitKorea('Ttungbo Halmae Gimbap menu and hours', 85867)
const ohburim = visitKorea('Ohburim menu and hours', 188745)
const yeosudang = visitKorea('Yeosudang menu and hours', 177537)
const bamtol = { label: 'Bamtol bakery · menu, address and opening hours', url: 'https://bamtol.cafe/' }
const ccBySa3 = 'https://creativecommons.org/licenses/by-sa/3.0/'

export const southCoastWalks: WalkGuide[] = [
  {
    slug: 'dongmun', city: 'jeju', name: 'Jeju City old town', nameKo: '제주시 원도심',
    cardRoute: 'Bracken and pork soup, a wooden pavilion and Dongmun Market',
    intro: 'In Jeju City, start with a bowl of thick bracken soup, then walk past the old government quarter to Dongmun Market. The airport bus passes both ends of the walk.',
    stops: [
      {
        name: 'Ujin Haejangguk', nameKo: '우진해장국', lat: 33.51156, lng: 126.52002,
        walk: 'From Jeju Airport, take bus 325 toward Hamdeok (함덕) and get off at Gwandeokjeong (관덕정). Walk west on Gwandeok-ro, then turn left onto Seosa-ro to number 11.',
        what: 'Order 고사리해장국. The fern shoots and pork cook down into a thick brown soup, served with rice. There can be a queue even in the morning.',
      },
      {
        name: 'Gwandeokjeong Pavilion', nameKo: '관덕정', lat: 33.51326, lng: 126.52196,
        walk: 'Walk back to Gwandeok-ro and turn east toward the open plaza in front of the pavilion.',
        what: 'Stand back from the steps to see the sweep of the tiled roof and the stone figures in the forecourt. The old provincial government compound stands alongside it.',
        photo: commonsPhoto('jeju-pavilion', 'The tiled roof of Gwandeokjeong beyond a stone figure in the open plaza', 'Thddbwnd', 'Gwandeokjeong_Pavilion.JPG', 'CC BY-SA 3.0', ccBySa3),
      },
      {
        name: 'Dongmun Traditional Market', nameKo: '동문재래시장', lat: 33.51153, lng: 126.52605,
        walk: 'Continue east along Gwandeok-ro, cross Jungang-ro and follow the signs for 동문시장 into the covered lanes.',
        what: 'Look for Jeju citrus and the fish counters. Individual stalls open at different times. To return to the airport, use the north-side Dongmun Rotary stop and board bus 325 toward Halla Arboretum (한라수목원).',
        photo: commonsPhoto('dongmun-market', 'Shoppers at a covered entrance with the blue Dongmun Market sign', 'thddbwnd', 'Jeju_dongmun_market_1.JPG', 'CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0/'),
      },
    ],
    food: { name: 'Jeju bracken and pork soup', nameKo: '고사리해장국', detail: 'Ask for gosari haejangguk at Ujin. Despite the name of the fern, the soup contains pork.', stop: 1 },
    breakfast: { venue: 'Ujin Haejangguk', venueKo: '우진해장국', hours: '06:00–22:00', address: '11 Seosa-ro, Jeju City', detail: 'Closed over the Seollal and Chuseok holidays. Allow time for the queue.', checked: '2026-11-09', source: ujin, stop: 1 },
    sources: [ujin, visitKorea('Gwandeokjeong Pavilion', 85014), visitKorea('Dongmun Traditional Market', 91650),
      { label: 'Jeju Bus · 325 from the airport to the old town', url: 'https://bus.jeju.go.kr/mobile/schedule/detailSchedule?scheduleId=2511' },
      { label: 'Jeju Bus · 325 from Dongmun Rotary to the airport', url: 'https://bus.jeju.go.kr/mobile/schedule/detailSchedule?scheduleId=2512' }],
  },
  {
    slug: 'gangguan', city: 'tongyeong', name: 'Gangguan harbour and Dongpirang', nameKo: '강구안과 동피랑',
    aliases: ['Gangguan & Jungang Market'],
    cardRoute: 'Chungmu gimbap at the harbour, fish stalls and the Dongpirang hillside',
    intro: 'Eat the little rice rolls Tongyeong is known for on the harbour road. The fish market is just inland, and the painted lanes of Dongpirang rise behind it.',
    stops: [
      {
        name: 'Ttungbo Halmae Gimbap', nameKo: '뚱보할매김밥', lat: 34.84385, lng: 128.42366,
        walk: 'At Tongyeong Bus Terminal, take local bus 101 toward Donam-dong (도남동) to Jungang Market (중앙시장, stop 3830334). Walk to 325 Tongyeonghaean-ro on the harbour road.',
        what: 'The shop serves Chungmu gimbap. The plain rice rolls come with spicy squid and radish kimchi on the side. Take a bite of each together.',
      },
      {
        name: 'Jungang Market', nameKo: '통영중앙시장', lat: 34.84529, lng: 128.42461,
        walk: 'With the harbour behind you, walk into the market lanes under the 중앙시장 sign.',
        what: 'Fresh catch and dried seafood share the market lanes. The waterfront outside is a good place to see the fishing boats before starting the climb.',
        photo: commonsPhoto('jungang', 'Parasols beneath the Jungang Live Fish Market arch in Tongyeong', 'Junho Jung', 'Korea-Tongyeong-Jungang_Live_Fish_Market-01.jpg', 'CC BY-SA 3.0', ccBySa3),
      },
      {
        name: 'Dongpirang Village', nameKo: '동피랑마을', lat: 34.84531, lng: 128.42762,
        walk: 'Leave the east side of the market and follow 동피랑 signs uphill along Dongpirang-gil. There are slopes and steps between the houses.',
        what: 'Look back toward Gangguan across the rooftops. People live on these lanes, so stay on the public paths. Return downhill to Jungang Market stop 3830335 for bus 101 toward 신우희가로 and the terminal.',
        photo: commonsPhoto('dongpirang', 'A hillside footpath and painted wall beside a house on Dongpirang-gil', 'Junho Jung', 'Korea-Tongyeong-Dongpirang_Village-10.jpg', 'CC BY-SA 3.0', ccBySa3),
      },
    ],
    food: { name: 'Chungmu gimbap', nameKo: '충무김밥', detail: 'Rice and seaweed are rolled separately from the squid and kimchi. The dish grew out of meals sailors carried out to sea.', stop: 1 },
    breakfast: { venue: 'Ttungbo Halmae Gimbap', venueKo: '뚱보할매김밥', hours: '06:00–22:00 daily', address: '325 Tongyeonghaean-ro, Tongyeong', detail: 'The Chungmu gimbap set is the only item on the menu.', checked: '2026-11-09', source: halmae, stop: 1 },
    sources: [halmae, visitKorea('Jungang Traditional Market', 77738), visitKorea('Dongpirang Village', 113285),
      { label: 'Tongyeong Bus · route 101 in both directions', url: 'https://tsbis.kr/383/main_search.do?main_searchKeyword=101' }],
  },
  {
    slug: 'german-village', city: 'namhae', name: 'Namhae German Village', nameKo: '남해독일마을',
    aliases: ['German Village & Mulgeon'],
    cardRoute: 'Cod soup at the foot of the hill, then the lanes up to the village square',
    intro: 'Start on Dongbu-daero below the German Village. Walk uphill past the red-roofed houses to the square and the exhibition about the Korean miners and nurses who worked in Germany.',
    stops: [
      {
        name: 'Ohburim', nameKo: '어부림', lat: 34.79619, lng: 128.04725,
        walk: 'Bus 020 serves the German Village from Namhae Bus Terminal. For breakfast, head to the lower end of Dogil-ro and find the restaurant at 1126 Dongbu-daero.',
        what: 'Ask for 대구탕, a bowl of cod soup. The larger 어부림밥상 set includes anchovies, braised cutlassfish and beef patties, and needs an advance reservation.',
      },
      {
        name: 'Dogil-ro by Kunst Lounge', nameKo: '독일로 쿤스트라운지 앞', lat: 34.79775, lng: 128.04314,
        walk: 'From the restaurant, enter Dogil-ro (독일로) at the lower village entrance. Follow the road uphill to Kunst Lounge at number 34.',
        what: 'Here the houses start climbing the hillside in rows. Continue along the public road for a look at the steep roofs and views down toward the sea. The gardens beside the houses are private.',
      },
      {
        name: 'German Village square and exhibition hall', nameKo: '독일마을 광장·남해파독전시관', lat: 34.79974, lng: 128.03841,
        walk: 'Keep climbing Dogil-ro to the square at 89-7. Look for 파독전시관 beside the plaza.',
        what: 'The exhibition follows the lives of the miners and nurses through their belongings. It usually closes on Mondays. For the terminal, board a later 020 at 독일마을 (3930625) toward Dongcheon Junction (동천삼거리).',
        photo: commonsPhoto('german-village', 'A brick arch and pointed tower on the square at Namhae German Village', 'Choi2451', 'German_Village_in_Namhae,_South_Korea_on_August_31st,_2019.jpg', 'CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'),
      },
    ],
    food: { name: 'Cod soup', nameKo: '대구탕', detail: 'At Ohburim, daegutang is the fish soup on the menu. The spicy mixed noodles, bibimguksu (비빔국수), are another option.', stop: 1 },
    breakfast: { venue: 'Ohburim', venueKo: '어부림', hours: '09:00–20:00 daily', address: '1126 Dongbu-daero, Samdong-myeon, Namhae', detail: 'The Ohburim set meal requires an advance reservation.', checked: '2026-11-09', source: ohburim, stop: 1 },
    sources: [ohburim, visitKorea('Namhae German Village', 75683), visitKorea('Namhae German Exhibition Hall', 68074),
      { label: 'VisitKorea · Kunst Lounge on Dogil-ro', url: 'https://english.visitkorea.or.kr/svc/whereToGo/hdrdslt/hdrdsltView.do?crsSn=206' },
      { label: 'Namhae Bus · German Village loop 020', url: 'https://tsbis.kr/393/main_search.do?main_searchKeyword=020' }],
  },
  {
    slug: 'yeosu-harbour', city: 'yeosu', name: 'Yeosu old harbour', nameKo: '여수 이순신광장 일대',
    cardRoute: 'A warm baguette burger, the harbour square and Jinnamgwan Hall',
    intro: 'Take breakfast to the harbour square, then walk uphill to the wooden guest hall that stood on the site of Yeosu’s naval base. All three stops are in the old town.',
    stops: [
      {
        name: 'Yeosudang', nameKo: '여수당', lat: 34.73990, lng: 127.73532,
        walk: 'Head for Yi Sun-sin Square (이순신광장) by city bus. The bakery faces the square from 72 Jungang-ro.',
        what: 'Ask for 수제바게트버거, a crisp baguette filled with a spicy sauce and savoury filling. The green ice cream on the menu is flavoured with mugwort.',
      },
      {
        name: 'Yi Sun-sin Square', nameKo: '이순신광장', lat: 34.73986, lng: 127.73571,
        walk: 'Use the crossing in front of the bakery to reach the open square beside the harbour.',
        what: 'Walk down to the waterfront for a view across the channel. Turn back toward the old town to find the signs for 진남관.',
      },
      {
        name: 'Jinnamgwan Hall', nameKo: '진남관', lat: 34.74183, lng: 127.73673,
        walk: 'From the landward side of the square, head north to the signed Jinnamgwan entrance at the foot of the steps.',
        what: 'The long tiled roof rests on rows of wooden pillars. For Yeosu EXPO Station, return to Yi Sun-sin Square and take bus 2 at stop 3250846 toward 여수엑스포역.',
        photo: commonsPhoto('jinnamgwan', 'A row of wooden pillars beneath the long tiled roof of Jinnamgwan Hall', 'Mikhail Kim', 'Jinnamgwan_0.jpg', 'CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0/'),
      },
    ],
    food: { name: 'Baguette burger', nameKo: '수제바게트버거', detail: 'Pick up a warm baguette burger at Yeosudang beside the square. The mugwort ice cream, 쑥 아이스크림, has a grassy flavour.', stop: 1 },
    breakfast: { venue: 'Yeosudang', venueKo: '여수당', hours: '09:30–22:00 daily', address: '72 Jungang-ro, Yeosu', detail: 'The shop is beside Yi Sun-sin Square. There can be a queue for baguettes and ice cream.', checked: '2026-11-09', source: yeosudang, stop: 1 },
    sources: [yeosudang, visitKorea('Yi Sun-sin Square', 33693), visitKorea('Jinnamgwan Hall', 84183),
      { label: 'Yeosu Bus · city routes and stops', url: 'https://its.yeosu.go.kr/bus/busroute' }],
  },
  {
    slug: 'hwagae', city: 'jirisan', name: 'Hwagae Market, Hadong', nameKo: '하동 화개장터',
    aliases: ['Ssanggyesa & Hwagae'],
    cardRoute: 'The riverside market, Hadong chestnut pies and a teahouse',
    intro: 'On the Hadong side of Jirisan, the market sits where Hwagae Stream meets the Seomjin River. Walk from the stalls to a chestnut bakery and a local tea shop. The national park trailheads are farther up the valley.',
    stops: [
      {
        name: 'Hwagae Market', nameKo: '화개장터', lat: 35.18799, lng: 127.62407,
        walk: 'Arrive at Hwagae Bus Terminal (화개버스터미널) and follow signs for 화개장터 toward the river. The market is at 15 Ssanggye-ro.',
        what: 'Walk between the stalls of chestnuts, dried mountain greens and medicinal roots. Each trader keeps their own hours. Early arrivals can go straight to the bakery when it opens.',
        photo: {
          src: '/walks/south-coast/hwagae-market.webp', alt: 'Hwagae Market between two rivers, with cherry trees below Namdo Bridge',
          credit: 'Hadong County · Hwagae Market · resized and converted to WebP', license: 'KOGL Type 1',
          source: 'https://www.kogl.or.kr/recommend/recommendDivView.do?division=img&recommendIdx=177197',
          licenseUrl: 'https://www.kogl.or.kr/info/licenseType1.do',
        },
      },
      {
        name: 'Bamtol bakery', nameKo: '밤톨', lat: 35.19003, lng: 127.62341,
        walk: 'Head back toward the bus terminal. Bamtol is opposite it at 17-1 Hwagae-ro, with the shop name 밤톨 on the front.',
        what: 'Ask for 하동 밤파이. The bakery wraps Hadong chestnuts and chestnut paste in buttery pastry. There is also an apple pie made with Jirisan apples.',
      },
      {
        name: 'Ssanggye Myeongcha tea shop', nameKo: '쌍계명차', lat: 35.19088, lng: 127.62425,
        walk: 'Continue up Hwagae-ro past the terminal to number 30. The tea counter is on the ground floor.',
        what: 'Try ujeon (우전), an early-season green tea, or green tea ice cream. Upstairs is a small museum of tea wares. Walk back down the same street for the bus from Hwagae Terminal.',
      },
    ],
    food: { name: 'Hadong chestnut pie', nameKo: '하동 밤파이', detail: 'Bamtol’s chestnut pastry is sold across the street from the terminal, an easy stop before the bus. Their own website also links to pickup reservations.', stop: 2 },
    breakfast: { venue: 'Bamtol bakery', venueKo: '밤톨', hours: '09:00–18:00 daily on the bakery website', address: '17-1 Hwagae-ro, Hwagae-myeon, Hadong', detail: 'Some map listings show a 09:30 opening. For a visit before 09:30, confirm with the bakery at 055-883-8999.', checked: '2026-11-09', source: bamtol, stop: 2 },
    sources: [bamtol, visitKorea('Hwagae Market', 80298),
      { label: 'VisitKorea · Ssanggye Myeongcha and buses from Hadong', url: 'https://access.visitkorea.or.kr/food/detail.do?cotId=97848a65-5d58-43a8-82b2-61de698a1cfb' },
      { label: 'VisitKorea · Bamtol bakery by Hwagae Terminal', url: 'https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=69b74eb5-1a10-4cfc-8387-dfbc7a2c4a67' },
      { label: 'Tmoney · coaches to and from Hwagae', url: 'https://txbus.t-money.co.kr/main.do' }],
  },
]
