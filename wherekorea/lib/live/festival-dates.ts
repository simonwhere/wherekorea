/** Calendar-only TourAPI dates. Never depend on the server's local timezone. */
export function koreaDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? ''
  return `${part('year')}${part('month')}${part('day')}`
}

export function validFestivalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{8}$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(4, 6))
  const day = Number(value.slice(6, 8))
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function festivalPhase(start: unknown, end: unknown, today: string): 'ongoing' | 'upcoming' | null {
  if (!validFestivalDate(start) || !validFestivalDate(end) || !validFestivalDate(today)) return null
  if (start > end || end < today) return null
  return start <= today ? 'ongoing' : 'upcoming'
}

export function festivalDateLabel(value: string): string {
  if (!validFestivalDate(value)) return 'Date unconfirmed'
  const date = new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8))))
  return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
}

export function validFestivalCoordinates(lat: unknown, lon: unknown): boolean {
  const populated = (value: unknown) => (typeof value === 'string' && value.trim() !== '') || typeof value === 'number'
  if (!populated(lat) || !populated(lon)) return false
  const latitude = Number(lat)
  const longitude = Number(lon)
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
}
