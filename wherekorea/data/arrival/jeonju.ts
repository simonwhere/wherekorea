import type { ArrivalCard } from './types'

export const jeonju: ArrivalCard = {
  slug: 'jeonju',
  place: 'Jeondong Cathedral · Hanok Village',
  placeKo: '전동성당.한옥마을',
  station: 'Jeonju Station',
  stationKo: '전주역',
  returnStop: '30602',
  glance: {
    rail: 'Yongsan → Jeonju by KTX',
    onward: 'Bus 119 → Jeondong Cathedral · Hanok Village',
    back: 'Bus 119 → Jeonju Station → KTX to Yongsan',
  },
  fromSeoul: 'Board the KTX at Yongsan Station (용산역) in Seoul. Get off at Jeonju Station (전주역).',
  onward: 'Walk to 전주역첫마중길 (stop 31109). Take bus 119 toward Pyeonghwa-dong (평화동종점). Get off at Jeondong Cathedral · Hanok Village (전동성당.한옥마을, stop 30601).',
  returnLocal: 'Board across the road at stop 30602 (전동성당.한옥마을). Take bus 119 toward Jeonju University (전주대학교). Get off at 전주역첫마중길 (stop 31093) and walk to the station.',
  returnSeoul: 'Take the KTX from Jeonju to Yongsan (용산) in Seoul.',
  check: 'Look up stop 30602 for the next 119 before leaving the village. Check the departure time and seats for Jeonju → Yongsan on KORAIL.',
  checked: '2026-11-04',
  sources: [
    { label: 'KORAIL trains and seats', url: 'https://www.korail.com/global/eng/ticket/reservation', use: 'rail' },
    { label: 'Jeonju bus 119 route', url: 'https://its.jeonju.go.kr/fore/bus1.view?lang=en', use: 'local' },
    { label: 'Jeonju bus arrivals by stop number', url: 'https://its.jeonju.go.kr/fore/bus2.view?lang=en', use: 'return' },
    { label: 'Hanok Village directions', url: 'https://hanok.jeonju.go.kr/contents/en_map', use: 'local' },
  ],
}
