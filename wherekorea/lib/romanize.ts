// Korean festival titles → traveler-readable English.
// Strategy: dictionary-replace common festival words, then romanize the
// remaining Hangul with Revised Romanization (no dependency, syllable-level).
// e.g. '진주남강유등축제' → 'Jinjunamgang Lantern Festival'
// Romanized proper nouns are searchable on maps; generic words are translated.

const CHO = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h']
const JUNG = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i']
const JONG = ['','k','k','k','n','n','n','t','l','k','m','p','l','l','l','l','m','p','p','t','t','ng','t','t','k','t','p','t']

export function romanize(korean: string): string {
  let out = ''
  for (const ch of korean) {
    const code = ch.charCodeAt(0)
    if (code >= 0xac00 && code <= 0xd7a3) {
      const idx = code - 0xac00
      out += CHO[Math.floor(idx / 588)] + JUNG[Math.floor((idx % 588) / 28)] + JONG[idx % 28]
    } else {
      out += ch
    }
  }
  return out
}

// Place names first — official romanizations (the syllable romanizer can't do
// sound assimilation: 광안리 would come out 'Gwanganri', official is 'Gwangalli').
// Principle: place names stay romanized, everything else becomes real English.
const PLACES: [string, string][] = [
  ['광안리', 'Gwangalli'], ['광안', 'Gwangan'], ['해운대', 'Haeundae'],
  ['여의도', 'Yeouido'], ['청계천', 'Cheonggyecheon'], ['광화문', 'Gwanghwamun'],
  ['한강', 'Hangang'], ['남산', 'Namsan'], ['경복궁', 'Gyeongbokgung'],
  ['남강', 'Namgang'], ['설악', 'Seorak'], ['한라산', 'Hallasan'], ['성산', 'Seongsan'],
  // Seoul districts/landmarks — split adjacent proper nouns so they don't
  // romanize into one unreadable blob ('관악강감찬' → 'Gwanak Ganggamchan').
  ['관악', 'Gwanak'], ['강남', 'Gangnam'], ['강동', 'Gangdong'], ['종로', 'Jongno'],
  ['마곡', 'Magok'], ['성수', 'Seongsu'], ['홍대', 'Hongdae'], ['이태원', 'Itaewon'],
  ['인사동', 'Insadong'], ['잠실', 'Jamsil'], ['서울', 'Seoul'],
  // Destination + nearby city names. Also fixes sound-assimilation the syllable
  // romanizer gets wrong ('강릉'→Gangreung✗ Gangneung✓, '신라'→Sinra✗ Silla✓),
  // and splits city+landmark compounds ('수원화성'→'Suwon Hwaseong').
  ['강릉', 'Gangneung'], ['신라', 'Silla'], ['수원', 'Suwon'], ['화성', 'Hwaseong'],
  ['통영', 'Tongyeong'], ['한산', 'Hansan'], ['산청', 'Sancheong'], ['동래', 'Dongnae'],
  ['명주', 'Myeongju'], ['부산', 'Busan'], ['전주', 'Jeonju'], ['안동', 'Andong'],
  ['경주', 'Gyeongju'], ['춘천', 'Chuncheon'], ['제주', 'Jeju'], ['여수', 'Yeosu'],
  ['경기', 'Gyeonggi'], ['대한민국', 'Korea'],
]

// Longest-first replacements — generic festival vocabulary only.
// Values are padded with spaces on BOTH sides so adjacent Hangul stays separated
// ('국제탈춤' → ' International  Mask Dance ' → collapsed later).
const WORDS: [string, string][] = [
  ['페스티벌', 'Festival'], ['대축제', 'Grand Festival'], ['문화제', 'Culture Festival'],
  ['영화제', 'Film Festival'], ['박람회', 'Expo'], ['엑스포', 'Expo'],
  ['불꽃놀이', 'Fireworks'], ['불꽃', 'Fireworks'], ['벚꽃', 'Cherry Blossom'],
  ['유등', 'Lantern'], ['등불', 'Lantern'], ['단풍', 'Autumn Leaves'],
  ['눈꽃', 'Snow'], ['빙어', 'Smelt'], ['머드', 'Mud'], ['송어', 'Trout'],
  ['탈춤', 'Mask Dance'], ['밤바다', 'Night Sea'],
  ['야행', 'Night Stroll'], ['한마당', 'Festival'], ['걷기', 'Walk'],
  ['마라톤', 'Marathon'], ['퍼레이드', 'Parade'], ['콘서트', 'Concert'],
  ['음악회', 'Concert'], ['음악', 'Music'], ['예술', 'Arts'],
  ['전통', 'Traditional'], ['국제', 'International'], ['세계', 'World'],
  ['문화유산', 'Heritage'], ['국가유산', 'National Heritage'], ['문화', 'Culture'],
  ['드론', 'Drone'], ['미디어아트', 'Media Art'], ['거리', 'Street'],
  ['시장', 'Market'], ['마을', 'Village'], ['바다', 'Sea'], ['해변', 'Beach'],
  ['라이트쇼', 'Light Show'], ['불빛쇼', 'Light Show'], ['빛초롱', 'Lantern'],
  ['불빛', 'Lights'], ['빛', 'Light'], ['쇼', 'Show'],
  ['야시장', 'Night Market'], ['야경', 'Night View'], ['밤', 'Night'],
  ['여름', 'Summer'], ['겨울', 'Winter'], ['봄꽃', 'Spring Flower'], ['봄', 'Spring'], ['가을', 'Autumn'],
  ['해맞이', 'Sunrise'], ['일출', 'Sunrise'], ['정원', 'Garden'], ['꽃', 'Flower'],
  ['공연', 'Performance'], ['연극', 'Theater'], ['뮤지컬', 'Musical'], ['전시', 'Exhibition'],
  ['팝업', 'Pop-up'], ['페어', 'Fair'], ['위크', 'Week'], ['주간', 'Week'], ['마켓', 'Market'],
  ['페스타', 'Festa'], ['행사', 'Festival'], ['어텀', 'Autumn'], ['작가', 'Writers'],
  ['선사', 'Prehistoric'], ['광장', 'Plaza'], ['인형극제', 'Puppet Festival'],
  ['인형극', 'Puppet Theater'], ['읍성', 'Fortress'], ['역사', 'History'],
  ['대첩', 'Victory'], ['한방약초', 'Herbal Medicine'], ['한방', 'Herbal'], ['약초', 'Herb'],
  ['핸드메이드', 'Handmade'], ['청년의 날', 'Youth Day'], ['청년', 'Youth'], ['우리', 'Our'],
  ['워터', 'Water'], ['불교', 'Buddhist'],
  ['클래식', 'Classical'], ['재즈', 'Jazz'], ['크리스마스', 'Christmas'],
  ['일러스트레이션', 'Illustration'], ['보드게임', 'Board Game'], ['게임', 'Game'],
  ['썸머', 'Summer'], ['윈터', 'Winter'], ['비치', 'Beach'], ['나이트', 'Night'],
  ['투어', 'Tour'], ['뷰', 'View'], ['크루즈', 'Cruise'], ['피크닉', 'Picnic'],
  ['캠핑', 'Camping'], ['러닝', 'Running'], ['뮤직', 'Music'], ['아트', 'Art'],
  ['디자인', 'Design'], ['푸드', 'Food'], ['커피', 'Coffee'], ['맥주', 'Beer'],
  ['와인', 'Wine'], ['치킨', 'Chicken'], ['불빛정원', 'Light Garden'],
  ['축제', 'Festival'], ['축전', 'Festival'], ['잔치', 'Festival'], ['대회', 'Contest'],
]
// Longest keys first — otherwise '시장' would fire inside '야시장'
const DICT: [string, string][] = [...WORDS]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([ko, en]) => [ko, ` ${en} `])

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

// Returns null when the converted title would still be unreadable —
// "show only what a traveler can read" (same principle as ticketing labels).
export function koreanTitleToEnglish(title: string): string | null {
  let t = title
    .replace(/제?\s?\d+(회|주년)\s?/g, '') // strip '제28회' style counters
    .trim()
  const knownPlaces = new Set(PLACES.map(([, en]) => en))
  for (const [ko, en] of PLACES) t = t.split(ko).join(` ${en} `)
  for (const [ko, en] of DICT) t = t.split(ko).join(en)
  t = romanize(t)
  t = t.replace(/\s+/g, ' ').trim()
  t = titleCase(t)

  // Quality gate: any romanized-residue word longer than 12 chars that isn't a
  // known place name or translated English word means the title didn't really
  // translate ('Sseommeobichi'). English words can be long too ('International'),
  // so whitelist them alongside place names.
  const englishWords = new Set(DICT.flatMap(([, en]) => en.trim().split(' ')))
  const words = t.split(/\s+/)
  const clean = (w: string) => w.replace(/[^A-Za-z-]/g, '')
  const unreadable = words.some(
    (w) => clean(w).length > 12 && !knownPlaces.has(w) && !englishWords.has(clean(w))
  )
  // Also require at least one real English word so pure-romanization titles drop.
  const hasEnglish = words.some((w) => englishWords.has(clean(w)))
  if (unreadable || !hasEnglish) return null
  return t
}
