import type { WalkGuide } from './types'

export const seongsu: WalkGuide = {
  slug: 'seongsu',
  city: 'seoul',
  name: 'Seongsu',
  nameKo: '성수',
  cardRoute: 'Daelim Changgo warehouse → pork-bone soup at Seongsu Gamjatang',
  intro: 'Start under the elevated railway, walk past a red-brick warehouse and turn onto Yeonmujang-gil for pork-bone soup.',
  stops: [
    {
      name: 'Seongsu Station, Exit 3',
      nameKo: '성수역 3번 출구',
      lat: 37.54415, lng: 127.05692,
      walk: 'Take subway Line 2 to Seongsu and follow the signs for Exit 3.',
      what: 'At street level, the railway runs overhead along Achasan-ro. The walk takes Seongsui-ro south, away from the tracks.',
      photo: {
        src: '/walks/seongsu/station.webp',
        alt: 'Seongsu Station above Achasan-ro, seen from a side street.',
        credit: 'Aspere', license: 'CC0 1.0',
        source: 'https://commons.wikimedia.org/wiki/File:성수동_260523_31.jpg',
        licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      },
    },
    {
      name: 'Daelim Changgo warehouse',
      nameKo: '대림창고',
      lat: 37.54159, lng: 127.05641,
      walk: 'Follow Seongsui-ro past the Yeonmujang-gil junction to the old warehouse at number 74.',
      what: 'Look for the tall brick walls and white 대림창고 sign. Inside, Musinsa uses the high warehouse ceilings for a wall of sneakers and stepped displays.',
      photo: {
        src: '/walks/seongsu/warehouse.webp',
        alt: 'The brick warehouse frontage on Seongsui-ro, with the vertical 대림창고 sign.',
        credit: 'Aspere', license: 'CC0 1.0',
        source: 'https://commons.wikimedia.org/wiki/File:성수동_260523_06.jpg',
        licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      },
    },
    {
      name: 'Somunnan Seongsu Gamjatang',
      nameKo: '소문난성수감자탕',
      lat: 37.54288, lng: 127.05441,
      walk: 'Return to the Yeonmujang-gil junction. Follow the street west past the small shops to number 45.',
      what: 'Look for the 소문난성수감자탕 sign. Solo diners can ask at the counter for a seat. For the subway afterwards, Seongsu Station Exit 4 is about 230 m away.',
    },
  ],
  food: {
    stop: 3,
    name: 'Pork-bone soup and stew',
    nameKo: '감자국 · 감자탕',
    detail: 'At the last stop, gamjaguk (감자국 식사) is the meal for one. For the table, gamjatang (감자탕) comes in a shared pot with pork bones and greens.',
  },
  breakfast: {
    venue: 'Somunnan Seongsu Gamjatang', venueKo: '소문난성수감자탕', stop: 3,
    hours: 'Main restaurant: open 24 hours daily.',
    address: '45 Yeonmujang-gil, Seongdong-gu, Seoul',
    detail: 'For one person, ask for gamjaguk (감자국식사): regular (일반) or with extra greens (우거지). Neither version has a separate start time listed. For breakfast first, use Seongsu Station Exit 4.',
    checked: '2026-11-09',
    source: { label: 'Main restaurant · menu (Korean)', url: 'https://pcmap.place.naver.com/restaurant/11721256/menu/list' },
    ordering: {
      summary: 'Meals served around the clock',
      phone: '+82 2 465 6580',
      questionKo: '지금 본점에서 감자국식사 1인분 주문할 수 있나요? 일반이랑 우거지 둘 다 되나요?',
    },
  },
  sources: [
    { label: 'Visit Seoul · Seongsu Station and the streets', url: 'https://english.visitseoul.net/editorspicks/2026-Seongsu/ENNky3epf' },
    { label: 'OpenStreetMap · Seongsu Exit 3', url: 'https://www.openstreetmap.org/node/3404887386' },
    { label: 'Visit Seoul · Daelim Changgo warehouse', url: 'https://english.visitseoul.net/shopping/2024-musinsa-daelim/ENPnh3bjr' },
    { label: 'Visit Seoul · 24-hour dining at the main restaurant', url: 'https://english.visitseoul.net/restaurants/SeongsuGamjatang/ENPlceoxk' },
    { label: 'Main restaurant · soup and stew menu (Korean)', url: 'https://pcmap.place.naver.com/restaurant/11721256/menu/list' },
  ],
}
