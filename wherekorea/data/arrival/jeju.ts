import type { ArrivalCard } from './types'

export const jeju: ArrivalCard = {
  slug: 'jeju',
  mainMode: 'flight',
  place: 'Jusangjeolli Cliff, Jungmun',
  placeKo: '중문대포해안 주상절리대',
  station: 'Jeju International Airport',
  stationKo: '제주국제공항',
  returnStop: '406000402',
  glance: {
    fromSeoul: 'Seoul Gimpo → Jeju by air',
    onward: 'Gate 5 · bus 600 to Jusangjeolli Cliff',
    back: 'Airport-bound 600 → Jeju Airport → Seoul Gimpo',
  },
  fromSeoul: 'Fly from the domestic terminal at Seoul Gimpo (김포공항, GMP) to Jeju (제주공항, CJU).',
  onward: 'Leave arrivals through Gate 5. Take limousine bus 600 toward Seogwipo KAL Hotel (서귀포칼호텔). Get off at 제주국제컨벤션센터 중문대포해안주상절리대[남] and walk to the cliff.',
  returnLocal: 'Board bus 600 at the north stop, 제주국제컨벤션센터[북] (406000402). Choose 제주국제공항 (Jeju Airport) as the destination. A 600 marked 제주 썬호텔 ends one stop short of the airport.',
  returnSeoul: 'At Jeju Airport, follow Domestic Departures (국내선 출발) for your flight to Seoul Gimpo (GMP).',
  check: 'Open the north stop’s arrivals and check the destination beside 600. Allow time for the bus ride, airline check-in and airport security.',
  checked: '2026-11-04',
  sources: [
    { label: 'Gimpo–Jeju flights · Korean Air', url: 'https://www.koreanair.com/flights/en/flights-from-seoul-to-jeju', use: 'intercity' },
    { label: 'Jeju Airport · bus 600 boarding point', url: 'https://www.airport.co.kr/jeju/cms/frCon/index.do?CONTENTS_NO=2&MENU_ID=100', use: 'local' },
    { label: 'Airport buses at the north stop', url: 'https://bus.jeju.go.kr/mobile/station/detailStation/406000402?type=station&mode=normal', use: 'return' },
    { label: 'Jeju to Gimpo flights · Korean Air', url: 'https://www.koreanair.com/flights/en/flights-from-jeju-to-seoul', use: 'intercity' },
  ],
}
