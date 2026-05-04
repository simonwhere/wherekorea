import type { Destination } from '@/data/types'

// Coordinates for each v1 destination
const COORDS: Record<string, { lat: number; lon: number }> = {
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
}

// WMO weather interpretation codes → human-readable condition
// https://open-meteo.com/en/docs#weathervariables
function wmoToCondition(code: number): string {
  if (code === 0)             return 'clear'
  if (code === 1)             return 'mostly clear'
  if (code === 2)             return 'partly cloudy'
  if (code === 3)             return 'overcast'
  if (code <= 48)             return 'foggy'
  if (code <= 55)             return 'drizzle'
  if (code <= 67)             return 'rainy'
  if (code <= 77)             return 'snowy'
  if (code <= 82)             return 'showery'
  if (code <= 86)             return 'snow showers'
  return 'stormy'
}

// Pick the most frequently occurring condition across 7 days
function dominantCondition(codes: number[]): string {
  const counts: Record<string, number> = {}
  for (const code of codes) {
    const cond = wmoToCondition(code)
    counts[cond] = (counts[cond] ?? 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

interface OpenMeteoResponse {
  daily: {
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    weathercode: number[]
  }
}

// Fetch 7-day weather snapshot for one destination.
// Returns the seed fallback string if the API is unavailable.
export async function fetchWeatherSnapshot(slug: string, fallback: string): Promise<string> {
  const coords = COORDS[slug]
  if (!coords) return fallback

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${coords.lat}&longitude=${coords.lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
    `&timezone=Asia/Seoul&forecast_days=7`

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return fallback

    const data: OpenMeteoResponse = await res.json()
    const { temperature_2m_max, temperature_2m_min, weathercode } = data.daily

    const high = Math.round(Math.max(...temperature_2m_max))
    const low  = Math.round(Math.min(...temperature_2m_min))
    const condition = dominantCondition(weathercode)

    return `This week · ${low}–${high}°C · ${condition}`
  } catch {
    return fallback
  }
}

// Fetch weather for multiple destinations in parallel.
// Returns a map of slug → live snapshot string.
export async function fetchWeatherForAll(
  destinations: Destination[]
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    destinations.map(async (d) => [
      d.slug,
      await fetchWeatherSnapshot(d.slug, d.live_weather_snapshot),
    ] as const)
  )
  return Object.fromEntries(entries)
}

// Merge live weather into a destination array.
// If a slug has no live entry, the seed value is preserved.
export function applyWeather(
  destinations: Destination[],
  weatherMap: Record<string, string>
): Destination[] {
  return destinations.map((d) => ({
    ...d,
    live_weather_snapshot: weatherMap[d.slug] ?? d.live_weather_snapshot,
  }))
}
