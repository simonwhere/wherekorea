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
  ['야행', 'Night Stroll'], ['한마당', 'Hanmadang'], ['걷기', 'Walk'],
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
  ['팝업', 'Pop-up'], ['페어', 'Fair'], ['위크', 'Week'], ['마켓', 'Market'],
  ['클래식', 'Classical'], ['재즈', 'Jazz'], ['크리스마스', 'Christmas'],
  ['축제', 'Festival'], ['축전', 'Festival'], ['잔치', 'Festival'], ['대회', 'Contest'],
]
// Longest keys first — otherwise '시장' would fire inside '야시장'
const DICT: [string, string][] = [...WORDS]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([ko, en]) => [ko, ` ${en} `])

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

export function koreanTitleToEnglish(title: string): string {
  let t = title
    .replace(/제?\s?\d+(회|주년)\s?/g, '') // strip '제28회' style counters
    .trim()
  for (const [ko, en] of PLACES) t = t.split(ko).join(` ${en} `)
  for (const [ko, en] of DICT) t = t.split(ko).join(en)
  t = romanize(t)
  // collapse whitespace, tidy word boundaries
  t = t.replace(/\s+/g, ' ').trim()
  return titleCase(t)
}
