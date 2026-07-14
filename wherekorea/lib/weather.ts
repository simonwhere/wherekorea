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
function wmoToCondition(code: number): string {
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
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

interface OpenMeteoForecastResponse {
  current: {
    temperature_2m: number
    weathercode: number
  }
  daily: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    weathercode: number[]
  }
}

export interface DailyForecast {
  date: string // ISO YYYY-MM-DD
  tmax: number
  tmin: number
  code: number
}

interface OpenMeteoArchiveResponse {
  daily: {
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    weathercode: number[]
  }
}

export interface WeatherResult {
  snapshot: string
  currentTemp: number
  currentCode: number
  daily: DailyForecast[] // 7-day forecast; [] on fallback
}

export interface MonthlyAvg {
  avgHigh: number
  avgLow: number
  condition: string
  monthName: string
}

// Fetch current + 7-day forecast for one destination.
// Falls back to seed snapshot if the API is unavailable.
export async function fetchWeatherSnapshot(
  slug: string,
  fallback: string
): Promise<WeatherResult> {
  const FALLBACK: WeatherResult = { snapshot: fallback, currentTemp: 0, currentCode: 0, daily: [] }
  const coords = COORDS[slug]
  if (!coords) return FALLBACK

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${coords.lat}&longitude=${coords.lon}` +
    `&current=temperature_2m,weathercode` +
    `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
    `&timezone=Asia/Seoul&forecast_days=7`

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return FALLBACK

    const data: OpenMeteoForecastResponse = await res.json()
    const { time, temperature_2m_max, temperature_2m_min, weathercode } = data.daily
    const currentTemp = Math.round(data.current.temperature_2m)
    const currentCode = data.current.weathercode

    const high = Math.round(Math.max(...temperature_2m_max))
    const low  = Math.round(Math.min(...temperature_2m_min))
    const condition = dominantCondition(weathercode)

    const daily: DailyForecast[] = (time ?? []).map((t, i) => ({
      date: t,
      tmax: Math.round(temperature_2m_max[i]),
      tmin: Math.round(temperature_2m_min[i]),
      code: weathercode[i],
    }))

    return {
      snapshot: `This week · ${low}–${high}°C · ${condition}`,
      currentTemp,
      currentCode,
      daily,
    }
  } catch {
    return FALLBACK
  }
}

// Fetch average conditions for the current month using previous year's archive data.
export async function fetchMonthlyAverage(slug: string): Promise<MonthlyAvg | null> {
  const coords = COORDS[slug]
  if (!coords) return null

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear() - 1
  const mm = String(month).padStart(2, '0')
  const daysInMonth = new Date(year, month, 0).getDate()
  const startDate = `${year}-${mm}-01`
  const endDate = `${year}-${mm}-${daysInMonth}`
  const monthName = now.toLocaleString('en-US', { month: 'long' })

  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${coords.lat}&longitude=${coords.lon}` +
    `&start_date=${startDate}&end_date=${endDate}` +
    `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
    `&timezone=Asia/Seoul`

  try {
    const res = await fetch(url, { next: { revalidate: 86400 * 7 } })
    if (!res.ok) return null

    const data: OpenMeteoArchiveResponse = await res.json()
    const { temperature_2m_max, temperature_2m_min, weathercode } = data.daily

    const avgHigh = Math.round(
      temperature_2m_max.reduce((a, b) => a + b, 0) / temperature_2m_max.length
    )
    const avgLow = Math.round(
      temperature_2m_min.reduce((a, b) => a + b, 0) / temperature_2m_min.length
    )
    const condition = dominantCondition(weathercode)

    return { avgHigh, avgLow, condition, monthName }
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
      live_weather_current: w.currentTemp,
      live_weather_icon: wmoToEmoji(w.currentCode),
    }
  })
}
