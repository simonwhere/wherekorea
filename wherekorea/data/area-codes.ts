// TourAPI (EngService2) area/sigungu codes per destination slug.
// Collected live from areaCode2 on 2026-07-11 (key verified working).
// Festivals: fetched per sigungu; multi-sigungu slugs merge results.

export interface AreaCode {
  areaCode: string
  sigunguCodes?: string[] // omit for whole-city areas (Seoul, Busan, Jeju)
}

export const AREA_CODES: Record<string, AreaCode> = {
  seoul:     { areaCode: '1' },
  busan:     { areaCode: '6' },
  jeju:      { areaCode: '39' },
  suwon:     { areaCode: '31', sigunguCodes: ['13'] },        // Suwon-si
  gangneung: { areaCode: '32', sigunguCodes: ['1'] },         // Gangneung-si
  sokcho:    { areaCode: '32', sigunguCodes: ['5'] },         // Sokcho-si
  chuncheon: { areaCode: '32', sigunguCodes: ['13'] },        // Chuncheon-si
  gyeongju:  { areaCode: '35', sigunguCodes: ['2'] },         // Gyeongju-si
  andong:    { areaCode: '35', sigunguCodes: ['11'] },        // Andong-si
  namhae:    { areaCode: '36', sigunguCodes: ['5'] },         // Namhae-gun
  tongyeong: { areaCode: '36', sigunguCodes: ['17'] },        // Tongyeong-si
  jirisan:   { areaCode: '36', sigunguCodes: ['18', '9'] },   // Hadong-gun + Sancheong-gun
  jeonju:    { areaCode: '37', sigunguCodes: ['12'] },        // Jeonju-si
  yeosu:     { areaCode: '38', sigunguCodes: ['13'] },        // Yeosu-si
  'damyang-boseong': { areaCode: '38', sigunguCodes: ['7', '10'] }, // Damyang-gun + Boseong-gun
}
