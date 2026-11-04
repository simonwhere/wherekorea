export type TravelEvidenceLink = {
  label: string
  url: string
  publisher: string
  language: 'English' | 'Korean'
  scope: string
}

export type TravelEvidenceSource = TravelEvidenceLink & { id: string }

export type TravelEvidence = {
  /** The pages below were read on this date, not a full journey or price audit. */
  checkedAt: string
  /** Editorial decision guidance; not a verified total journey time. */
  summary: string
  claims: readonly { text: string; sourceIds: readonly string[] }[]
  cautions: readonly string[]
  sources: readonly TravelEvidenceSource[]
  unverified: readonly string[]
  bookingLinks: readonly TravelEvidenceLink[]
}

const KORAIL: TravelEvidenceLink = {
  label: 'Check trains on KORAIL (English)',
  url: 'https://www.korail.com/global/eng/ticket/reservation',
  publisher: 'Korea Railroad Corporation',
  language: 'English',
  scope: 'Train schedules and reservations. Check fares, seats and accepted payment methods for your departure.',
}

const UNVERIFIED = [
  'Door-to-door time, waiting time and the last return connection for your travel date.',
  'Current fares, available seats and payment completion.',
  'Actual hotel prices and the daily budget estimate.',
] as const

// Claim-level review for five decision scenarios. Deliberately do not fabricate
// equal coverage for the other destinations or update trust.*.last_verified.
// Official guides may themselves contain old timetables: see each source scope.
export const TRAVEL_EVIDENCE: Readonly<Record<string, TravelEvidence>> = {
  suwon: {
    checkedAt: '2026-10-08',
    summary: 'Suwon Station is not the fortress entrance; a local bus connects to Hwaseong Haenggung.',
    claims: [{
      text: 'Suwon Cultural Foundation describes Line 1 to Suwon Station followed by a city bus to Hwaseong Haenggung.',
      sourceIds: ['suwon-directions'],
    }],
    cautions: [
      'Train and subway times end at Suwon Station. The fortress walls are a separate walk after the bus ride.',
      'Check the current bus stop and route before leaving the station.',
    ],
    sources: [{
      id: 'suwon-directions',
      label: 'Suwon Station to the Hwaseong area',
      url: 'https://www.swcf.or.kr/english/?p=29',
      publisher: 'Suwon Cultural Foundation',
      language: 'English',
      scope: 'Station-to-fortress directions. Bus numbers and fares may have changed.',
    }],
    unverified: [...UNVERIFIED, 'The seeded 30-minute train / one-hour subway estimates for a specific departure.'],
    bookingLinks: [KORAIL],
  },
  jeonju: {
    checkedAt: '2026-10-08',
    summary: 'The station-to-village connection is a separate bus or taxi journey.',
    claims: [
      {
        text: 'Jeonju City recommends checking Yongsan departures for KTX. Its roughly 1 hour 40 minute estimate is the train ride to Jeonju, not arrival at Hanok Village.',
        sourceIds: ['jeonju-arrival'],
      },
      {
        text: 'The official Hanok Village directions list a separate city-bus journey from Jeonju Station to the village.',
        sourceIds: ['jeonju-last-mile'],
      },
    ],
    cautions: [
      'Hanok Village and the railway station are in different parts of the city.',
      'KTX seats can sell out on weekends, holidays and during festivals; check the return service too.',
    ],
    sources: [
      {
        id: 'jeonju-arrival',
        label: 'Getting to Jeonju and booking guidance',
        url: 'https://tour.jeonju.go.kr/eng/index.jeonju?menuCd=DOM_000000205008001000',
        publisher: 'Jeonju City',
        language: 'English',
        scope: 'Arrival routes and train-ticket guidance. The duration covers the train ride only.',
      },
      {
        id: 'jeonju-last-mile',
        label: 'Jeonju Station to Hanok Village',
        url: 'https://hanok.jeonju.go.kr/contents/en_map',
        publisher: 'Jeonju City / Jeonju Hanok Village',
        language: 'English',
        scope: 'English station-to-village directions. Check current bus routes and taxi fares.',
      },
    ],
    unverified: UNVERIFIED,
    bookingLinks: [KORAIL],
  },
  gyeongju: {
    checkedAt: '2026-10-08',
    summary: 'The KTX arrival and the historic centre are separate journey stages.',
    claims: [
      {
        text: 'The city uses Gyeongju Station for the KTX stop; the former name Singyeongju still appears in older guides.',
        sourceIds: ['gyeongju-arrival', 'gyeongju-station-name'],
      },
      {
        text: 'The national heritage guide describes onward buses from the KTX station to central heritage sites, with extra connections for some outlying sites.',
        sourceIds: ['gyeongju-heritage-access'],
      },
    ],
    cautions: [
      'Gyeongju Station connects to the centre by bus or taxi.',
      'Bulguksa and Seokguram are outside the central historic area and need another journey.',
    ],
    sources: [
      {
        id: 'gyeongju-arrival',
        label: 'Gyeongju official arrival guide',
        url: 'https://www.gyeongju.go.kr/open_content/english/page.do?mnu_uid=2577',
        publisher: 'Gyeongju City',
        language: 'English',
        scope: 'KTX arrival information. Check current train and airport-transfer timetables.',
      },
      {
        id: 'gyeongju-station-name',
        label: 'City notice: Singyeongju renamed Gyeongju',
        url: 'https://www.gyeongju.go.kr/webzine/GJstory/vol159/html/post/3195.html',
        publisher: 'Gyeongju City',
        language: 'Korean',
        scope: 'City notice about the station-name change.',
      },
      {
        id: 'gyeongju-heritage-access',
        label: 'Heritage-site access from the KTX station',
        url: 'https://www.kh.or.kr/visit/kor/road/10/view.do?key=2408220010',
        publisher: 'Korea Heritage Agency',
        language: 'Korean',
        scope: 'Heritage-site connections. Uses the former station name; check current bus numbers and opening hours.',
      },
    ],
    unverified: [...UNVERIFIED, 'Day-specific train duration, heritage-site hours and all onward bus schedules.'],
    bookingLinks: [KORAIL],
  },
  busan: {
    checkedAt: '2026-10-08',
    summary: 'KTX arrives at Busan Station. The beaches need a further subway, bus or taxi ride.',
    claims: [
      {
        text: 'Korea Tourism Organization lists KTX from Seoul Station to Busan Station and gives an approximate three-hour ride in its March 2025 guide.',
        sourceIds: ['busan-arrival'],
      },
      {
        text: 'The national subway guide links to the Busan operator’s route map and fare information for onward city travel.',
        sourceIds: ['busan-metro'],
      },
    ],
    cautions: [
      'Train duration varies by service; the times shown end at Busan Station.',
      'Haeundae and Gwangalli are separate coastal areas, with onward travel from the station.',
    ],
    sources: [
      {
        id: 'busan-arrival',
        label: 'Busan arrival options',
        url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=222586',
        publisher: 'Korea Tourism Organization',
        language: 'English',
        scope: 'Arrival guide updated March 2025. Check KORAIL for current departures and seats.',
      },
      {
        id: 'busan-metro',
        label: 'Busan subway operator and route-map links',
        url: 'https://english.visitkorea.or.kr/svc/contents/infoHtmlView.do?vcontsId=140660',
        publisher: 'Korea Tourism Organization',
        language: 'English',
        scope: 'Subway operator and route-map links. Check fares and the last train for the selected route.',
      },
    ],
    unverified: UNVERIFIED,
    bookingLinks: [KORAIL],
  },
  jeju: {
    checkedAt: '2026-10-08',
    summary: 'Local and express buses serve different stops; journeys across the island can need transfers.',
    claims: [
      {
        text: 'Korea Tourism Organization distinguishes east-coast local and express buses: the local route needs an airport transfer, while the airport express skips some stops.',
        sourceIds: ['jeju-east-coast'],
      },
      {
        text: 'Visit Jeju describes bus 181 between the airport and Seogwipo, and explicitly tells travellers to check the timetable because services are spaced apart.',
        sourceIds: ['jeju-airport-bus'],
      },
      {
        text: 'Incheon Airport describes rail, bus and taxi connections to Gimpo Airport. An airport change is a separate ground journey, not part of the flight time.',
        sourceIds: ['incheon-gimpo'],
      },
    ],
    cautions: [
      'Bus journeys include waiting and walks from the stop; check the last return bus.',
      'Flight times exclude airport access, check-in, baggage collection and local travel.',
      'Connections from Incheon via Gimpo include a separate airport transfer.',
    ],
    sources: [
      {
        id: 'jeju-east-coast',
        label: 'Jeju east-coast bus routes',
        url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=220897',
        publisher: 'Korea Tourism Organization',
        language: 'English',
        scope: 'Bus guide updated January 2025. Check current fares, intervals and payment methods.',
      },
      {
        id: 'jeju-airport-bus',
        label: 'Airport–Seogwipo bus orientation',
        url: 'https://m.visitjeju.net/en/themtour/view?contentsid=CNTS_300000000013541&menuId=DOM_000002100000000221',
        publisher: 'Jeju Tourism Organization',
        language: 'English',
        scope: 'Bus 181 route guide. Check the operator for today’s timetable.',
      },
      {
        id: 'incheon-gimpo',
        label: 'Incheon–Gimpo airport connection',
        url: 'https://airinfo.airport.kr/ap_en/1542/subview.do',
        publisher: 'Incheon International Airport Corporation',
        language: 'English',
        scope: 'Ground transport between the airports. Check the connection time required by your airline.',
      },
    ],
    unverified: [...UNVERIFIED, 'Flight schedules, baggage conditions and a safe connection allowance for your flights.'],
    bookingLinks: [],
  },
}

export function getTravelEvidence(slug: string): TravelEvidence | null {
  return Object.prototype.hasOwnProperty.call(TRAVEL_EVIDENCE, slug)
    ? TRAVEL_EVIDENCE[slug]
    : null
}
