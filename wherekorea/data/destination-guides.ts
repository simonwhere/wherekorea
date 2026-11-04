export type DestinationGuide = {
  slug: string
  /** Source review date, not a live timetable, availability or photograph date. */
  reviewedAt: string
  photos: {
    src: string
    alt: string
    credit: string
    sourceUrl: string
    licenseUrl: string
    title: string
    caption: string
    objectPosition?: string
  }[]
  arrival: { title: string; text: string; sourceIds: string[] }[]
  areas: { name: string; text: string; sourceIds: string[] }[]
  connections: { from: string; to: string; description: string; sourceIds: string[] }[]
  faqs: { question: string; answer: string; sourceIds: string[] }[]
  sources: {
    id: string
    label: string
    url: string
    publisher: string
    language: 'English' | 'Korean'
    scope: string
  }[]
}

// Route numbers and places are editorial snapshots. Departure times, return
// services, fares and seats must be checked for the actual travel date.
export const DESTINATION_GUIDES: Record<string, DestinationGuide> = {
  andong: {
    slug: 'andong',
    reviewedAt: '2026-10-18',
    photos: [
      {
        src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Hahoe_Folk_Village_03.jpg/960px-Hahoe_Folk_Village_03.jpg',
        alt: 'Thatched and tiled houses surrounded by fields in Hahoe Folk Village, Andong',
        credit: 'Bernard Gagnon / Wikimedia Commons · CC0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Hahoe_Folk_Village_03.jpg',
        licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
        title: 'Hahoe Folk Village',
        caption: 'Traditional homes and fields at Hahoe, outside central Andong.',
      },
      {
        src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/Woryeonggyo%2C_Andong.jpg/960px-Woryeonggyo%2C_Andong.jpg',
        alt: 'Wooden walkway and pavilion of Woryeonggyo Bridge over the water in Andong',
        credit: 'Choi2451 / Wikimedia Commons · CC BY-SA 4.0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Woryeonggyo,_Andong.jpg',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        title: 'Woryeonggyo Bridge',
        caption: 'The wooden footbridge by Andong Dam, photographed in May 2018.',
      },
      {
        src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/Hahoe-folk-village-mask-dance.jpg/960px-Hahoe-folk-village-mask-dance.jpg',
        alt: 'Two masked performers in traditional clothing at a Hahoe mask-dance performance',
        credit: 'Ian Sewell / Wikimedia Commons · CC BY-SA 2.5',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Hahoe-folk-village-mask-dance.jpg',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.5/',
        title: 'Hahoe mask dance',
        caption: 'A performance photographed in 2008, not a current programme listing.',
      },
    ],
    arrival: [
      {
        title: 'Andong Station and the bus terminal',
        text: 'The current rail station is next to Andong Bus Terminal, separate from the old downtown station. The bus information system labels this stop Andong Station (Andong Terminal).',
        sourceIds: ['andong-transit', 'andong-station'],
      },
      {
        title: 'Continue to Hahoe Village',
        text: 'At the station bus stop 안동역(안동터미널), take bus 210 toward 하회보건진료소. Get off at Hahoe Village (하회마을).',
        sourceIds: ['andong-transit'],
      },
    ],
    areas: [
      {
        name: 'Downtown and the old station',
        text: 'Downtown bus stops are separate from the current KTX station. Kyobo Life is a boarding point for Hahoe buses; the old station is a boarding point for Woryeonggyo buses.',
        sourceIds: ['andong-directions'],
      },
      {
        name: 'Hahoe Village',
        text: 'Hahoe is a residential village outside the city centre. Its traditional houses and lanes form one walking area; Woryeonggyo and Dosan Seowon are separate journeys.',
        sourceIds: ['andong-hahoe', 'andong-directions'],
      },
    ],
    connections: [
      {
        from: 'Andong Station / terminal', to: 'Hahoe Village',
        description: 'Bus 210 toward Hahoe Health Post (하회보건진료소) stops at Hahoe Village (하회마을).',
        sourceIds: ['andong-transit'],
      },
      {
        from: 'Hahoe Village', to: 'Andong Station / terminal',
        description: 'Board bus 210 at 하회마을 (stop 540854) toward Kyobo Life (교보생명). Get off at 안동역(안동터미널) for the train.',
        sourceIds: ['andong-transit', 'andong-return-stop'],
      },
      {
        from: 'Downtown: old Andong Station', to: 'Woryeonggyo Bridge',
        description: 'Bus 112 (112번), on a branch that lists Woryeonggyo (월영교). Not every 112 service follows the same route.',
        sourceIds: ['andong-transit', 'andong-directions'],
      },
    ],
    faqs: [
      {
        question: 'Can I visit Hahoe without a car?',
        answer: 'Yes. Bus 210 connects Andong Station and Hahoe Village in both directions. Before leaving the village, look up stop 540854 for a 210 toward Kyobo Life and check the time of your train.',
        sourceIds: ['andong-transit', 'andong-return-stop'],
      },
      {
        question: 'Are Hahoe and Woryeonggyo in the same area?',
        answer: 'No. The city’s public-transport directions connect them through downtown: 210 between Hahoe and town, then a Woryeonggyo-bound 112. They are not two stops on one village walk.',
        sourceIds: ['andong-directions', 'andong-transit'],
      },
      {
        question: 'Where are the Hahoe mask-dance performances?',
        answer: 'The recurring village performances are at Hahoe Village’s mask-dance theatre (하회마을 탈춤공연장). The organiser also lists a separate programme at Gaemoknaru by Andong Dam. Check the venue in its calendar; the archive photo does not confirm a performance on your date.',
        sourceIds: ['andong-mask'],
      },
    ],
    sources: [
      {
        id: 'andong-transit', label: 'Andong city bus routes', url: 'https://bus.andong.go.kr/route',
        publisher: 'Andong City Bus Information System', language: 'Korean',
        scope: 'Bus 210 stops between Andong Station and Hahoe in both directions, checked 4 November 2026. Bus 112 branches checked 18 October 2026.',
      },
      {
        id: 'andong-return-stop', label: 'Hahoe return bus arrivals · search 540854', url: 'https://bus.andong.go.kr/route?tab=stop',
        publisher: 'Andong City Bus Information System', language: 'Korean',
        scope: 'The Hahoe Village stop for the 210 toward Kyobo Life has service ID 540854. Stop number and direction checked 4 November 2026.',
      },
      {
        id: 'andong-directions', label: 'Getting between Andong sights', url: 'https://www.tourandong.com/public/sub5/sub1_2.cshtml',
        publisher: 'Andong Tourism', language: 'Korean',
        scope: 'Downtown boarding points and transfers between Hahoe and Woryeonggyo. Route numbers used here were cross-checked against the current city bus list; older route tables on this page were not reused.',
      },
      {
        id: 'andong-station', label: 'Andong Station', url: 'https://www.tourandong.com/public/sub1/sub3_3.cshtml?idx=0&keyword=&seq=1149',
        publisher: 'Andong Tourism', language: 'Korean',
        scope: 'Current station address on Gyeongdong-ro, outside the old downtown station area. Not a rail timetable.',
      },
      {
        id: 'andong-hahoe', label: 'Hahoe Folk Village', url: 'https://www.tourandong.com/public/sub1/sub3_3.cshtml?idx=2&keyword=&seq=196',
        publisher: 'Andong Tourism', language: 'Korean',
        scope: 'Village identity, residential setting and location. Admission fees and opening hours are not reproduced.',
      },
      {
        id: 'andong-mask', label: 'Hahoe mask-dance calendar', url: 'https://www.hahoemask.co.kr/',
        publisher: 'Hahoe Byeolsingut Talnori Preservation Society', language: 'Korean',
        scope: 'Organiser’s published village and Andong Dam venues and performance calendar. A calendar link is not a confirmed booking or a guarantee that a performance runs on a particular date.',
      },
    ],
  },
  gyeongju: {
    slug: 'gyeongju',
    reviewedAt: '2026-10-18',
    photos: [
      {
        src: 'https://images.unsplash.com/photo-1748274035731-32c83e10661e?auto=format&fit=crop&w=800&q=80',
        alt: 'Green burial mounds and trees in a Gyeongju park',
        credit: 'Darwin Vegher / Unsplash',
        sourceUrl: 'https://unsplash.com/photos/mounds-of-earth-in-a-green-park-sEwEffWZnBQ',
        licenseUrl: 'https://unsplash.com/license',
        title: 'Gyeongju’s burial mounds',
        caption: 'Grass-covered tomb mounds in Gyeongju. The temple and lake districts are elsewhere in the city.',
      },
      {
        src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Woljeonggyo_Bridge_and_stone_steps_on_the_bank_at_golden_hour_in_Gyeongju_South_Korea.jpg/960px-Woljeonggyo_Bridge_and_stone_steps_on_the_bank_at_golden_hour_in_Gyeongju_South_Korea.jpg',
        alt: 'Woljeonggyo’s tiled covered bridge and stone riverbank steps in Gyeongju at golden hour',
        credit: 'Basile Morin / Wikimedia Commons · CC BY-SA 4.0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Woljeonggyo_Bridge_and_stone_steps_on_the_bank_at_golden_hour_in_Gyeongju_South_Korea.jpg',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        title: 'Woljeonggyo Bridge',
        caption: 'The covered bridge over Namcheon, photographed in June 2024.',
      },
      {
        src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ca/Bulguksa_01.jpg/960px-Bulguksa_01.jpg',
        alt: 'Stone stairways and tiled temple buildings at Bulguksa in Gyeongju',
        credit: 'Bernard Gagnon / Wikimedia Commons · CC0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bulguksa_01.jpg',
        licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
        title: 'Bulguksa Temple',
        caption: 'Bulguksa’s stone stairways, photographed in October 2022. The temple is outside the central tomb district.',
      },
    ],
    arrival: [
      {
        title: 'Gyeongju Station (KTX)',
        text: 'The KTX station is outside the central historic area. Bus 50 connects Gyeongju Station (경주역 KTX) with the express/intercity bus terminal and Seorabeol Intersection·Hwangnidan-gil.',
        sourceIds: ['gyeongju-buses'],
      },
      {
        title: 'Express and intercity bus terminal',
        text: 'The central bus terminal is a different arrival point from the KTX station. City bus 11 serves the terminal, central sights, Bulguksa and the Bomun area on a loop; check the direction before boarding.',
        sourceIds: ['gyeongju-buses'],
      },
    ],
    areas: [
      {
        name: 'Hwangnidan-gil and the central historic area',
        text: 'The tomb district, Cheomseongdae and Gyerim are connected by streets and walking paths. This is a different area from Bulguksa and Bomun Lake.',
        sourceIds: ['gyeongju-walk', 'gyeongju-buses'],
      },
      {
        name: 'Bomun Lake',
        text: 'Bomun is a lakeside tourism district with waterside paths. It is not the central tomb district; city buses connect the lake area with the centre.',
        sourceIds: ['gyeongju-bomun', 'gyeongju-buses'],
      },
    ],
    connections: [
      {
        from: 'Gyeongju Station (KTX)', to: 'Central terminal / Hwangnidan-gil',
        description: 'Bus 50. Look for 고속버스·시외버스터미널 or 서라벌사거리·황리단길 in the stop list. The rail journey does not include this local transfer.',
        sourceIds: ['gyeongju-buses'],
      },
      {
        from: 'Central bus terminal', to: 'Bulguksa Temple',
        description: 'Bus 11 serves 불국사 (Bulguksa) as part of a longer loop. Confirm the stop sequence and direction in the city’s bus map; the return leg need not follow the same streets.',
        sourceIds: ['gyeongju-buses'],
      },
      {
        from: 'Daereungwon tomb district', to: 'Cheomseongdae / Gyerim',
        description: 'Connected on foot through the central historic area. Bulguksa and Seokguram are separate trips, not extensions of this short central walk.',
        sourceIds: ['gyeongju-walk', 'gyeongju-seokguram'],
      },
    ],
    faqs: [
      {
        question: 'Does the KTX arrive beside the tombs?',
        answer: 'No. Gyeongju Station (KTX) is a separate arrival point. Bus 50 continues to the central terminal and Hwangnidan-gil area; allow for this transfer in addition to the rail journey.',
        sourceIds: ['gyeongju-buses'],
      },
      {
        question: 'Can I walk to Bulguksa from the central sights?',
        answer: 'Bulguksa is outside the central walking area. Bus 11 links the central terminal with the temple. The tombs, Cheomseongdae and Gyerim form the central walking cluster.',
        sourceIds: ['gyeongju-buses', 'gyeongju-walk'],
      },
      {
        question: 'Are Bulguksa and Seokguram one entrance?',
        answer: 'No. Seokguram is a separate mountain site. Korea Tourism Organization describes a 3 km hiking trail or a 9 km road connection from Bulguksa; visiting the temple does not put you at the grotto entrance.',
        sourceIds: ['gyeongju-seokguram'],
      },
    ],
    sources: [
      {
        id: 'gyeongju-buses', label: 'Gyeongju city bus map', url: 'https://livebus.gyeongju.go.kr/',
        publisher: 'Gyeongju City Traffic Information Center', language: 'Korean',
        scope: 'Bus 50 and 11 stop lists inspected in the official map on 18 October 2026. Search the route number to see branches and direction. No live departure, journey duration or fare is reproduced.',
      },
      {
        id: 'gyeongju-walk', label: 'Gyeongju’s central historic sights', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?menuSn=219&vcontsId=221692',
        publisher: 'Korea Tourism Organization', language: 'English',
        scope: 'Central walking connections around Daereungwon, Cheomseongdae and Gyerim. The article’s itinerary, prices and opening times are not reused.',
      },
      {
        id: 'gyeongju-bomun', label: 'Bomun Lake walking area', url: 'https://english.visitkorea.or.kr/svc/whereToGo/hdrdslt/hdrdsltView.do?crsSn=435131',
        publisher: 'Korea Tourism Organization', language: 'English',
        scope: 'Bomun Lake’s location in the Bomun tourism district and waterside walking paths. Not room availability or a current events listing.',
      },
      {
        id: 'gyeongju-seokguram', label: 'Seokguram Grotto', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?menuSn=351&vcontsId=94436',
        publisher: 'Korea Tourism Organization', language: 'English',
        scope: 'Seokguram’s separate location and the stated 3 km trail / 9 km road connection from Bulguksa. Trail conditions and transport on a specific date are not verified.',
      },
    ],
  },
  jeonju: {
    slug: 'jeonju',
    reviewedAt: '2026-10-18',
    photos: [
      {
        src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Jeonju_Hanok_Maeul_01.jpg/960px-Jeonju_Hanok_Maeul_01.jpg',
        alt: 'Closely spaced tiled hanok roofs with modern Jeonju buildings beyond them',
        credit: 'Bernard Gagnon / Wikimedia Commons · CC0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Jeonju_Hanok_Maeul_01.jpg',
        licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
        title: 'Jeonju Hanok Village',
        caption: 'Tiled roofs within the city, rather than an isolated rural village.',
      },
      {
        src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Gyeonggijeon_Shrine_01.jpg/960px-Gyeonggijeon_Shrine_01.jpg',
        alt: 'Tiled gate and courtyard at Gyeonggijeon Shrine in Jeonju',
        credit: 'Bernard Gagnon / Wikimedia Commons · CC0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Gyeonggijeon_Shrine_01.jpg',
        licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
        title: 'Gyeonggijeon Shrine',
        caption: 'The shrine grounds beside the hanok streets, photographed in September 2022.',
      },
      {
        src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Bibimbap_in_Jeonju.jpg/960px-Bibimbap_in_Jeonju.jpg',
        alt: 'Jeonju bibimbap in a brass bowl, with vegetables and an egg yolk',
        credit: 'Douglas Paul Perkins / Wikimedia Commons · CC BY 3.0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bibimbap_in_Jeonju.jpg',
        licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
        title: 'Bibimbap in Jeonju',
        caption: 'A meal photographed in Jeonju in December 2013, not a current restaurant or menu listing.',
      },
    ],
    arrival: [
      {
        title: 'Jeonju Station',
        text: 'Trains arrive at Jeonju Station on Dongbu-daero, not inside Hanok Village. Continue by local bus or taxi to the Hanok Village / Jeondong Cathedral area.',
        sourceIds: ['jeonju-arrival'],
      },
      {
        title: 'Bus arrival points are different',
        text: 'The express and intercity terminals are on Garinae-ro. The Incheon Airport limousine terminal is on Yuyeon-ro. Neither is the rail station or the Hanok Village entrance.',
        sourceIds: ['jeonju-arrival'],
      },
    ],
    areas: [
      {
        name: 'Hanok Village and Gyeonggijeon',
        text: 'Hanok streets, Gyeonggijeon and the village’s walking-tour routes share one central area. Gyeonggijeon is a separate heritage site within that area, not the name of the whole village.',
        sourceIds: ['jeonju-heritage', 'jeonju-walk'],
      },
      {
        name: 'Pungnammun and Nambu Market',
        text: 'Nambu Market sits outside Pungnammun Gate, a short walk from Hanok Village. The market is a separate food-and-shopping area, not another hanok village.',
        sourceIds: ['jeonju-market'],
      },
    ],
    connections: [
      {
        from: 'Jeonju Station', to: 'Hanok Village',
        description: 'A local bus or taxi transfer is needed. Use Jeondong Cathedral / Hanok Village as the destination, rather than the airport or intercity terminal.',
        sourceIds: ['jeonju-arrival'],
      },
      {
        from: 'Hanok Village', to: 'Pungnammun / Nambu Market',
        description: 'Continue on foot towards Pungnammun Gate; Nambu Market is just outside the gate. No intercity journey is involved.',
        sourceIds: ['jeonju-market'],
      },
      {
        from: 'Hanok Village Parking Lot 4', to: 'Jaman / Taejo-ro',
        description: 'The published free shuttle runs Parking Lot 4 → Jaman Mural Village → Taejo-ro → Parking Lot 4. It is a parking-area shuttle, not a train-station transfer.',
        sourceIds: ['jeonju-shuttle'],
      },
    ],
    faqs: [
      {
        question: 'Does the free Hanok Village shuttle leave from the station?',
        answer: 'No. The city’s published shuttle starts at Parking Lot 4 and serves Jaman Mural Village and Taejo-ro. Jeonju Station needs a separate local bus or taxi transfer.',
        sourceIds: ['jeonju-shuttle', 'jeonju-arrival'],
      },
      {
        question: 'Can I walk from Hanok Village to Nambu Market?',
        answer: 'Yes. Nambu Market is just outside Pungnammun Gate, a short walk from Hanok Village. It is not at Jeonju Station or the express bus terminal.',
        sourceIds: ['jeonju-market', 'jeonju-arrival'],
      },
      {
        question: 'Where does the airport limousine arrive?',
        answer: 'The city lists the Daehan Limousine terminal at 30 Yuyeon-ro, separate from Jeonju Station and the express/intercity terminals. Use the arrival terminal printed on your ticket; “Jeonju” alone does not identify the rail station. Continue locally to Hanok Village.',
        sourceIds: ['jeonju-arrival'],
      },
    ],
    sources: [
      {
        id: 'jeonju-arrival', label: 'Getting to Jeonju', url: 'https://tour.jeonju.go.kr/eng/index.jeonju?menuCd=DOM_000000205008001000',
        publisher: 'Jeonju City Tourism', language: 'English',
        scope: 'Rail, express/intercity and airport-terminal locations. Listed fares and service frequencies are not reproduced; no local-bus route number or date-specific ticket availability is claimed.',
      },
      {
        id: 'jeonju-shuttle', label: 'Hanok Village parking shuttle', url: 'https://tour.jeonju.go.kr/eng/index.jeonju?menuCd=DOM_000000205012000000',
        publisher: 'Jeonju City Tourism', language: 'English',
        scope: 'Published free-shuttle route: Parking Lot 4, Jaman and Taejo-ro. Not a station shuttle; operation on a particular date is not verified.',
      },
      {
        id: 'jeonju-heritage', label: 'Hanok Village heritage sites', url: 'https://hanok.jeonju.go.kr/contents/place',
        publisher: 'Jeonju City Hanok Village', language: 'Korean',
        scope: 'Gyeonggijeon’s identity and location in the Hanok Village area. Current admission prices and opening times are not reproduced.',
      },
      {
        id: 'jeonju-walk', label: 'Hanok Village walking routes', url: 'https://hanok.jeonju.go.kr/contents/tour',
        publisher: 'Jeonju City Hanok Village', language: 'Korean',
        scope: 'Local walking routes and named places around the village. No guided-tour booking or availability is claimed.',
      },
      {
        id: 'jeonju-market', label: 'Nambu Market and Pungnammun', url: 'https://tour.jeonju.go.kr/eng/index.jeonju?menuCd=DOM_000000209001002000',
        publisher: 'Jeonju City Tourism', language: 'English',
        scope: 'Nambu Market’s location outside Pungnammun and walking proximity to Hanok Village. This is not a current night-market schedule.',
      },
    ],
  },
}

export function getDestinationGuide(slug: string): DestinationGuide | undefined {
  return Object.hasOwn(DESTINATION_GUIDES, slug) ? DESTINATION_GUIDES[slug] : undefined
}
