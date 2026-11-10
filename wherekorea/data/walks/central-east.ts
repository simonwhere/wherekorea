import type { WalkGuide, WalkPhoto } from './types'

function visitKorea(place: string, id: number) {
  return { label: `VisitKorea · ${place}`, url: `https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=${id}` }
}

function commonsPhoto(
  file: string, alt: string, author: string, title: string,
  license: string, licenseUrl: string, caption?: string,
): WalkPhoto {
  return {
    src: `/walks/central-east/${file}.webp`, alt, caption,
    credit: `${author} / Wikimedia Commons · resized and converted to WebP`,
    license, licenseUrl,
    source: `https://commons.wikimedia.org/wiki/File:${title}`,
  }
}

const shareAlike = 'https://creativecommons.org/licenses/by-sa/4.0/'
const chodangHours = { label: 'VisitKorea · Chodang Halmeoni Sundubu menu and hours (Korean)', url: 'https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=d0b55bf6-a9e0-4120-83d6-f55c648b2bc6' }
const dancheonHours = visitKorea('Dancheon Sikdang menu and hours', 188441)
const chuncheonHours = { label: 'VisitKorea · Myeongdong 1 Beonji Dakgalbi menu and closing day (Korean)', url: 'https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=4b6a6986-0b03-4dcd-880a-7e91f81f38c9' }
const boyeongHours = { label: 'Boyeong Mandu · Bukmun main branch listing (Korean)', url: 'https://www.by1977.co.kr/' }

const chodang: WalkGuide = {
  slug: 'chodang', city: 'gangneung', name: 'Chodang to Gangmun Beach', nameKo: '초당두부마을과 강문해변',
  aliases: ['Chodang tofu village', '강문솟대다리'],
  cardRoute: 'Soft tofu in Chodang, then the sand and the Sotdae Bridge',
  intro: 'Start with a bowl of soft tofu in Chodang. Walk out of the restaurant lanes to the East Sea, then follow the shore to the white arch of the Sotdae Bridge.',
  stops: [
    {
      name: 'Chodang Halmeoni Sundubu', nameKo: '초당할머니순두부',
      lat: 37.790555, lng: 128.915397,
      walk: 'Start in Chodang Tofu Village at 77 Chodangsundubu-gil. Match the full Korean name 초당할머니순두부 on the sign.',
      what: 'Order 순두부백반, a set meal with pale, soft tofu curds, rice and side dishes. Chodang tofu is traditionally made with seawater from this coast.',
      photo: commonsPhoto('dubu', 'Soft white tofu curds in their broth in Chodang', 'lazy fri13th', 'Sun-dubu_6.jpg', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0/', 'Soft tofu photographed in Chodang Tofu Village.'),
    },
    {
      name: 'Gangmun Beach', nameKo: '강문해변',
      lat: 37.794798, lng: 128.919015,
      walk: 'Leave the village lanes and head northeast toward the coast. At Changhae-ro, cross at a marked crossing and follow the signs for Gangmun Beach.',
      what: 'The seafront opens onto a stretch of sand. Turn left with the water on your right and walk north along the beach toward the white bridge.',
      photo: commonsPhoto('beach', 'Sand and the shoreline at Gangmun Beach', 'Christophe95', 'Gangmun_Beach.jpg', 'CC BY-SA 4.0', shareAlike),
    },
    {
      name: 'Gangmun Sotdae Bridge', nameKo: '강문솟대다리',
      lat: 37.797725, lng: 128.916675,
      walk: 'Stay on the seafront until you reach the channel at the north end of the beach. The white arched footbridge crosses the water here.',
      what: 'From the footbridge you can see the channel meet the East Sea. Gangmun Beach is behind you and Gyeongpo Beach begins across the water.',
      photo: commonsPhoto('bridge', 'White arch of Gangmun Sotdae Bridge over the channel', 'Christophe95', 'Gangmun_Sotdae_Bridge_1.jpg', 'CC BY-SA 4.0', shareAlike),
    },
  ],
  food: { name: 'Soft tofu with rice', nameKo: '순두부백반', detail: 'The plain tofu set comes with rice and side dishes. The lightly set curds are served in a bowl.', stop: 1 },
  breakfast: {
    venue: 'Chodang Halmeoni Sundubu', venueKo: '초당할머니순두부', stop: 1,
    hours: 'Mon, Thu & Fri 08:00–19:00 · Tue 08:00–15:00 · Sat & Sun 08:00–18:30 · Wed closed',
    address: '77 Chodangsundubu-gil, Gangneung · 초당순두부길 77',
    detail: 'The kitchen takes a break from 16:00 to 17:00 on Monday, Thursday and Friday, and from 15:30 to 17:00 on weekends.',
    ordering: {
      summary: 'Soft tofu with rice · call for the first serving',
      phone: '+82 33 652 2058',
      questionKo: '아침에 순두부백반은 몇 시부터 매장에서 주문할 수 있나요?',
    },
    checked: '2026-11-09', source: chodangHours,
  },
  sources: [chodangHours, visitKorea('Chodang Tofu Village', 109344), visitKorea('Gangmun Beach', 77680),
    { label: 'VisitKorea · Gangmun Sotdae Bridge and both shores (Korean)', url: 'https://access.visitkorea.or.kr/ms/detail.do?cotId=728e2480-8b56-4f8a-bf80-4cf872439562' }],
}

const abaiVillage: WalkGuide = {
  slug: 'abai-village', city: 'sokcho', name: 'Abai Village', nameKo: '아바이마을',
  aliases: ['Gaetbae', 'Cheongho Beach', '단천식당'],
  cardRoute: 'Cross by cable ferry for stuffed squid, then walk to Cheongho Beach',
  intro: 'Take the small cable ferry across from downtown Sokcho. On the village side, the lane of sundae restaurants leads toward the sand at Cheongho.',
  stops: [
    {
      name: 'Gaetbae ferry · downtown landing', nameKo: '중앙동 갯배선착장',
      lat: 38.202805, lng: 128.592198,
      walk: 'Start at 51 Jungangbudu-gil on the downtown side of the channel. Look for 갯배, then board for Abai Village on the opposite bank.',
      what: 'The ferryman pulls the boat along a steel cable. An adult crossing is ₩500 one way. The city operator lists 05:00–23:00 from May to October and 05:30–22:30 from November to April, weather permitting.',
      photo: commonsPhoto('ferry', 'Covered boarding area at the Gaetbae ferry in Sokcho', 'Mobius6', 'Gaetbae_20221209_001.jpg', 'CC BY-SA 4.0', shareAlike),
    },
    {
      name: 'Dancheon Sikdang', nameKo: '단천식당',
      lat: 38.202611, lng: 128.593673,
      walk: 'Step off on the village side, follow Abaimaeul-gil into the restaurant lane and look for 단천식당 at number 17.',
      what: 'Ojingeo-sundae is squid packed with filling and cut into rounds. The menu also offers Abai-sundae, a sausage in a pork casing, and Hamheung-style cold noodles.',
      photo: {
        src: '/walks/central-east/sokcho-stuffed-squid.webp',
        alt: 'Golden slices of stuffed squid showing the filling inside',
        caption: 'Ojingeo-sundae photographed in Sokcho.',
        credit: 'Park Dong-sik (박동식) / Korea Copyright Commission · resized and converted to WebP',
        license: 'CC BY 4.0',
        source: 'https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=200018&wrtSn=13276417',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      },
    },
    {
      name: 'Cheongho Beach', nameKo: '청호해변',
      lat: 38.199600, lng: 128.595925,
      walk: 'Continue south through the village lanes toward the sea. Follow the signs for 청호해변 to the small beach along the east side of Cheongho-dong.',
      what: 'A breakwater shelters the sand beside the residential lanes. To return to downtown by ferry, walk back to the village landing.',
    },
  ],
  food: { name: 'Stuffed squid', nameKo: '오징어순대', detail: 'Ask for ojingeo-sundae to try the squid version. Abai-sundae on the same menu is the pork sausage.', stop: 2 },
  breakfast: {
    venue: 'Dancheon Sikdang', venueKo: '단천식당', stop: 2, hours: '08:30–19:00 daily',
    address: '17 Abaimaeul-gil, Sokcho · 아바이마을길 17',
    detail: 'The restaurant takes a break from 15:30 to 16:00. Call before crossing on the ferry for an early plate of stuffed squid.',
    ordering: {
      summary: 'Stuffed squid · call for the first order',
      phone: '+82 33 632 7828',
      questionKo: '아침에 오징어순대는 매장에서 몇 시부터 주문할 수 있나요?',
    },
    checked: '2026-11-09', source: dancheonHours,
  },
  sources: [dancheonHours, { label: 'Sokcho Facilities Management Corporation · ferry hours and fares (Korean)', url: 'https://sokchosiseol.or.kr/biz/ferry.do' },
    visitKorea('Gaetbae landing', 70424), visitKorea('Abai Village', 107594),
    { label: 'Sokcho City · Cheongho Beach (Korean)', url: 'https://www.sokcho.go.kr/ct/tour/attraction/nature?contentSeq=1' }],
}

const chuncheonMyeongdong: WalkGuide = {
  slug: 'chuncheon-myeongdong', city: 'chuncheon', name: 'Chuncheon Myeongdong', nameKo: '춘천 명동',
  aliases: ['Yukrimgogae', 'Jungang Market', '닭갈비골목'],
  cardRoute: 'Jungang Market → spicy chicken in Dakgalbi Alley → Yukrimgogae',
  intro: 'Start under the market roof in downtown Chuncheon, step into the alley for chicken cooked on an iron plate, then walk up to the small shops on Yukrimgogae.',
  stops: [
    {
      name: 'Chuncheon Jungang Market', nameKo: '춘천 중앙시장',
      lat: 37.878075, lng: 127.725553,
      walk: 'Find the covered market on Myeongdong-gil. Entrances are marked 중앙시장 or 낭만시장, its other local name.',
      what: 'Walk past fabric, clothes and food stalls under the roof. Leave toward Myeongdong to reach the nearby dakgalbi alley. Individual vendors set their own hours.',
      photo: commonsPhoto('chunmarket', 'The Chuncheon Jungang Market entrance sign above its blue roof', 'YellowTurtle9', '20231226_춘천중앙시장_입구.jpg', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'),
    },
    {
      name: 'Myeongdong 1 Beonji Dakgalbi', nameKo: '명동1번지닭갈비',
      lat: 37.879314, lng: 127.727884,
      walk: 'Walk east from the market into Myeongdong. Follow the 닭갈비골목 signs to Geumgang-ro 62beon-gil and look for number 7.',
      what: 'Chicken, cabbage and spicy sauce cook together on a round iron plate. Makguksu, a bowl of buckwheat noodles, is also on the menu.',
      photo: commonsPhoto('dak', 'Chicken and cabbage cooking on a round dakgalbi pan in downtown Chuncheon', 'Mimmodipalma', 'Dak_galbichuncheon.jpg', 'CC BY-SA 4.0', shareAlike, 'Dakgalbi photographed in downtown Chuncheon.'),
    },
    {
      name: 'Yukrimgogae', nameKo: '육림고개',
      lat: 37.877540, lng: 127.729522,
      walk: 'Leave the dakgalbi alley toward Chuncheon-ro 151beon-gil, southeast of the restaurant. The lane slopes up toward the former Yukrim Cinema.',
      what: 'Craft shops, cafés and small restaurants line this old market road. Walk the slope for the shopfronts and signs left from its years as a downtown shopping street.',
    },
  ],
  food: { name: 'Spicy chicken on an iron plate', nameKo: '철판닭갈비', detail: 'Dakgalbi is chicken stir-fried with vegetables. Ask for dakgalbi at stop 2 or order the buckwheat noodles listed as 막국수.', stop: 2 },
  breakfast: {
    venue: 'Myeongdong 1 Beonji Dakgalbi', venueKo: '명동1번지닭갈비', stop: 2, hours: '10:00–22:00 · closed the first Wednesday of each month',
    address: '7 Geumgang-ro 62beon-gil, Chuncheon · 금강로62번길 7',
    detail: 'Last order is at 21:00. The stalls inside Jungang Market keep their own hours.',
    ordering: {
      summary: 'Iron-plate dakgalbi · call for the first order',
      phone: '+82 33 256 6448',
      questionKo: '아침에 철판닭갈비는 몇 시부터 매장에서 주문할 수 있나요?',
    },
    checked: '2026-11-09', source: chuncheonHours,
  },
  sources: [chuncheonHours, visitKorea('Chuncheon Jungang Market', 76551), visitKorea('Myeongdong Dakgalbi Street', 108005), visitKorea('Yukrimgogae', 43252)],
}

const janganmun: WalkGuide = {
  slug: 'janganmun', city: 'suwon', name: 'Hwaseong’s northern gates', nameKo: '화홍문과 장안문',
  aliases: ['Hwahongmun', 'Boyeong Mandu', '북문'],
  cardRoute: 'Follow the fortress from Hwahongmun to Janganmun for dumplings',
  intro: 'Begin where the stream runs under the fortress wall. Walk west to the big north gate, then cross to the dumpling shop on Paldal-ro.',
  stops: [
    {
      name: 'Hwahongmun Watergate', nameKo: '화홍문',
      lat: 37.287456, lng: 127.017955,
      walk: 'Start at 377 Suwoncheon-ro. From the stream bank, find the tiled pavilion spanning the water.',
      what: 'Look below the pavilion for seven stone arches. They let the Suwoncheon flow through the northern fortress wall.',
      photo: commonsPhoto('hwahong', 'Painted wooden pavilion of Hwahongmun above the stone watergate', 'Bernard Gagnon', 'Hwahongmun_01.jpg', 'CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'),
    },
    {
      name: 'Janganmun Gate', nameKo: '장안문',
      lat: 37.288851, lng: 127.014309,
      walk: 'Take the path west along the fortress wall toward 장안문. At Jeongjo-ro the wall opens into a tall, two-story gate.',
      what: 'Janganmun was the entrance used by the king arriving from the capital. From the outside, look back at the tiled upper story and stone arch.',
      photo: commonsPhoto('jangan', 'The stone arch and tiled roof of Janganmun Gate', 'YKJJ', 'Janganmun_(Gate).jpg', 'CC BY-SA 4.0', shareAlike),
    },
    {
      name: 'Boyeong Mandu · north gate shop', nameKo: '보영만두 북문본점',
      lat: 37.289562, lng: 127.014441,
      walk: 'Use the marked crossings on the north side of the gate to reach 271 Paldal-ro. Check the sign for 보영만두 and the branch name 북문본점.',
      what: 'The shop serves steamed dumplings, fried dumplings and jjolmyeon. The chewy noodles come with shredded vegetables and a chili dressing.',
    },
  ],
  food: { name: 'Fried dumplings and chewy noodles', nameKo: '군만두와 쫄면', detail: 'Order 군만두 for fried dumplings or 찐만두 for steamed dumplings. Jjolmyeon is the spicy noodle dish served alongside.', stop: 3 },
  breakfast: {
    venue: 'Boyeong Mandu · north gate shop', venueKo: '보영만두 북문본점', stop: 3,
    hours: '10:00–01:00 daily · last order 00:30',
    address: '271 Paldal-ro, Jangan-gu, Suwon · 장안구 팔달로 271',
    detail: 'Use the Bukmun main branch at 271 Paldal-ro. It closes at 01:00 the following morning.',
    ordering: {
      summary: 'Fried dumplings and jjolmyeon · call for the first order',
      phone: '+82 31 255 1085',
      questionKo: '북문본점에서 아침에 군만두와 쫄면은 각각 몇 시부터 주문할 수 있나요?',
    },
    checked: '2026-11-09', source: boyeongHours,
  },
  sources: [boyeongHours, { label: 'Gyeonggi Cultural Foundation · Boyeong Mandu, address and menu', url: 'https://ggc.ggcf.kr/p/5a5c8f28482b6a0c41df567f' },
    { label: 'Suwon City · fortress walking map and gate locations (Korean)', url: 'https://www.suwon.go.kr/webcontent/ckeditor/2022/7/18/59ea7803-2adb-4b2b-982f-4610e1e3e41e.pdf' },
    visitKorea('Hwahongmun Watergate', 108749), visitKorea('Janganmun Gate', 108756)],
}

export const centralEastWalks = [chodang, abaiVillage, chuncheonMyeongdong, janganmun]
