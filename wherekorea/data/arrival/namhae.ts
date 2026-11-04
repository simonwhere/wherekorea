import type { ArrivalCard } from './types'

export const namhae: ArrivalCard = {
  slug: 'namhae',
  mainMode: 'coach',
  place: 'German Village',
  placeKo: '독일마을',
  station: 'Namhae Bus Terminal',
  stationKo: '남해공용터미널',
  returnStop: '3930625',
  glance: {
    fromSeoul: 'Seoul Nambu → Namhae by intercity bus',
    onward: 'Loop bus 020 via Gacheon → German Village',
    back: '020 via Dongcheon Junction → terminal → Seoul Nambu',
  },
  fromSeoul: 'Take an intercity bus from Seoul Nambu (서울남부) to Namhae (남해). Get off at Namhae Bus Terminal.',
  onward: 'Board loop bus 020 (뚜벅이버스) at 남해공용터미널(시점), stop 3930542. It runs via Gacheon (가천) before reaching German Village (독일마을), stop 3930625.',
  returnLocal: 'After your visit, board a later 020 at the same German Village stop (독일마을, 3930625). It continues via Dongcheon Junction (동천삼거리), the next stop. Get off at 남해공용터미널(종점), stop 3930612.',
  returnSeoul: 'At Namhae Bus Terminal, take the intercity coach to Seoul Nambu (서울남부).',
  check: 'Before getting off at German Village, check when the next 020 will pass and whether it reaches the terminal before your Seoul Nambu coach. The 020 timetable lists departures from the terminal.',
  checked: '2026-11-04',
  sources: [
    { label: 'Tmoney intercity coaches · Seoul Nambu and Namhae', url: 'https://txbus.t-money.co.kr/main.do', use: 'intercity' },
    { label: 'Namhae bus 020 · route and terminal departures', url: 'https://tsbis.kr/393/main_search.do?main_searchKeyword=020', use: 'local' },
    { label: 'German Village · return stop 3930625', url: 'https://tsbis.kr/393/main_search.do?main_searchKeyword=3930625', use: 'return' },
  ],
}
