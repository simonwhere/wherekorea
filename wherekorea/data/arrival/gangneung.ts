import type { ArrivalCard } from './types'

export const gangneung: ArrivalCard = {
  slug: 'gangneung',
  mainMode: 'rail',
  place: 'Gyeongpo Beach',
  placeKo: '경포해변',
  station: 'Gangneung Station',
  stationKo: '강릉역',
  returnStop: '4201242',
  glance: {
    fromSeoul: 'Seoul Station → Gangneung by KTX',
    onward: 'Bus 202-1 → Gyeongpo Beach terminus',
    back: 'Bus 202 via Gyeongpo Lake → KTX to Seoul Station',
  },
  fromSeoul: 'Take a KTX from Seoul Station (서울역) to Gangneung Station (강릉역).',
  onward: 'At 강릉역 (stop 4200721), take bus 202-1 toward Gyeongpo Beach. Its next stop is 가작다리입구. Ride past Gyeongpo Lake (경포호) to the last stop, 경포해변(종점), stop 4201420.',
  returnLocal: 'Board a departing 202 at 경포해변 (stop 4201242). Its next stop is Gyeongpo Lake (경포호). Get off at 강릉역건너편 (stop 4200293) and cross to Gangneung Station.',
  returnSeoul: 'Take a KTX from Gangneung to Seoul Station (서울역). Select Seoul Station as your arrival station when checking trains.',
  check: 'Both loops start and finish at the beach. Look up departures at 4201242 before leaving and allow time to reach the station for your train.',
  checked: '2026-11-04',
  sources: [
    { label: 'KORAIL train times and seats', url: 'https://www.korail.com/global/eng/ticket/reservation', use: 'intercity' },
    { label: 'Gangneung Station · bus stop 4200721', url: 'https://bis.gn.go.kr/search?type=station&tab=station&keyword=4200721', use: 'local' },
    { label: 'Gyeongpo Beach departures · stop 4201242', url: 'https://bis.gn.go.kr/search?type=station&tab=station&keyword=4201242', use: 'return' },
  ],
}
