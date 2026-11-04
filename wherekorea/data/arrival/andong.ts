import type { ArrivalCard } from './types'

export const andong: ArrivalCard = {
  slug: 'andong',
  mainMode: 'rail',
  place: 'Hahoe Folk Village',
  placeKo: '하회마을',
  station: 'Andong Station',
  stationKo: '안동역',
  returnStop: '540854',
  glance: {
    fromSeoul: 'Cheongnyangni → Andong by KTX-Eum',
    onward: 'Bus 210 to Hahoe Folk Village',
    back: 'Bus 210 to Andong Station → Cheongnyangni',
  },
  fromSeoul: 'Take a KTX-Eum from Cheongnyangni (청량리) in Seoul to Andong.',
  onward: 'At the station bus stop 안동역(안동터미널), take bus 210 toward 하회보건진료소. Get off at Hahoe Village (하회마을).',
  returnLocal: 'At Hahoe Village (하회마을, stop 540854), board bus 210 toward Kyobo Life (교보생명). Get off at 안동역(안동터미널) for the train.',
  returnSeoul: 'Take a KTX-Eum from Andong to Cheongnyangni (청량리) in Seoul.',
  check: 'Before leaving for the village, check the return bus from 하회마을 and a later train from Andong.',
  checked: '2026-11-04',
  sources: [
    { label: 'KORAIL train times and seats', url: 'https://www.korail.com/global/eng/ticket/reservation', use: 'intercity' },
    { label: 'Andong bus stops · search 210', url: 'https://bus.andong.go.kr/route', use: 'local' },
    { label: 'Andong bus timetable · search 210', url: 'https://bus.andong.go.kr/timetable', use: 'local' },
    { label: 'Return bus arrivals · search 540854', url: 'https://bus.andong.go.kr/route?tab=stop', use: 'return' },
  ],
}
