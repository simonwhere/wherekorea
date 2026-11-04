export type OfficialTravelLink = {
  label: string
  url: string
  provider: string
  language: 'English' | 'Korean'
  scope: string
}

// These exact public pages were opened and their publisher/content inspected.
// This is a source directory, NOT a verification of every destination metric,
// current fare, operating date or route. Do not refresh metric provenance from it.
// Keep older editorial guides explicitly scoped as overviews, not live schedules.
export const OFFICIAL_DESTINATION_LINKS: Record<string, readonly OfficialTravelLink[]> = {
  seoul: [
    {
      label: 'Seoul public transport and transit cards',
      url: 'https://english.visitseoul.net/transportation/partners-en',
      provider: 'Seoul Tourism Organization',
      language: 'English',
      scope: 'Transport overview; check current fares and ticket conditions before travel.',
    },
    {
      label: 'Bukchon visitor restrictions and restricted zone',
      url: 'https://english.seoul.go.kr/notice-on-restrictions-for-tourist-visits-to-bukchon-special-management-area-effective-from-november-2024/',
      provider: 'Seoul Metropolitan Government',
      language: 'English',
      scope: 'Check the restricted area, visiting hours and resident-rest guidance.',
    },
  ],
  busan: [
    {
      label: 'Busan destination overview',
      url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=222586',
      provider: 'Korea Tourism Organization',
      language: 'English',
      scope: 'City overview and arrival routes. Check current departure times with the operator.',
    },
    {
      label: 'Busan subway links and rail guidance',
      url: 'https://english.visitkorea.or.kr/svc/contents/infoHtmlView.do?vcontsId=140660',
      provider: 'Korea Tourism Organization',
      language: 'English',
      scope: 'National subway guide with a Busan section and operator/map links.',
    },
  ],
  jeju: [
    {
      label: 'Visit Jeju official travel information',
      url: 'https://www.visitjeju.net/en/main/main.do',
      provider: 'Jeju Tourism Organization',
      language: 'English',
      scope: 'Island travel information and tourist-information contact details.',
    },
    {
      label: 'Understanding Jeju’s bus network',
      url: 'https://m.visitjeju.net/en/themtour/view?contentsid=CNTS_200000000012534&menuId=DOM_000001832000000000',
      provider: 'Jeju Tourism Organization',
      language: 'English',
      scope: '2022 overview of bus types and transfer hubs; recheck routes, hours and fares.',
    },
  ],
  gyeongju: [{
    label: 'Gyeongju official city and travel guide',
    url: 'https://www.gyeongju.go.kr/open_content/english/index.do',
    provider: 'Gyeongju City',
    language: 'English',
    scope: 'Tourism, tour-guide and transportation sections.',
  }],
  jeonju: [{
    label: 'Jeonju official tourism guide',
    url: 'https://tour.jeonju.go.kr/eng/index.jeonju',
    provider: 'Jeonju City',
    language: 'English',
    scope: 'City travel information, getting to Jeonju and local transport guidance.',
  }],
  gangneung: [{
    label: 'Gangneung official city and travel guide',
    url: 'https://www.gn.go.kr/eng/index.do',
    provider: 'Gangneung City',
    language: 'English',
    scope: 'Tourism and transportation sections, including tourist-taxi information.',
  }],
  sokcho: [{
    label: 'Sokcho and the Seorak area overview',
    url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=74222',
    provider: 'Korea Tourism Organization',
    language: 'English',
    scope: 'Sokcho, Seoraksan, Goseong and Yangyang overview. Check trail-opening notices separately.',
  }],
  tongyeong: [
    {
      label: 'Tongyeong city walking-route ideas',
      url: 'https://www.utour.go.kr/00001/00006.web?tord=name',
      provider: 'Tongyeong City',
      language: 'Korean',
      scope: 'Official city-tour routes; check ferry schedules separately before island trips.',
    },
    {
      label: 'Tongyeong U TOUR introduction',
      url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=251611',
      provider: 'Korea Tourism Organization',
      language: 'English',
      scope: 'English introduction to the local tourism service and city experiences.',
    },
  ],
  namhae: [{
    label: 'Namhae official visitor guide',
    url: 'https://www.namhae.go.kr/tour/eng.web?hs=2',
    provider: 'Namhae County',
    language: 'English',
    scope: 'County attractions and tour-guide information; check local connections separately.',
  }],
  jirisan: [{
    label: 'Jirisan National Park trail guide',
    url: 'https://byeonsan.knps.or.kr/front/portal/visit/visitCourseMain.do?menuNo=7020100&parkId=120100',
    provider: 'Korea National Park Service',
    language: 'Korean',
    scope: 'Jirisan park and trail information. Check current access notices before hiking.',
  }],
  yeosu: [{
    label: 'Yeosu official tourism guide',
    url: 'https://www.yeosu.go.kr/en/',
    provider: 'Yeosu City',
    language: 'English',
    scope: 'City tourism and visitor information; confirm island and ferry services separately.',
  }],
  andong: [{
    label: 'Andong official city and tourism guide',
    url: 'https://www.andong.go.kr/en/main.do',
    provider: 'Andong City',
    language: 'English',
    scope: 'Culture, tourism and directions; confirm onward transport to outlying sights.',
  }],
  suwon: [{
    label: 'Visit Suwon official tourism guide',
    url: 'https://www.suwon.go.kr/web/visitsuwon/index.do',
    provider: 'Suwon City',
    language: 'Korean',
    scope: 'City tourism, fortress experiences and visitor guidance.',
  }],
  chuncheon: [{
    label: 'Chuncheon official tourism guide',
    url: 'https://www.chuncheon.go.kr/tour/',
    provider: 'Chuncheon City',
    language: 'Korean',
    scope: 'City and lakeside travel information; check the final connection for each attraction.',
  }],
  'damyang-boseong': [
    {
      label: 'Damyang official tourism guide',
      url: 'https://www.damyang.go.kr/tour/index.damyang',
      provider: 'Damyang County',
      language: 'Korean',
      scope: 'Damyang bamboo groves, gardens and visitor information.',
    },
    {
      label: 'Boseong official tourism guide',
      url: 'https://www.boseong.go.kr/tour',
      provider: 'Boseong County',
      language: 'Korean',
      scope: 'Boseong travel and transport sections; check event dates and operating details.',
    },
  ],
}

export function getOfficialLinks(slug: string): readonly OfficialTravelLink[] {
  return Object.prototype.hasOwnProperty.call(OFFICIAL_DESTINATION_LINKS, slug)
    ? OFFICIAL_DESTINATION_LINKS[slug]
    : []
}
