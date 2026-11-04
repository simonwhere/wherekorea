import type { ArrivalCard } from './types'

export const gyeongju: ArrivalCard = {
  slug: 'gyeongju',
  mainMode: 'rail',
  place: 'Hwangnidan-gil & Daereungwon',
  placeKo: '황리단길 · 대릉원',
  station: 'Gyeongju Station',
  stationKo: '경주역',
  returnStop: '01315',
  glance: {
    fromSeoul: 'Seoul Station → Gyeongju by KTX',
    onward: 'Bus 710 to Hwangnidan-gil',
    back: 'Bus 710 to Gyeongju Station → Seoul Station',
  },
  fromSeoul: 'Take a KTX from Seoul Station (서울역) to Gyeongju Station.',
  onward: 'At 경주역(KTX), take bus 710 to Cheonmachong Rear Gate (천마총후문.황리단길). Walk from here to the tombs and Hwangnidan-gil.',
  returnLocal: 'Board bus 710 at 천마총후문.황리단길, stop 01315. The next stop is the bus terminal (고속버스.시외버스터미널). Stay on to 경주역(KTX)종점.',
  returnSeoul: 'Take a KTX from Gyeongju Station to Seoul Station (서울역).',
  check: 'Check the next 710 at stop 01315 before leaving the tombs. Allow time between the bus arrival and your KTX.',
  checked: '2026-11-04',
  sources: [
    { label: 'KORAIL train times and seats', url: 'https://www.korail.com/global/eng/ticket/reservation', use: 'intercity' },
    { label: 'Buses at Gyeongju Station', url: 'https://livebus.gyeongju.go.kr/?s352000923', use: 'local' },
    { label: 'Buses at return stop 01315', url: 'https://livebus.gyeongju.go.kr/?s352000893', use: 'return' },
  ],
}
