import type { WalkGuide } from './types'

const nambuSources = [
  { label: 'VisitKorea · Nambu Market trading hours', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=75565' },
  { label: 'VisitKorea · riverside dawn market and market food', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=1593611' },
]

const nambuHours = 'The riverside produce market runs daily from 04:00 to 09:00 between Ssajeon Bridge (싸전다리) and Maegokgyo Bridge (매곡교). The covered market lists 09:30–23:00, with hours varying by shop.'

export const hanok: WalkGuide = {
  slug: 'hanok',
  city: 'jeonju',
  name: 'Jeonju Hanok Village',
  nameKo: '전주 한옥마을',
  cardRoute: 'From Gyeonggijeon Shrine to Nambu Market',
  intro: 'Start on Taejo-ro at Gyeonggijeon. Explore the hanok lanes, cross to the brick cathedral, then walk past the old city gate for lunch at Nambu Market.',
  stops: [
    {
      name: 'Gyeonggijeon Shrine',
      nameKo: '경기전',
      lat: 35.814176,
      lng: 127.149980,
      walk: 'From the Jeondong Cathedral / Hanok Village bus stop, walk to the shrine entrance at 44 Taejo-ro. Look for the stone dismounting post beside the gate.',
      what: 'Inside the walls, painted wooden gates lead to the hall dedicated to King Taejo. For a look at the hanok shops, follow Taejo-ro east to Eunhaeng-ro, then return to the shrine entrance.',
      photo: {
        src: '/walks/hanok/gyeonggijeon.webp',
        alt: 'A tiled gate with painted eaves at Gyeonggijeon Shrine',
        credit: 'Bernard Gagnon / Wikimedia Commons · resized and converted to WebP',
        license: 'CC0 1.0',
        source: 'https://commons.wikimedia.org/wiki/File:Gyeonggijeon_Shrine_01.jpg',
        licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      },
    },
    {
      name: 'Jeondong Cathedral',
      nameKo: '전동성당',
      lat: 35.81326,
      lng: 127.14920,
      walk: 'Back on Taejo-ro, cross from the shrine side to the cathedral at number 51.',
      what: 'Step into the forecourt to see the red-brick arches and three domed towers. This is a working church. Keep the entrance clear during services.',
      photo: {
        src: '/walks/hanok/jeondong.webp',
        alt: 'Three domed towers above the arched front doors of Jeondong Cathedral',
        credit: 'Mobius6 / Wikimedia Commons · resized and converted to WebP',
        license: 'CC BY-SA 4.0',
        source: 'https://commons.wikimedia.org/wiki/File:Jeondong_Catholic_Cathedral_20230408_001.jpg',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      },
    },
    {
      name: 'Nambu Market',
      nameKo: '남부시장',
      lat: 35.81278,
      lng: 127.14754,
      walk: 'Leave the cathedral and head west along Taejo-ro. Cross Paldal-ro towards Pungnammun, the old city gate. The covered market lanes are just south of the gate.',
      what: `Look for 피순대 (pi-sundae) on the signs for Jeonju’s sliced pork-blood sausage. ${nambuHours}`,
      photo: {
        src: '/walks/hanok/nambu.webp',
        alt: 'Sliced pi-sundae served with radish kimchi and garlic at Jeonju Nambu Market',
        credit: 'Jjw / Wikimedia Commons · resized and converted to WebP',
        license: 'CC BY 4.0',
        source: 'https://commons.wikimedia.org/wiki/File:20240725_Jeonju_southern_market_-Pisundae.jpg',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      },
    },
  ],
  food: {
    name: 'Bean sprout and rice soup',
    nameKo: '콩나물국밥',
    detail: 'In the ground-floor market lanes, look for 콩나물국밥 (kongnamul-gukbap). The market style is made by ladling hot broth over rice and bean sprouts. Anchovies and kelp often go into the broth.',
  },
  sources: [
    { label: 'Jeonju City · Hanok Village walking routes', url: 'https://tour.jeonju.go.kr/eng/index.jeonju?menuCd=DOM_000000205004000000' },
    { label: 'Jeonju Hanok Village · getting here', url: 'https://hanok.jeonju.go.kr/contents/en_map' },
    { label: 'Academy of Korean Studies · the dismounting post at the start', url: 'https://dh.aks.ac.kr/~heritage/wiki/index.php/전주_경기전_하마비' },
    { label: 'VisitKorea · Gyeonggijeon Shrine', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=108728' },
    { label: 'VisitKorea · Jeondong Cathedral', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=108717' },
    { label: 'Jeonju City · Nambu Market and its soup', url: 'https://tour.jeonju.go.kr/eng/index.jeonju?menuCd=DOM_000000203011001000' },
    ...nambuSources,
  ],
}

const sinbaengiHours = {
  label: 'Jeonbuk Food Culture Plaza · Sinbaengi menu, hours and closing days (Korean)',
  url: 'https://jbfood.go.kr/juhtml/food/foodshop/main.html?cnt=1191&smbu=shop2&fpmode=view',
}

export const hanokBreakfast: WalkGuide = {
  slug: 'hanok-breakfast',
  city: 'jeonju',
  name: 'Breakfast in Hanok Village',
  nameKo: '한옥마을 아침 산책',
  cardRoute: 'Bean sprout soup at Sinbaengi, then Nambu Market',
  aliases: ['Sinbaengi', '콩나물국밥', '남부시장'],
  intro: 'Sit down for bean sprout soup in the hanok lanes, then walk past the red-brick cathedral and the old city gate to Nambu Market.',
  stops: [
    {
      name: 'Sinbaengi',
      nameKo: '신뱅이',
      lat: 35.812636,
      lng: 127.151819,
      walk: 'From Taejo-ro in Hanok Village, turn south onto Gyeonggijeon-gil. Follow the street numbers to 153-9 and look for the sign 신뱅이 in the side lane.',
      what: 'Order 콩나물국밥 for a bowl of rice and bean sprout soup. The menu offers two kimchis in the soup: 빨간김치 (red kimchi) and 백김치 (white kimchi).',
      photo: {
        src: '/walks/hanok/jeonju-bean-sprout-soup.webp',
        alt: 'Bean sprouts, scallions and chili in a black soup bowl with kimchi alongside',
        caption: 'Jeonju bean sprout soup · a local example photographed in Jeonju.',
        credit: 'Chae Ji-hyeong (채지형) / Korea Copyright Commission · Jeonju dish photo, resized and converted to WebP',
        license: 'CC BY 4.0',
        source: 'https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=200018&wrtSn=13278905',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      },
    },
    {
      ...hanok.stops[1],
      walk: 'Return to Gyeonggijeon-gil and walk north to Taejo-ro. Turn left. The cathedral stands on the left at number 51, across the street from Gyeonggijeon Shrine.',
      what: 'Look for three domes above the red-brick façade. You can see them from Taejo-ro when the church grounds are closed.',
    },
    {
      ...hanok.stops[2],
      walk: 'Continue west on Taejo-ro to Paldal-ro. Use the crossing toward Pungnammun Gate (풍남문), then take the lane on its south side into the covered market.',
      what: `For fresh produce before 09:00, continue south to the river. ${nambuHours}`,
      photo: {
        src: '/walks/hanok/nambu-entrance.webp',
        alt: 'Tiled entrance sign above a lane into Jeonju Nambu Market',
        credit: 'Jjw / Wikimedia Commons · resized and converted to WebP',
        license: 'CC BY 4.0',
        source: 'https://commons.wikimedia.org/wiki/File:20240725_Jeonju_southern_market_001.jpg',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      },
    },
  ],
  food: {
    name: 'Rice soup with bean sprouts and kimchi',
    nameKo: '김치 콩나물국밥',
    detail: 'At Sinbaengi, choose the red-kimchi or white-kimchi version. The soup pictured is a local example photographed in Jeonju.',
    stop: 1,
  },
  breakfast: {
    venue: 'Sinbaengi', venueKo: '신뱅이', stop: 1,
    hours: 'Restaurant open 08:00–20:00 daily.',
    address: '153-9 Gyeonggijeon-gil, Wansan-gu, Jeonju · 경기전길 153-9',
    detail: 'Choose red kimchi (빨간김치) or milder white kimchi (백김치) in your soup. For the riverside produce stalls, reach Nambu Market before 09:00.',
    ordering: {
      summary: 'Bean sprout soup from 08:00',
      phone: '+82 63 282 3030',
      questionKo: '오늘 아침 8시에 콩나물국밥을 먹을 수 있나요? 백김치와 빨간김치 둘 다 되나요?',
    },
    checked: '2026-11-09',
    source: { label: 'Jeonju City · soup served from 08:00', url: 'https://tour.jeonju.go.kr/board/view.jeonju?boardId=BBS_0000038&dataSid=14264' },
  },
  sources: [
    sinbaengiHours,
    { label: 'Jeonju Hanok Village · official lane map and addresses', url: 'https://hanok.jeonju.go.kr/assets/down/2024-hanokvillage-map-new3.pdf' },
    { label: 'VisitKorea · Jeondong Cathedral', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=108717' },
    { label: 'Jeonju City · Nambu Market', url: 'https://tour.jeonju.go.kr/eng/index.jeonju?menuCd=DOM_000000203011001000' },
    ...nambuSources,
  ],
}
