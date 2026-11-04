import type { Destination } from '@/data/types'

export const COORDS: Record<string, { lat: number; lon: number }> = {
  seoul:     { lat: 37.5665, lon: 126.9780 },
  busan:     { lat: 35.1796, lon: 129.0756 },
  jeju:      { lat: 33.4996, lon: 126.5312 },
  gyeongju:  { lat: 35.8562, lon: 129.2247 },
  jeonju:    { lat: 35.8242, lon: 127.1480 },
  gangneung: { lat: 37.7519, lon: 128.8761 },
  sokcho:    { lat: 38.2070, lon: 128.5918 },
  tongyeong: { lat: 34.8544, lon: 128.4330 },
  namhae:    { lat: 34.8375, lon: 127.8921 },
  jirisan:   { lat: 35.3372, lon: 127.7306 },
  yeosu:     { lat: 34.7604, lon: 127.6622 },
  andong:    { lat: 36.5684, lon: 128.7294 },
  suwon:     { lat: 37.2636, lon: 127.0286 },
  chuncheon: { lat: 37.8813, lon: 127.7298 },
  'damyang-boseong': { lat: 34.7714, lon: 127.0800 }, // Boseong tea fields
}

// WMO weather interpretation codes
// https://open-meteo.com/en/docs#weathervariables
const WMO_CODES = new Set([0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99])

export function wmoToCondition(code: number): string {
  if (!WMO_CODES.has(code)) return 'conditions unavailable'
  if (code === 0)  return 'clear'
  if (code === 1)  return 'mostly clear'
  if (code === 2)  return 'partly cloudy'
  if (code === 3)  return 'overcast'
  if (code <= 48)  return 'foggy'
  if (code <= 55)  return 'drizzle'
  if (code <= 67)  return 'rainy'
  if (code <= 77)  return 'snowy'
  if (code <= 82)  return 'showery'
  if (code <= 86)  return 'snow showers'
  return 'stormy'
}

export function wmoToEmoji(code: number): string {
  if (!WMO_CODES.has(code)) return '—'
  if (code === 0)  return '☀️'
  if (code === 1)  return '🌤️'
  if (code === 2)  return '⛅'
  if (code === 3)  return '☁️'
  if (code <= 48)  return '🌫️'
  if (code <= 55)  return '🌦️'
  if (code <= 67)  return '🌧️'
  if (code <= 77)  return '❄️'
  if (code <= 82)  return '🌦️'
  if (code <= 86)  return '🌨️'
  return '⛈️'
}

function dominantCondition(codes: number[]): string {
  const counts: Record<string, number> = {}
  for (const code of codes) {
    const cond = wmoToCondition(code)
    counts[cond] = (counts[cond] ?? 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'conditions unavailable'
}

export interface DailyForecast {
  date: string // ISO YYYY-MM-DD
  tmax: number
  tmin: number
  code: number
}

export interface WeatherResult {
  snapshot: string
  currentTemp: number
  currentCode: number
  daily: DailyForecast[] // 7-day forecast; [] on fallback
  isLive: boolean
}

export interface MonthlyAvg {
  avgHigh: number
  avgLow: number
  condition: string
  monthName: string
  year: number
  sampleDays: number
}

export interface ArchiveMonthWindow {
  month: number
  year: number
  monthName: string
  startDate: string
  endDate: string
  dayCount: number
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function validWeatherDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function koreaWeatherDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function datesFrom(startDate: string, length: number): string[] {
  const start = new Date(`${startDate}T00:00:00Z`).getTime()
  return Array.from({ length }, (_, index) => new Date(start + index * 86400000).toISOString().slice(0, 10))
}

/** Reject a partial/malformed series rather than rounding missing values into 0°C. */
function parseDaily(value: unknown, expectedDates: string[]): DailyForecast[] | null {
  if (!record(value)) return null
  const { time, temperature_2m_max: highs, temperature_2m_min: lows, weathercode: codes } = value
  if (!Array.isArray(time) || !Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(codes)) return null
  if ([time, highs, lows, codes].some((array) => array.length !== expectedDates.length)) return null
  const daily: DailyForecast[] = []
  for (let index = 0; index < expectedDates.length; index++) {
    const date = time[index]
    const high = highs[index]
    const low = lows[index]
    const code = codes[index]
    if (!validWeatherDate(date) || date !== expectedDates[index]
      || !finiteNumber(high) || !finiteNumber(low) || low > high
      || !finiteNumber(code) || !WMO_CODES.has(code)) return null
    daily.push({ date, tmax: Math.round(high), tmin: Math.round(low), code })
  }
  return daily
}

/** Pure parser: current conditions plus seven complete Korea-local calendar days. */
export function parseWeatherForecast(input: unknown, now = new Date()): WeatherResult | null {
  if (!record(input) || !record(input.current)) return null
  const temperature = input.current.temperature_2m
  const code = input.current.weathercode
  if (!finiteNumber(temperature) || !finiteNumber(code) || !WMO_CODES.has(code)) return null
  const today = koreaWeatherDate(now)
  // The provider includes current.time. Validate it when supplied while keeping
  // compatibility with the existing minimal current-temperature response shape.
  if (input.current.time !== undefined) {
    const time = input.current.time
    if (typeof time !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(time)
      || time.slice(0, 10) !== today || Number(time.slice(11, 13)) > 23
      || Number(time.slice(14, 16)) > 59 || (time.length > 16 && Number(time.slice(17, 19)) > 59)) return null
  }
  const daily = parseDaily(input.daily, datesFrom(today, 7))
  if (!daily) return null
  const high = Math.max(...daily.map((day) => day.tmax))
  const low = Math.min(...daily.map((day) => day.tmin))
  return {
    snapshot: `This week · ${low}–${high}°C · ${dominantCondition(daily.map((day) => day.code))}`,
    currentTemp: Math.round(temperature),
    currentCode: code,
    daily,
    isLive: true,
  }
}

/** Previous year's same Korea-local calendar month, not a multi-year climate normal. */
export function previousYearMonthWindow(now = new Date()): ArchiveMonthWindow {
  const [currentYear, month] = koreaWeatherDate(now).split('-').map(Number)
  const year = currentYear - 1
  const mm = String(month).padStart(2, '0')
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return {
    month, year, dayCount,
    monthName: new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }),
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(dayCount).padStart(2, '0')}`,
  }
}

export function parseWeatherArchive(input: unknown, window: ArchiveMonthWindow): MonthlyAvg | null {
  if (!record(input) || !validWeatherDate(window.startDate) || !validWeatherDate(window.endDate)
    || !Number.isInteger(window.dayCount) || window.dayCount < 28 || window.dayCount > 31) return null
  const daily = parseDaily(input.daily, datesFrom(window.startDate, window.dayCount))
  if (!daily || daily.at(-1)?.date !== window.endDate || !record(input.daily)) return null
  // Preserve the original precision while averaging; only round the displayed means.
  const highs = input.daily.temperature_2m_max as number[]
  const lows = input.daily.temperature_2m_min as number[]
  const avgHigh = Math.round(highs.reduce((sum, value) => sum + value, 0) / daily.length)
  const avgLow = Math.round(lows.reduce((sum, value) => sum + value, 0) / daily.length)
  if (!Number.isFinite(avgHigh) || !Number.isFinite(avgLow)) return null
  return {
    avgHigh,
    avgLow,
    condition: dominantCondition(daily.map((day) => day.code)),
    monthName: window.monthName,
    year: window.year,
    sampleDays: daily.length,
  }
}

export function forecastDayLabel(date: string, now = new Date()): string {
  if (!validWeatherDate(date)) return 'Date unavailable'
  if (date === koreaWeatherDate(now)) return 'Today'
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
}

// Fetch current + 7-day forecast for one destination.
// Falls back to seed snapshot if the API is unavailable.
export async function fetchWeatherSnapshot(
  slug: string,
  fallback: string
): Promise<WeatherResult> {
  const FALLBACK: WeatherResult = {
    snapshot: fallback,
    currentTemp: 0,
    currentCode: 0,
    daily: [],
    isLive: false,
  }
  const coords = Object.prototype.hasOwnProperty.call(COORDS, slug) ? COORDS[slug] : undefined
  if (!coords) return FALLBACK

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${coords.lat}&longitude=${coords.lon}` +
    `&current=temperature_2m,weathercode` +
    `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
    `&timezone=Asia/Seoul&forecast_days=7`

  try {
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return FALLBACK

    return parseWeatherForecast(await res.json()) ?? FALLBACK
  } catch {
    return FALLBACK
  }
}

// Fetch one previous-year month as a clearly labeled historical reference.
export async function fetchMonthlyAverage(slug: string): Promise<MonthlyAvg | null> {
  const coords = Object.prototype.hasOwnProperty.call(COORDS, slug) ? COORDS[slug] : undefined
  if (!coords) return null

  const window = previousYearMonthWindow()

  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${coords.lat}&longitude=${coords.lon}` +
    `&start_date=${window.startDate}&end_date=${window.endDate}` +
    `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
    `&timezone=Asia/Seoul`

  try {
    const res = await fetch(url, { next: { revalidate: 86400 * 7 }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null

    return parseWeatherArchive(await res.json(), window)
  } catch {
    return null
  }
}

// Fetch weather for multiple destinations in parallel.
export async function fetchWeatherForAll(
  destinations: Destination[]
): Promise<Record<string, WeatherResult>> {
  const entries = await Promise.all(
    destinations.map(async (d) => [
      d.slug,
      await fetchWeatherSnapshot(d.slug, d.live_weather_snapshot),
    ] as const)
  )
  return Object.fromEntries(entries)
}

// Merge live weather into a destination array.
export function applyWeather(
  destinations: Destination[],
  weatherMap: Record<string, WeatherResult>
): Destination[] {
  return destinations.map((d) => {
    const w = weatherMap[d.slug]
    if (!w) return d
    return {
      ...d,
      live_weather_snapshot: w.snapshot,
      live_weather_current: w.isLive ? w.currentTemp : undefined,
      live_weather_icon: w.isLive ? wmoToEmoji(w.currentCode) : undefined,
      live_weather_code: w.isLive ? w.currentCode : undefined,
      live_weather_is_live: w.isLive,
    }
  })
}
