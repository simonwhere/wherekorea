import type { WalkGuide } from './types'

const andongBakery = {
  label: 'VisitKorea · Mammoth Bakery hours and holiday closures',
  url: 'https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=d7449985-8bd2-4749-bac8-5acabb870bb7',
}
const damyangNoodles = {
  label: 'VisitKorea · Jinune Jip Guksu hours and menu',
  url: 'https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=8d4a25e8-c944-4454-8a45-e70d865ba424',
}
const boseongRestaurant = {
  label: 'Daehan Dawon · takeaway menu at the tea fields',
  url: 'https://dhdawon.com/page/sub_01_03.asp?pageNum=1&subNum=3',
}

export const heritageWalks: WalkGuide[] = [
  {
    slug: 'andong-market', city: 'andong', name: 'Andong Old Market', nameKo: '안동구시장',
    cardRoute: 'Cream-cheese buns, Jjimdak Alley and Ungbu Park',
    intro: 'Pick up a cream-cheese bun in the old town, walk under the market arcade to Jjimdak Alley, then head to the tiled pavilions in Ungbu Park.',
    stops: [
      {
        name: 'Mammoth Bakery', nameKo: '맘모스베이커리 본점', lat: 36.56465, lng: 128.73099,
        walk: 'At Andong KTX Station, take bus 110 towards 국립경국대. Get off at Kyobo Life (교보생명) and walk into the shopping lanes to 34 Munhwagwangjang-gil.',
        what: 'Look for the cream-cheese bun (크림치즈빵) or a slice of yuja citrus pound cake (유자파운드). There are café seats inside.',
        photo: {
          src: '/walks/andong-market/culture-street.webp', alt: 'Shopfronts and a paved pedestrian lane on Andong Culture Street near Mammoth Bakery.',
          caption: 'Culture Street, just outside the bakery.',
          credit: 'Jjw · resized and converted to WebP', license: 'CC BY-SA 4.0',
          source: 'https://commons.wikimedia.org/wiki/File:Andong_Culture_Street_20220130_01.jpg',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        },
      },
      {
        name: 'Old Market and Jjimdak Alley', nameKo: '안동구시장 · 안동찜닭골목',
        lat: 36.56521, lng: 128.72852,
        walk: 'Head west from the bakery to the covered market. Follow the 안동찜닭골목 signs inside the arcade to the row of chicken restaurants.',
        what: 'Several adjoining kitchens cook jjimdak in wide pans. Check the platter sizes on the menus outside each shop.',
        photo: {
          src: '/walks/andong-market/covered-market.webp', alt: 'Restaurant signs, market counters and tables along the covered Jjimdak Alley in downtown Andong.',
          credit: 'Jjw · resized and converted to WebP', license: 'CC BY-SA 4.0',
          source: 'https://commons.wikimedia.org/wiki/File:Andong_Market_20220130_01.jpg',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        },
      },
      {
        name: 'Ungbu Park', nameKo: '웅부공원', lat: 36.56621, lng: 128.73307,
        walk: 'Leave the market on the downtown side and walk northeast through the shopping lanes to 웅부공원. The pavilion gate opens onto the old government grounds.',
        what: 'Look for the painted hall, Yeonggaheon (영가헌), and the bell pavilion. For the KTX, take bus 111 towards 안동터미널 from Ungbu Park. The former downtown station is a separate place.',
      },
    ],
    food: {
      name: 'Jjimdak in the old market', nameKo: '안동찜닭', stop: 2,
      detail: 'Chicken, glass noodles and potatoes come braised in a soy-based sauce on a shared platter. Ask for bap (밥) for a bowl of rice to go with the sauce.',
    },
    breakfast: {
      venue: 'Mammoth Bakery', venueKo: '맘모스베이커리 본점', stop: 1,
      hours: 'Bakery open 09:00–18:00.',
      address: '34 Munhwagwangjang-gil, Andong',
      detail: 'Ask the downtown shop when the first cream-cheese buns will be ready to take away. It closes on Seollal and Chuseok day and has shorter hours during the surrounding holidays.',
      ordering: {
        summary: 'First cream-cheese buns · call for the time',
        phone: '+82 54 857 6000',
        questionKo: '오늘 문화광장길 본점에서 크림치즈빵은 몇 시에 처음 나오나요? 그때 예약 없이 살 수 있나요?',
      },
      checked: '2026-11-09', source: andongBakery,
    },
    sources: [
      { label: 'VisitKorea · the market and jjimdak', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=221295' },
      { label: 'Andong Tourism · Mammoth Bakery', url: 'https://www.tourandong.com/public/sub1/sub3.cshtml?idx=2&seq=1548' },
      { label: 'Mammoth Bakery · downtown main shop (Korean)', url: 'https://m.place.naver.com/restaurant/20027201/home' },
      { label: 'OpenStreetMap · Ungbu Park', url: 'https://www.openstreetmap.org/way/545945976' },
      { label: 'Andong city bus departures', url: 'https://bus.andong.go.kr/route?tab=stop' },
    ],
  },
  {
    slug: 'damyang-riverside', city: 'damyang-boseong', name: 'Damyang Noodle Street & Juknokwon', nameKo: '담양 국수거리 · 죽녹원',
    cardRoute: 'Juknokwon bamboo paths → anchovy noodles by the river',
    intro: 'Walk under tall bamboo at Juknokwon, cross Damyangcheon and finish with a bowl of noodles by the river. All three stops are in Damyang.',
    stops: [
      {
        name: 'Juknokwon bamboo garden', nameKo: '죽녹원 정문', lat: 35.32528, lng: 126.98625,
        walk: 'Start at the front ticket office (죽녹원 정문), 119 Juknokwon-ro. From Damyang Bus Terminal, walk through town past Noodle Street and cross the road bridge to the garden.',
        what: 'Stone steps lead up from the riverside road. Follow the shaded paths between tall bamboo stems, then come back down through the same front gate.',
        photo: {
          src: '/walks/damyang-riverside/bamboo.webp', alt: 'A sunlit path lined with tall bamboo inside Juknokwon in Damyang.',
          credit: 'Christian Bolz · resized and converted to WebP', license: 'CC BY-SA 4.0',
          source: 'https://commons.wikimedia.org/wiki/File:Damyang_Jungnogwon_(1).jpg',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        },
      },
      {
        name: 'Gwanbangjerim riverside', nameKo: '관방제림', lat: 35.32392, lng: 126.98559,
        walk: 'Return to the bridge on Juknokwon-ro and cross south. Turn onto the raised riverbank where the old trees of Gwanbangjerim begin.',
        what: 'Follow the broadleaf trees planted along the flood bank. Turn back towards the road bridge and the noodle shops on this side.',
        photo: {
          src: '/walks/damyang-riverside/river.webp', alt: 'The sunset reflected in the river beside the Gwanbangjerim embankment in Damyang.',
          caption: 'The river seen from the bridge by Gwanbangjerim.',
          credit: 'Byungjoon Kim · resized and converted to WebP', license: 'CC BY 2.0',
          source: 'https://commons.wikimedia.org/wiki/File:Korea-Damyang-Yeongsan_River_at_Sunset-01.jpg',
          licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
        },
      },
      {
        name: 'Jinune Jip Guksu on Noodle Street', nameKo: '담양 국수거리 · 진우네집국수',
        lat: 35.32411, lng: 126.98427,
        walk: 'Follow the bank west past the bridge to Noodle Street. Look for 진우네집국수 at 32 Gaeksa 3-gil. For the bus home, walk south through town to Damyang Bus Terminal.',
        what: 'Ask for myeolchi gungmul guksu (멸치국물국수) for noodles in hot anchovy broth. Bibim guksu (비빔국수) comes mixed with spicy sauce.',
      },
    ],
    food: {
      name: 'Anchovy-broth noodles', nameKo: '멸치국물국수', stop: 3,
      detail: 'Jinune Jip Guksu serves medium-thick noodles in anchovy broth with a side of boiled eggs available to order. Ask for dwaejigogi yukjeon (돼지고기육전) for slices of pork fried in egg batter.',
    },
    breakfast: {
      venue: 'Jinune Jip Guksu', venueKo: '진우네집국수', stop: 3,
      hours: 'Restaurant open 09:00–20:00. Closed for the traditional holidays.',
      address: '32 Gaeksa 3-gil, Damyang-eup, Damyang',
      detail: 'For an early bowl, ask when the kitchen starts serving hot anchovy-broth noodles (멸치국물국수). The shop is across the river from the bamboo garden.',
      ordering: {
        summary: 'First bowl of anchovy noodles · call for the time',
        phone: '+82 61 381 5344',
        questionKo: '오늘 객사3길 가게에서 멸치국물국수는 몇 시부터 주문할 수 있나요?',
      },
      checked: '2026-11-09', source: damyangNoodles,
    },
    sources: [
      { label: 'Damyang Market · town walking routes', url: 'https://damyangmarket.co.kr/travel.html' },
      { label: 'VisitKorea · Gwanbangjerim riverside', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=89164' },
      { label: 'VisitKorea · Juknokwon bamboo garden', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=93987' },
      { label: 'OpenStreetMap · Juknokwon front ticket office', url: 'https://www.openstreetmap.org/node/4978708621' },
    ],
  },
  {
    slug: 'boseong-tea-fields', city: 'damyang-boseong', name: 'Daehan Dawon tea fields', nameKo: '보성 대한다원',
    cardRoute: 'Cedar avenue, local green tea and the hillside rows',
    intro: 'In Boseong, take the cedar-lined path into Daehan Dawon, stop for tea and walk up the central steps for a view across the rows of tea bushes.',
    stops: [
      {
        name: 'Cedar avenue', nameKo: '대한다원 삼나무길', lat: 34.7154, lng: 127.08032,
        walk: 'From Boseong Bus Terminal, look for a county bus that calls at Dawon (다원). From the main road follow signs for 대한다원 past the parking areas to the avenue of cedars.',
        what: 'Follow the tall trees towards the ticket office. The tea fields lie on the hillside beyond the entrance.',
        photo: {
          src: '/walks/boseong-tea-fields/cedar-avenue.webp', alt: 'Tall, straight cedar trunks lining the entrance path at Daehan Dawon.',
          credit: 'Jocelyndurrey · resized and converted to WebP', license: 'CC BY-SA 4.0',
          source: 'https://commons.wikimedia.org/wiki/File:대한다원_길.jpg',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        },
      },
      {
        name: 'Dawon Swimteo tea stop', nameKo: '다원쉼터', lat: 34.71569, lng: 127.07881,
        walk: 'Go through the ticket gate and follow the cedar path past the fountain. Look for the white building marked 대한다원쉼터 by the main square.',
        what: 'The ground-floor takeaway counter serves Boseong green tea (보성 녹차) hot or iced, matcha lattes and ice cream.',
      },
      {
        name: 'Tea field viewpoint', nameKo: '대한다원 차밭 전망 지점', lat: 34.71657, lng: 127.0783,
        walk: 'Inside the paid grounds, take the central steps uphill to the first viewpoint overlooking the tea bushes. Return down the same steps to leave through the cedar avenue.',
        what: 'Rows of tea bushes curve around the hillside. For the bus to Boseong town, turn left at the main road and cross using the underpass to reach the town-bound stop.',
        photo: {
          src: '/walks/boseong-tea-fields/tea.webp', alt: 'Tea shoots in front of curved rows on the hillside at the Boseong tea fields in summer.',
          credit: 'S Shamima Nasrin · resized and converted to WebP', license: 'CC BY-SA 4.0',
          source: 'https://commons.wikimedia.org/wiki/File:Boseong_Green_Tea_Field_in_summer_2017.jpg',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        },
      },
    ],
    food: {
      name: 'Boseong green tea and matcha ice cream', nameKo: '보성 녹차 · 말차 아이스크림', stop: 2,
      detail: 'Ask for Boseong nokcha (보성 녹차) for plain green tea, or malcha aiseukeurim (말차 아이스크림) for matcha ice cream.',
    },
    breakfast: {
      venue: 'Dawon Swimteo', venueKo: '다원쉼터', stop: 2,
      hours: 'The tea fields open at 09:00. The plantation lists no separate time for the takeaway counter.',
      address: '763-67 Nokcha-ro, Boseong-eup, Boseong',
      detail: 'The takeaway menu lists tea and ice cream. For a meal, call the plantation before buying an entry ticket and ask whether the kitchen is serving green-tea noodles (녹차자장면) that day.',
      ordering: {
        summary: 'Morning tea or noodles · call before visiting',
        phone: '+82 61 852 4540',
        questionKo: '오늘 다원쉼터에서 녹차는 몇 시부터 주문할 수 있나요? 녹차자장면도 판매하나요? 몇 시부터 먹을 수 있나요?',
      },
      checked: '2026-11-09', source: boseongRestaurant,
    },
    sources: [
      { label: 'Daehan Dawon · rest stop location on the grounds', url: 'https://dhdawon.com/page/sub_01_05.asp?pageNum=1&subNum=5' },
      { label: 'Boseong County · plantation phone number', url: 'https://www.boseong.go.kr/english/tourism/contact_numbers' },
      { label: 'VisitKorea · Daehan Dawon trail and admission', url: 'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=110794' },
      { label: 'Boseong County · tea field map', url: 'https://www.boseong.go.kr/tour/tourist/9tour/greentea_field' },
      { label: 'Boseong County · buses from the terminal', url: 'https://www.boseong.go.kr/tour/tourguide/traffic/rural_bus' },
      { label: 'Daehan Dawon · where to board the bus back', url: 'https://dhdawon.com/page/sub_01_07.asp?pageNum=1&subNum=7' },
      { label: 'OpenStreetMap · tea field viewpoint', url: 'https://www.openstreetmap.org/node/10211103117' },
    ],
  },
]
