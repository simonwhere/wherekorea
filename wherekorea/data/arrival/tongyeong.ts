import type { ArrivalCard } from './types'

export const tongyeong: ArrivalCard = {
  slug: 'tongyeong',
  mainMode: 'coach',
  place: 'Jungang Market',
  placeKo: '중앙시장',
  station: 'Tongyeong Bus Terminal',
  stationKo: '통영종합버스터미널',
  returnStop: '3830335',
  glance: {
    fromSeoul: 'Seoul Gyeongbu → Tongyeong by express bus',
    onward: 'Bus 101 to Jungang Market',
    back: 'Bus 101 to the terminal → Seoul Gyeongbu',
  },
  fromSeoul: 'Take the express bus from Seoul Express Bus Terminal, Gyeongbu line (서울경부), to Tongyeong Bus Terminal (통영종합버스터미널).',
  onward: 'At the local bus stop 시외버스터미널 (stop 3830057), board bus 101 toward Donam-dong (도남동). Get off at Jungang Market (중앙시장, stop 3830334).',
  returnLocal: 'At Jungang Market (중앙시장), board bus 101 at stop 3830335 toward 신우희가로. The next stop is Toseong-gogae (토성고개). Get off at 시외버스터미널 (stop 3830058) for the coach.',
  returnSeoul: 'Take the express bus from Tongyeong to Seoul Gyeongbu (서울경부).',
  check: 'Look up the next 101 at stop 3830335. On KOBUS select Tongyeong as the departure and Seoul Gyeongbu as the destination for your date.',
  checked: '2026-11-04',
  sources: [
    { label: 'KOBUS express bus times and seats', url: 'https://www.kobus.co.kr/main.do', use: 'intercity' },
    { label: 'Tongyeong transport guide · Seoul coach terminals', url: 'https://www.timf.org/kr/sub/timf/map_01.asp', use: 'intercity' },
    { label: 'Tongyeong bus 101 · both directions', url: 'https://tsbis.kr/383/main_search.do?main_searchKeyword=101', use: 'local' },
    { label: 'Jungang Market · return stop 3830335', url: 'https://tsbis.kr/383/main_search.do?main_searchKeyword=3830335', use: 'return' },
  ],
}
