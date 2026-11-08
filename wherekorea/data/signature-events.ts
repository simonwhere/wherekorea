// Recurring ideas have typical months only. A published edition has its own dates
// and source. Events inform discovery and are never a destination ranking score.

export type Ticketing = 'walk-in' | 'english-booking' | 'id-required'

export interface FestivalMapPoint {
  label: string
  name: string
  nameKo: string
  lat: number
  lng: number
}

interface OfficialFestival {
  anchor: string
  korean: string
  aliases?: string[]
  source: { label: string; url: string; checked: string }
  schedule: { kind: 'dated'; start: string; end: string } | { kind: 'paused' }
  visitorDetails?: { label: string; text: string }[]
  visitorInfo?: { label: string; url: string }
  maps?: FestivalMapPoint[]
}

export interface SignatureEvent {
  city: string        // destination slug
  name: string
  months: number[]    // typical or published months (1–12); empty when on hold
  when?: string        // human timing, e.g. 'early Oct'
  note: string        // short description; not a current schedule or admission claim
  ticketing?: Ticketing
  official?: OfficialFestival
}

export const SIGNATURE_EVENTS: SignatureEvent[] = [
  // Seoul
  {
    city: 'seoul', name: 'Seoul International Fireworks Festival', months: [9],
    note: 'The 2026 fireworks lit up the Han River between Yeouido and Ichon.',
    official: {
      anchor: 'seoul-fireworks-festival', korean: '서울세계불꽃축제', aliases: ['여의도 불꽃축제', 'Yeouido fireworks'],
      schedule: { kind: 'dated', start: '20260905', end: '20260905' },
      source: { label: 'Seoul Hangang Parks', url: 'https://hangang.seoul.go.kr/www/eventMng/detail.do?evntSn=454&mid=538&srchType=list', checked: '20261109' },
      visitorDetails: [
        { label: 'The 2026 show', text: 'Fireworks ran from 8:00 to 9:10 pm. Viewing at Yeouido and Ichon Hangang Parks was free. Nodeul Island required a paid ticket.' },
      ],
    },
  },
  { city: 'seoul', name: 'Lotus Lantern Festival (Yeondeunghoe)', months: [5], when: 'May',
    note: 'Lantern parade through Jongno', ticketing: 'walk-in' },
  {
    city: 'seoul', name: 'Seoul Lantern Festival', months: [12, 1],
    note: 'Paper lanterns and light sculptures line Cheonggyecheon Stream between Cheonggye Plaza and Samilgyo Bridge.',
    official: {
      anchor: 'seoul-lantern-festival', korean: '서울빛초롱축제',
      aliases: ['서울 빛초롱', '청계천', '청계광장', '삼일교', 'Cheonggyecheon', 'Cheonggye Plaza', 'Samilgyo Bridge'],
      schedule: { kind: 'dated', start: '20261211', end: '20270131' },
      source: { label: 'Festival organizer (Korean)', url: 'https://www.sto.or.kr/tourism03/view?stBusinessSeq=14', checked: '20261109' },
      visitorInfo: { label: 'Visit Seoul (English)', url: 'https://english.visitseoul.net/eventsx/2026SeoulLanternFestival/ENPi0rhml' },
      visitorDetails: [
        { label: 'Hours & admission', text: 'The exhibition runs from 6:00 to 11:00 pm every evening, Korea time. Admission is free. For individual program times call the festival at +82 2 3788 8168.' },
        { label: 'Start', text: 'Take subway Line 5 to Gwanghwamun Station (광화문역). Exit 5 is about 150 m from Cheonggye Plaza (청계광장).' },
        { label: 'Walk', text: 'From the plaza, follow the lanterns east along the stream to Samilgyo Bridge (삼일교), the end of the exhibition.' },
        { label: 'Food nearby', text: 'Near the plaza, Mugyo-dong has mandu (filled dumplings, 만두) and dakgalbi (spicy stir-fried chicken, 닭갈비). For a late meal, check the kitchen’s last order before starting the walk.' },
      ],
      maps: [
        // Centres of the named plaza and bridge in OpenStreetMap, checked 2026-11-09.
        // https://www.openstreetmap.org/way/258898493 and https://www.openstreetmap.org/way/1101219125
        { label: 'Start', name: 'Cheonggye Plaza', nameKo: '청계광장', lat: 37.56920, lng: 126.97812 },
        { label: 'Finish', name: 'Samilgyo Bridge', nameKo: '삼일교', lat: 37.56814, lng: 126.98765 },
      ],
    },
  },
  { city: 'seoul', name: 'Hangang Summer Festival', months: [7, 8], when: 'late Jul–Aug',
    note: 'Summer events along the Han River', ticketing: 'walk-in' },

  // Busan
  { city: 'busan', name: 'Gwangalli M Drone Light Show', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], when: 'every Sat night',
    note: 'Drone light show over Gwangalli Beach', ticketing: 'walk-in' },
  { city: 'busan', name: 'Busan Sea Festival', months: [8], when: 'early Aug',
    note: 'Concerts and events at Busan beaches', ticketing: 'walk-in' },
  { city: 'busan', name: 'Busan International Film Festival (BIFF)', months: [10], when: 'early Oct',
    note: 'International film screenings in Busan', ticketing: 'english-booking' },
  {
    city: 'busan', name: 'Busan Fireworks Festival', months: [11],
    note: 'The 2026 display took place over Gwangalli Beach, Igidae and Dongbaekseom Island.',
    official: {
      anchor: 'busan-fireworks-festival', korean: '부산불꽃축제', aliases: ['광안리 불꽃축제', 'Gwangalli fireworks'],
      schedule: { kind: 'dated', start: '20261107', end: '20261107' },
      source: { label: 'Busan Metropolitan City', url: 'https://www.busan.go.kr/eng/ai-translated-press-releases/1761832', checked: '20261109' },
      visitorDetails: [
        { label: 'The 2026 show', text: 'Fireworks ran from 7:00 to 8:00 pm. Reserved beach seats required tickets. Public viewing areas were separate.' },
      ],
    },
  },
  { city: 'busan', name: 'Haeundae Sand Festival', months: [5], when: 'May',
    note: 'Sand sculptures at Haeundae Beach', ticketing: 'walk-in' },

  // Jeju
  { city: 'jeju', name: 'Jeju Fire Festival', months: [3], when: 'early Mar',
    note: 'Seasonal festival on Jeju; the program varies by year', ticketing: 'walk-in' },
  { city: 'jeju', name: 'Canola flower season', months: [4], when: 'Apr',
    note: 'Canola flowers in eastern Jeju', ticketing: 'walk-in' },
  { city: 'jeju', name: 'Seongsan Sunrise Festival', months: [12, 1], when: 'Dec 31–Jan 1',
    note: 'New Year sunrise events at Seongsan Ilchulbong', ticketing: 'walk-in' },

  // Gyeongju
  { city: 'gyeongju', name: 'Cherry blossom season & marathon', months: [4], when: 'early Apr',
    note: 'Cherry blossoms around Bomun Lake and a spring marathon', ticketing: 'walk-in' },

  // Jeonju
  { city: 'jeonju', name: 'Jeonju International Film Festival', months: [4, 5], when: 'late Apr–early May',
    note: 'Independent film screenings in Jeonju', ticketing: 'english-booking' },
  { city: 'jeonju', name: 'Jeonju Bibimbap Festival', months: [10], when: 'Oct',
    note: 'Food events focused on bibimbap', ticketing: 'walk-in' },

  // Suwon
  { city: 'suwon', name: 'Suwon Hwaseong Cultural Festival', months: [10], when: 'early Oct',
    note: 'Parades and performances around Hwaseong Fortress', ticketing: 'walk-in' },

  // Chuncheon
  { city: 'chuncheon', name: 'Chuncheon Mime Festival', months: [5], when: 'late May',
    note: 'Mime and street performances in Chuncheon', ticketing: 'walk-in' },

  // Gangneung
  { city: 'gangneung', name: 'Gangneung Danoje (UNESCO)', months: [6], when: 'Jun',
    note: 'Traditional rituals, performances and markets', ticketing: 'walk-in' },
  { city: 'gangneung', name: 'Gangneung Coffee Festival', months: [10], when: 'Oct',
    note: 'Coffee tastings and events in Gangneung', ticketing: 'walk-in' },

  // Tongyeong
  { city: 'tongyeong', name: 'Tongyeong International Music Festival', months: [3, 4], when: 'late Mar–early Apr',
    note: 'Classical music concerts in Tongyeong', ticketing: 'english-booking' },
  { city: 'tongyeong', name: 'Hansan Battle Festival', months: [8], when: 'Aug',
    note: 'Naval reenactments of the 1592 victory', ticketing: 'walk-in' },

  // Namhae
  { city: 'namhae', name: 'German Village Oktoberfest', months: [10], when: 'early Oct',
    note: 'Beer festival in Namhae German Village', ticketing: 'walk-in' },

  // Yeosu
  { city: 'yeosu', name: 'Yeosu Turtle Ship Festival', months: [5], when: 'May',
    note: 'Harbor events commemorating Admiral Yi Sun-sin', ticketing: 'walk-in' },

  // Andong
  { city: 'andong', name: 'Andong Mask Dance Festival', months: [9, 10], when: 'late Sep–early Oct',
    note: 'Mask-dance performances in Andong', ticketing: 'walk-in' },

  // Jirisan
  { city: 'jirisan', name: 'Gurye Sansuyu Blossom Festival', months: [3], when: 'mid-Mar',
    note: 'Yellow sansuyu blossoms at the foot of the mountain', ticketing: 'walk-in' },
  { city: 'jirisan', name: 'Hadong Wild Tea Festival', months: [5], when: 'May',
    note: 'Wild green tea harvest in the Hwagae valley', ticketing: 'walk-in' },

  // Damyang & Boseong
  { city: 'damyang-boseong', name: 'Damyang Bamboo Festival', months: [5], when: 'May',
    note: 'Bamboo-themed events in Damyang', ticketing: 'walk-in' },
  {
    city: 'damyang-boseong', name: 'Boseong Green Tea Festival', months: [5],
    note: 'The spring tea festival took place at Korea Tea Culture Park (한국차문화공원) and the Boseong tea fields.',
    official: {
      anchor: 'boseong-green-tea-festival', korean: '보성다향대축제',
      schedule: { kind: 'dated', start: '20260501', end: '20260505' },
      source: { label: 'VisitKorea', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=95749', checked: '20261109' },
      visitorDetails: [
        { label: 'The 2026 festival', text: 'The program included tea picking, making tea and cooking with green tea. The park is in Boseong, at 775 Nokcha-ro (보성읍 녹차로 775).' },
      ],
    },
  },
  {
    city: 'damyang-boseong', name: 'Boseong Tea Field Light Festival', months: [],
    note: 'Boseong County has paused the winter light festival while it develops the tea garden. There is no date for its return.',
    official: {
      anchor: 'boseong-tea-field-light-festival', korean: '보성차밭빛축제', aliases: ['보성차밭 빛축제'],
      schedule: { kind: 'paused' },
      source: { label: 'Boseong County', url: 'https://www.boseong.go.kr/tour/festivity/light_festival', checked: '20261109' },
    },
  },
]

export function signatureEventSearchNames(city: string): string[] {
  return SIGNATURE_EVENTS.filter(event => event.city === city).flatMap(event =>
    event.official ? [event.name, event.official.korean, ...(event.official.aliases ?? [])] : [event.name]
  )
}
