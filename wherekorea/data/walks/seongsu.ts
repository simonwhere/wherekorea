import type { WalkGuide } from './types'

export const seongsu: WalkGuide = {
  slug: 'seongsu',
  city: 'seoul',
  name: 'Seongsu',
  nameKo: '성수',
  cardRoute: 'Daelim Changgo warehouse, then pork-bone soup',
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
      what: 'The sign reads 소문난성수감자탕. There are seats for one as well as tables for a group. For a solo seat, ask at the counter.',
    },
  ],
  food: {
    name: 'Pork-bone soup and stew',
    nameKo: '감자국 · 감자탕',
    detail: 'At the last stop, gamjaguk (감자국 식사) is the meal for one. For the table, gamjatang (감자탕) comes in a shared pot with pork bones and greens.',
  },
  sources: [
    { label: 'Visit Seoul · Seongsu Station and the streets', url: 'https://english.visitseoul.net/editorspicks/2026-Seongsu/ENNky3epf' },
    { label: 'OpenStreetMap · Seongsu Exit 3', url: 'https://www.openstreetmap.org/node/3404887386' },
    { label: 'Visit Seoul · Daelim Changgo warehouse', url: 'https://english.visitseoul.net/shopping/2024-musinsa-daelim/ENPnh3bjr' },
    { label: 'Visit Seoul · Somunnan Seongsu Gamjatang', url: 'https://english.visitseoul.net/area/SeongsuGamjatang/ENPlceoxk' },
    { label: 'VisitKorea · soup and stew menu (Korean)', url: 'https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=4c7ad228-1a53-4f8c-9fa7-3e0b70bb2097' },
  ],
}
