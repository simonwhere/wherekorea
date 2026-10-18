/**
 * Korean particles and the copula after a word that changes at runtime (names,
 * titles, numbers). No imports, so any lib or component module can use it.
 */

/** Latin letters whose Korean reading ends in a final consonant: 엘 엠 엔 알. */
const CONSONANT_LETTERS = 'LMNR'

/**
 * Does the word, read aloud, end in a final consonant? A trailing note in
 * brackets is read past ('NT(목덜미 투명대)' reads as 'NT'). Digits: 2·4·5·9 end
 * in a vowel; Latin letters by their Korean name; other non-Hangul reads as a consonant.
 */
export function endsInConsonant(word: string): boolean {
  const trimmed = word.trimEnd()
  const last = (trimmed.replace(/\s*\([^()]*\)$/, '') || trimmed).slice(-1)
  if (last >= '0' && last <= '9') return !'2459'.includes(last)
  const letter = last.toUpperCase()
  if (letter >= 'A' && letter <= 'Z') return CONSONANT_LETTERS.includes(letter)
  const code = last.charCodeAt(0) - 0xac00
  if (code < 0 || code > 11171) return true
  return code % 28 !== 0
}

/** '을' after a final consonant, '를' after a vowel: 엽산을 · 물 마시기를. */
export function objectParticle(word: string): string {
  return endsInConsonant(word) ? '을' : '를'
}

/** '은' after a final consonant, '는' after a vowel: 엽산은 · 걷기는. */
export function topicParticle(word: string): string {
  return endsInConsonant(word) ? '은' : '는'
}

/** '이에요' after a final consonant, '예요' after a vowel (프러포즈예요 · 1,100일이에요 · 여행 2예요). */
export function copula(word: string): string {
  return endsInConsonant(word) ? '이에요' : '예요'
}
