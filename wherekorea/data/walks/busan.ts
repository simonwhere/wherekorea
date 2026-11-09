import type { WalkGuide } from './types'

export const gwangalli: WalkGuide = {
  slug: 'gwangalli',
  city: 'busan',
  name: 'Gwangalli',
  nameKo: '광안리',
  cardRoute: 'Bridge lights along the beach, then sliced fish at Millak',
  intro: 'Start on the sand facing Gwangan Bridge. Follow the curve of the beach to the live-fish market at its eastern end.',
  stops: [
    {
      name: 'Gwangalli Beach',
      nameKo: '광안리해수욕장',
      lat: 35.15377, lng: 129.11852,
      walk: 'From Gwangan Station (광안역) on Metro Line 2, use Exit 3 or 5 and follow the beach signs to Gwanganhaebyeon-ro. The walk starts where the road meets the sand.',
      what: 'The suspension bridge lights up across the water after dark. The drone show usually runs on Saturdays and can move or be cancelled in bad weather. Check the programme for the day. The annual fireworks are a separate event.',
      photo: {
        src: '/walks/busan/gwangalli.webp',
        alt: 'Blue suspension cables and lit towers of Gwangan Bridge seen across the water from Gwangalli.',
        credit: 'lumoplank · resized and converted to WebP', license: 'CC0 1.0',
        source: 'https://commons.wikimedia.org/wiki/File:Gwangan_Bridge_and_Gwangalli_Beach_-_Gwangalli2721.jpg',
        licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      },
    },
    {
      name: 'Gwangalli seafront promenade',
      nameKo: '광안리해변 테마거리',
      lat: 35.15513, lng: 129.12211,
      walk: 'Facing the bridge, turn left and follow the promenade toward Millak. Keep the beach on your right as the road curves around the bay.',
      what: 'Café windows face the water across the seafront road. Pause on the promenade for a view back along the crescent of sand before continuing toward the fish market.',
    },
    {
      name: 'Millak Hoe Town fish market',
      nameKo: '민락회타운',
      lat: 35.15564, lng: 129.12370,
      walk: 'Continue to the end of the sand. Look for 민락회타운 at 1 Millaksubyeon-ro. To return by metro, walk back inland to Gwangan Station on Line 2.',
      what: 'On the ground floor, sellers keep live fish in tanks. The restaurants upstairs look back over the bridge. For Seomyeon, take Line 2 toward Yangsan. For Haeundae, take it toward Jangsan.',
    },
  ],
  food: {
    name: 'Sliced raw fish',
    nameKo: '생선회',
    detail: 'At Millak Hoe Town, look for hoe (회), fish cut into thin slices. Before choosing a fish downstairs, ask for the total price and whether the upstairs restaurant charges separately for the table or side dishes.',
    stop: 3,
  },
  sources: [
    { label: 'VisitKorea · Gwangalli Beach', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=111074' },
    { label: 'VisitKorea · beachfront promenade', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=189755' },
    { label: 'Visit Busan · Millak Hoe Town', url: 'https://www.visitbusan.net/index.do?lang_cd=en&menuCd=DOM_000000301003001000&uc_seq=293' },
    { label: 'Gwangalli drone show · programme and cancellations', url: 'https://www.gwangallimdrone.co.kr/en/notice' },
    { label: 'Busan Fireworks Festival', url: 'https://www.busanfireworks.com/' },
  ],
}

export const nampo: WalkGuide = {
  slug: 'nampo',
  city: 'busan',
  name: 'Nampo',
  aliases: ['남포동', 'Nampo-dong', 'Nampodong'],
  nameKo: '남포',
  cardRoute: 'Market noodles, seed hotteok at BIFF Square and the fish harbour',
  intro: 'Start in Gukje Market’s food alley, cross the old cinema district and finish by the water at Jagalchi. The seed-filled pancake stalls are in the middle of the walk.',
  stops: [
    {
      name: 'Gukje Market food alley',
      nameKo: '국제시장 먹자골목',
      lat: 35.10109, lng: 129.02805,
      walk: 'From Jagalchi Station (자갈치역) on Metro Line 1, take Exit 7. Walk north away from the harbour and follow the 국제시장 signs into the market lanes.',
      what: 'Look for small seats beside trays of noodles and rice rolls. A plate of bibim dangmyeon (비빔당면) comes with glass noodles mixed with spicy seasoning.',
    },
    {
      name: 'BIFF Square',
      nameKo: '비프광장',
      lat: 35.09881, lng: 129.02918,
      walk: 'Walk south from the market lanes toward Gudeok-ro. Enter the cinema street marked BIFF 광장 and follow the paving past the food stalls.',
      what: 'Film stars’ handprints are set into the pavement. Beside the stalls, watch hot pancakes being split open and filled with seeds. The handprints mark the festival’s old cinema district.',
      photo: {
        src: '/walks/busan/nampo.webp',
        alt: 'Food stalls under red and yellow umbrellas line the lit pedestrian street in BIFF Square at night.',
        credit: 'Christophe95, 2018 · resized and converted to WebP', license: 'CC BY-SA 4.0',
        source: 'https://commons.wikimedia.org/wiki/File:BIFF_Square_at_night.jpg',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      },
    },
    {
      name: 'Jagalchi Fish Market',
      nameKo: '자갈치시장',
      lat: 35.09661, lng: 129.03058,
      walk: 'Cross Gudeok-ro at a pedestrian crossing and follow 자갈치시장 signs toward the water. The market hall is at 52 Jagalchihaean-ro. Back on Gudeok-ro, Jagalchi and Nampo stations both serve Line 1.',
      what: 'Outside, the fish stalls run along narrow lanes. Inside the market building, live fish are sold downstairs and seafood meals are served upstairs. The hall usually closes on the first and third Tuesdays. Check ahead for a fifth Tuesday or holiday.',
    },
  ],
  food: {
    name: 'Seed hotteok',
    nameKo: '씨앗호떡',
    detail: 'At BIFF Square, ask for ssiat hotteok (씨앗호떡). The vendor fries a sweet pancake on a griddle, cuts it open and adds a crunchy seed mixture. For a savoury snack, look for eomuk (어묵), fish cake on a skewer, at the nearby stalls.',
    stop: 2,
  },
  sources: [
    { label: 'VisitKorea · Gukje Market food alley', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=90815' },
    { label: 'Visit Busan · BIFF Square and Nampo street food', url: 'https://visitbusan.net/en/index.do?lang_cd=en&menuCd=DOM_000000302011001000&uc_seq=2809' },
    { label: 'VisitKorea · BIFF Square', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=95411' },
    { label: 'Visit Busan · Jagalchi Market and closing days', url: 'https://www.visitbusan.net/index.do?contentsSid=22&lang_cd=en&uc_seq=412' },
  ],
}

const pohangGukbap = { label: 'Visit Busan · Pohang Dwaeji Gukbap on the soup alley', url: 'https://www.visitbusan.net/index.do?lang_cd=ko&menuCd=DOM_000000201002004001&uc_seq=2420' }

export const jeonpo: WalkGuide = {
  slug: 'jeonpo',
  city: 'busan',
  name: 'Jeonpo',
  breakfast: {
    venue: 'Pohang Dwaeji Gukbap', venueKo: '포항돼지국밥',
    hours: 'The shop’s Naver listing and Visit Busan both say 24 hours. VisitKorea lists 05:00–21:40.',
    detail: 'For a bowl before dawn, call the shop in Seomyeon Market. Look for the 포항돼지국밥 sign at number 27.',
    address: '27 Seomyeon-ro 68beon-gil, Busanjin-gu, Busan',
    ordering: {
      summary: 'Pork and rice soup · call before an early visit',
      phone: '+82 51 807 5439',
      questionKo: '오늘 새벽에도 매장에서 돼지국밥을 먹을 수 있나요? 주문을 쉬는 시간이 있나요?',
    },
    checked: '2026-11-09', stop: 3,
    source: pohangGukbap,
  },
  aliases: ['전포동', 'Jeonpo-dong', 'Jeonpo Cafe Street'],
  nameKo: '전포',
  cardRoute: 'Café lanes and old tool shops, then pork soup in Seomyeon',
  intro: 'Start near Jeonpo Station for coffee, follow the former hardware lanes and head west into Seomyeon for a bowl of Busan’s pork and rice soup.',
  stops: [
    {
      name: 'Jeonpo Café Street',
      nameKo: '전포카페거리',
      lat: 35.15542, lng: 129.06734,
      walk: 'Take Metro Line 2 to Jeonpo Station (전포역). From Exit 7, follow the signs for the café streets. The pin marks the café district.',
      what: 'Narrow lanes between former workshops and low houses open onto coffee bars and bakeries. Pick a counter for coffee and a pastry here. Each shop keeps its own hours.',
      photo: {
        src: '/walks/busan/jeonpo.webp',
        alt: 'Café doorways and plants line a narrow painted lane in Jeonpo, with taller buildings beyond.',
        credit: 'Korea Tourism Organization, 2020 · Busan Jeonpo Café Street, photo 2717 · converted to WebP', license: 'KOGL Type 1',
        source: 'https://www.kogl.or.kr/recommend/recommendDivView.do?division=img&recommendIdx=38063',
        licenseUrl: 'https://www.kogl.or.kr/info/licenseType1.do',
      },
    },
    {
      name: 'Jeonpo Tool Street',
      nameKo: '전포공구길',
      lat: 35.15869, lng: 129.06425,
      walk: 'Head northwest to Seojeon-ro. Cross at the lights, then turn into Seojeon-ro 37beon-gil (서전로37번길). The pin is at number 20.',
      what: 'Gonggu (공구) means tools. In these blocks, former hardware stores now house small cafés and gift shops. The old shopfronts sit close to the street.',
    },
    {
      name: 'Seomyeon pork soup alley',
      nameKo: '서면 돼지국밥골목',
      lat: 35.155785, lng: 129.05853,
      walk: 'Head west toward Seomyeon Station. Cross Jungang-daero and follow Seomyeon-ro 68beon-gil beside Seomyeon Market. Look for 포항돼지국밥 at number 27 on the soup alley.',
      what: 'Look for 돼지국밥 on the boards outside the restaurants. After the meal, walk north to Seomyeon Station for Metro Lines 1 and 2.',
    },
  ],
  food: {
    name: 'Pork and rice soup',
    nameKo: '돼지국밥',
    detail: 'On the last stretch, order dwaeji gukbap (돼지국밥), a bowl of pork broth with sliced pork and rice. Chives and salted shrimp often come on the side so you can season the broth at the table.',
    stop: 3,
  },
  sources: [
    { label: 'Visit Busan · Jeonpo Station and café streets', url: 'https://www.visitbusan.net/index.do?lang_cd=en&menuCd=DOM_000000201001001000&uc_seq=1641' },
    { label: 'VisitKorea · Jeonpo Café Street', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=192977' },
    { label: 'VisitKorea · Jeonpo Tool Street', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=183790' },
    { label: 'VisitKorea · Busan pork and rice soup', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=221285' },
    pohangGukbap,
    { label: 'Naver Map · Pohang Dwaeji Gukbap hours and menu', url: 'https://map.naver.com/p/entry/place/11738501' },
    { label: 'VisitKorea · Pohang Dwaeji Gukbap hours', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=60053' },
  ],
}
