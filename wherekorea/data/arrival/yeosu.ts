import type { ArrivalCard } from './types'

export const yeosu: ArrivalCard = {
  slug: 'yeosu',
  mainMode: 'rail',
  place: 'Hyangiram Hermitage',
  placeKo: '향일암',
  station: 'Yeosu EXPO Station',
  stationKo: '여수엑스포역',
  returnStop: '3251042',
  glance: {
    fromSeoul: 'Yongsan → Yeosu EXPO by KTX',
    onward: 'Bus 2 → bus 111 to Impo (Hyangiram)',
    back: 'Bus 111 → bus 2 → KTX to Yongsan',
  },
  fromSeoul: 'Take the KTX from Yongsan (용산) in Seoul to Yeosu EXPO Station (여수엑스포역).',
  onward: 'At the station (3259001), take bus 2 toward 화장동차고지. Get off at 서교동천주교성당 (3251180). At that same stop, board bus 111 for 임포(향일암) and ride to the last stop (3251044). Walk up to the hermitage.',
  returnLocal: 'Walk to the Impo Hansol Hoetjip stop (임포한솔횟집, 3251042). Take bus 111 toward 한국전력. At Yi Sun-sin Square (이순신광장, 3250846), change at the same stop to bus 2 for 여수엑스포역 (3259001).',
  returnSeoul: 'Take a KTX from Yeosu EXPO Station to Yongsan (용산) in Seoul.',
  check: 'Search for 3251042 before leaving the hermitage. Two stops are named 임포한솔횟집. Allow time for both buses before your train.',
  checked: '2026-11-04',
  sources: [
    { label: 'KORAIL train times and seats', url: 'https://www.korail.com/global/eng/ticket/reservation', use: 'intercity' },
    { label: 'Yeosu City · directions to Hyangiram', url: 'https://www.yeosu.go.kr/tour/travel/10tour/hyangilam', use: 'local' },
    { label: 'Yeosu bus routes · search 2 or 111', url: 'https://its.yeosu.go.kr/bus/busroute', use: 'local' },
    { label: 'Return bus arrivals · search 3251042', url: 'https://its.yeosu.go.kr/bus/busstop', use: 'return' },
  ],
}
