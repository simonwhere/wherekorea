import type { ArrivalCard } from './types'

export const sokcho: ArrivalCard = {
  slug: 'sokcho',
  mainMode: 'coach',
  place: 'Seoraksan National Park · Sogongwon entrance',
  placeKo: '설악산소공원',
  station: 'Sokcho Express Bus Terminal',
  stationKo: '속초고속버스터미널',
  returnStop: '4311290',
  glance: {
    fromSeoul: 'Seoul Gyeongbu → Sokcho by express bus',
    onward: 'Bus 7 or 7-1 → Seoraksan Sogongwon',
    back: '7 or 7-1 → express terminal → Seoul Gyeongbu',
  },
  fromSeoul: 'Take an express bus from Seoul Express Bus Terminal (서울경부) to Sokcho (속초). The coach arrives at Sokcho Express Bus Terminal on Donghae-daero, near Sokcho Beach.',
  onward: 'At 고속버스터미널 (stop 4311120), take a 7 or 7-1 marked 설악산소공원. Ride to that last stop for the park entrance. The late 7-1 marked 대포종점 ends before the park.',
  returnLocal: 'Board a 7 or 7-1 at 설악산소공원 (stop 4311290) toward town. The next stop is 켄싱턴호텔 (Kensington Hotel). Get off at 고속버스터미널 (stop 4311440) for your coach.',
  returnSeoul: 'Take the express bus from 속초고속버스터미널 back to Seoul Gyeongbu (서울경부). Sokcho Intercity Bus Terminal (속초시외버스터미널) is a separate terminal on Jangan-ro.',
  check: 'Check the bus back from stop 4311290 before heading onto the trails. On KOBUS, select Sokcho → Seoul Gyeongbu to check the return coach for your date.',
  checked: '2026-11-04',
  sources: [
    { label: 'KOBUS express coaches and seats', url: 'https://www.kobus.co.kr/', use: 'intercity' },
    { label: 'Sokcho City guide to both terminals', url: 'https://www.sokcho.go.kr/ct/tour/tour_guide/traffic', use: 'intercity' },
    { label: 'Park-bound buses at stop 4311120', url: 'https://bis.sokcho.go.kr/search?type=station&tab=station&keyword=4311120', use: 'local' },
    { label: 'Return buses at Sogongwon · 4311290', url: 'https://bis.sokcho.go.kr/search?type=station&tab=station&keyword=4311290', use: 'return' },
  ],
}
