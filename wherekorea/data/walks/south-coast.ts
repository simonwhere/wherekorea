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

const ujin = { label: 'VisitJeju · main dining room menu and hours', url: 'https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_000000000018375' }
const halmae = visitKorea('Ttungbo Halmae Gimbap menu and hours', 85867)
const ohburim = { label: 'VisitKorea in Korean · Ohburim menu, map and hours', url: 'https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=7a7b37b9-fcd9-4d3f-bcff-671f5314f849' }
const ohburimFarmGuide = { label: 'Nongsaro · Ohburim weekday and weekend hours', url: 'https://www.nongsaro.go.kr/portal/ps/psz/psza/contentSub.ps?cntntsNo=201066&menuId=PS03968' }
const ohburimShop = { label: 'Naver Map · Ohburim hours and menu at 1126 Dongbu-daero', url: 'https://map.naver.com/p/entry/place/38419513' }
const yeosudang = { label: 'VisitKorea in Korean · Yeosudang menu and hours', url: 'https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=555e23f3-28e8-4de3-b974-9f2ff80784fa' }
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
        what: 'Order 고사리육개장. The fern shoots and pork cook down into a thick brown soup, served with rice. Take a number at the main dining room when there is a queue.',
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
    food: { name: 'Jeju bracken and pork soup', nameKo: '고사리육개장', detail: 'Ask for gosari yukgaejang at Ujin. The bracken and pork simmer together until the broth is almost as thick as porridge.', stop: 1 },
    breakfast: {
      venue: 'Ujin Haejangguk', venueKo: '우진해장국', stop: 1,
      hours: 'Main dining room 06:00–22:00. Closed over the Seollal and Chuseok holidays.',
      address: 'Main dining room (본관) · 11 Seosa-ro, Jeju City',
      detail: 'Use the main dining room for an early visit. The annex usually opens at 08:00 and closes on Tuesdays. Take a number at the main room when there is a queue.',
      ordering: {
        summary: 'First bowl of bracken soup · time unconfirmed',
        phone: '+82 64 757 3393',
        questionKo: '오늘 본관에서 고사리육개장은 몇 시부터 주문해서 먹을 수 있나요?',
      },
      checked: '2026-11-09', source: ujin,
    },
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
    breakfast: {
      venue: 'Ttungbo Halmae Gimbap', venueKo: '뚱보할매김밥', stop: 1,
      hours: 'Shop hours 06:00–22:00 daily.',
      address: '325 Tongyeonghaean-ro, Tongyeong',
      detail: 'The harbour shop serves just one dish, Chungmu gimbap. Call before an early ferry if you want to pick up a portion on the way.',
      ordering: {
        summary: 'First Chungmu gimbap · time unconfirmed',
        phone: '+82 55 645 2619',
        questionKo: '오늘 아침 충무김밥은 몇 시부터 주문할 수 있나요? 포장도 그때 가능한가요?',
      },
      checked: '2026-11-09', source: halmae,
    },
    sources: [halmae, { label: 'Naver Map · Ttungbo Halmae Gimbap shop hours', url: 'https://map.naver.com/p/entry/place/11694124' }, visitKorea('Jungang Traditional Market', 77738), visitKorea('Dongpirang Village', 113285),
      { label: 'Tongyeong Bus · route 101 in both directions', url: 'https://tsbis.kr/383/main_search.do?main_searchKeyword=101' }],
  },
  {
    slug: 'german-village', city: 'namhae', name: 'Namhae German Village', nameKo: '남해독일마을',
    aliases: ['German Village & Mulgeon'],
    cardRoute: 'A farmhouse restaurant at the foot of the hill, then the lanes up to the village square',
    intro: 'Start on Dongbu-daero below the German Village. Walk uphill past the red-roofed houses to the square and the exhibition about the Korean miners and nurses who worked in Germany.',
    stops: [
      {
        name: 'Ohburim', nameKo: '어부림', lat: 34.79916, lng: 128.04399,
        walk: 'Bus 020 serves the German Village from Namhae Bus Terminal. At the lower end of Dogil-ro, find the restaurant at 1126 Dongbu-daero.',
        what: 'Look for 농가정식 on the menu for the farmhouse set with rice and side dishes. For a bowl of soup, ask for 한우곰탕 (Korean beef broth).',
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
    food: { name: 'Farmhouse set meal', nameKo: '농가정식', detail: 'At Ohburim, ask for nongga jeongsik, a farmhouse meal with rice and side dishes. The restaurant uses its own anchovy sauce. Braised cutlassfish (갈치조림) is also on the menu.', stop: 1 },
    breakfast: {
      venue: 'Ohburim', venueKo: '어부림', stop: 1,
      hours: 'The shop’s Naver listing and VisitKorea both give 09:00–20:00 daily. The farm guide lists later opening times and Mondays closed.',
      address: '1126 Dongbu-daero, Samdong-myeon, Namhae',
      detail: 'Ask about the farmhouse set (농가정식) before taking the bus. Reserve ahead for the larger Ohburim set (어부림밥상).',
      ordering: {
        summary: 'Farmhouse set meal · call before setting out',
        phone: '+82 55 867 3362',
        questionKo: '오늘 농가정식은 예약 없이 몇 시부터 먹을 수 있나요?',
      },
      checked: '2026-11-09', source: ohburimShop,
    },
    sources: [ohburimShop, ohburim, ohburimFarmGuide, visitKorea('Ohburim opening hours and set meal reservations', 188745), visitKorea('Namhae German Village', 75683), visitKorea('Namhae German Exhibition Hall', 68074),
      { label: 'VisitKorea · Kunst Lounge on Dogil-ro', url: 'https://english.visitkorea.or.kr/svc/whereToGo/hdrdslt/hdrdsltView.do?crsSn=206' },
      { label: 'Namhae Bus · German Village loop 020', url: 'https://tsbis.kr/393/main_search.do?main_searchKeyword=020' }],
  },
  {
    slug: 'yeosu-harbour', city: 'yeosu', name: 'Yeosu old harbour', nameKo: '여수 이순신광장 일대',
    cardRoute: 'A warm baguette burger, the harbour square and Jinnamgwan Hall',
    intro: 'Start across from Yi Sun-sin Square, walk to the waterfront, then head uphill to the wooden guest hall on the site of Yeosu’s naval base.',
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
    breakfast: {
      venue: 'Yeosudang', venueKo: '여수당', stop: 1,
      hours: 'VisitKorea lists a 07:30 shop opening in Korean and 09:30 in English.',
      address: 'Main shop · 72 Jungang-ro, Yeosu (중앙로 72)',
      detail: 'Call the main shop before heading to the square to ask when you can order and collect the first burger of the day.',
      ordering: {
        summary: 'First baguette burger · time unconfirmed',
        phone: '+82 61 661 0222',
        questionKo: '오늘 수제바게트버거는 몇 시부터 주문할 수 있나요? 가장 일찍 받을 수 있는 시간은 언제인가요?',
      },
      checked: '2026-11-09', source: yeosudang,
    },
    sources: [yeosudang, visitKorea('Yeosudang · English hours', 177537), visitKorea('Yi Sun-sin Square', 33693), visitKorea('Jinnamgwan Hall', 84183),
      { label: 'Yeosu City · main shop contact and hours', url: 'https://www.yeosu.go.kr/tour/lodge_food/food/group_food/other?idx=5897&mode=foodView' },
      { label: 'Yeosudang · main shop and bakery addresses', url: 'https://www.instagram.com/yeosudang/' },
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
        what: 'Walk between stalls selling chestnuts, dried mountain greens and medicinal roots. Each trader keeps their own hours.',
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
        what: 'Look for 하동 밤파이 on the menu. For a Naver order, collect the pies at the time you entered, even if the automatic ready message arrives earlier.',
      },
      {
        name: 'Ssanggye Myeongcha tea shop', nameKo: '쌍계명차', lat: 35.19088, lng: 127.62425,
        walk: 'Continue up Hwagae-ro past the terminal to number 30. The tea counter is on the ground floor.',
        what: 'Try ujeon (우전), an early-season green tea, or green tea ice cream. Upstairs is a small museum of tea wares. Walk back down the same street for the bus from Hwagae Terminal.',
      },
    ],
    food: { name: 'Hadong chestnut pie', nameKo: '하동 밤파이', detail: 'Look for the flaky pastry filled with chestnut paste and a whole chestnut at the bakery across from Hwagae Bus Terminal.', stop: 2 },
    breakfast: {
      venue: 'Bamtol bakery', venueKo: '밤톨', stop: 2,
      hours: 'The bakery lists shop hours of 09:00–18:00 daily.',
      address: '17-1 Hwagae-ro, Hwagae-myeon, Hadong (화개로 17-1)',
      detail: 'Enter your pickup time when ordering on Naver. For a pie without a reservation, call to ask when the first batch will be ready.',
      ordering: {
        summary: 'Reserved chestnut pies · pickup 09:30–18:00',
        phone: '+82 55 883 8999',
        questionKo: '오늘 예약 없이 밤파이를 사려면 몇 시부터 주문하고 바로 받을 수 있나요?',
        pickupUrl: 'https://m.booking.naver.com/order/bizes/530347/items/3938101?theme=place',
      },
      checked: '2026-11-09',
      source: { label: 'Bamtol · pickup hours on Naver Place', url: 'https://m.place.naver.com/restaurant/1973970023/information?entry=ple' },
    },
    sources: [bamtol, visitKorea('Hwagae Market', 80298),
      { label: 'VisitKorea · Ssanggye Myeongcha and buses from Hadong', url: 'https://access.visitkorea.or.kr/food/detail.do?cotId=97848a65-5d58-43a8-82b2-61de698a1cfb' },
      { label: 'VisitKorea · Bamtol bakery by Hwagae Terminal', url: 'https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=69b74eb5-1a10-4cfc-8387-dfbc7a2c4a67' },
      { label: 'Tmoney · coaches to and from Hwagae', url: 'https://txbus.t-money.co.kr/main.do' }],
  },
]
