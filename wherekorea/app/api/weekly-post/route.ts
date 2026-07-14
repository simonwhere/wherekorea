import { destinations } from '@/data/destinations'
import { fetchWeatherForAll, applyWeather } from '@/lib/weather'
import { fetchFestivalSignals } from '@/lib/live/festivals'
import { sortByBestNow, bestNowReason } from '@/lib/best-now'
import { isPeakNow } from '@/lib/crowd'

// S4 retention loop — "This Week in Korea" Telegram post, generated from live data.
// Open /api/weekly-post, copy, paste into the channel. (Automate later if it sticks.)

export const revalidate = 3600

export async function GET() {
  const now = new Date()
  const month = Number(now.toLocaleString('en-US', { month: 'numeric', timeZone: 'Asia/Seoul' }))
  const dateLabel = now.toLocaleString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'Asia/Seoul',
  })

  const [weatherMap, festivals] = await Promise.all([
    fetchWeatherForAll(destinations),
    fetchFestivalSignals(destinations),
  ])
  const enriched = applyWeather(destinations, weatherMap)
  const ranked = sortByBestNow(enriched, month)

  const top5 = ranked.slice(0, 5).map((d, i) => {
    const t = d.live_weather_current ? ` ${d.live_weather_icon ?? ''}${d.live_weather_current}°` : ''
    return `${i + 1}. ${d.name}${t} — ${bestNowReason(d, month).toLowerCase()}`
  })

  const happening = Object.entries(festivals.now)
    .flatMap(([slug, fs]) => {
      const d = destinations.find((x) => x.slug === slug)
      return d ? fs.map((f) => `• ${d.name}: ${f.name} (until ${f.ends})`) : []
    })
    .slice(0, 5)

  const peaks = enriched.filter((d) => isPeakNow(d, month)).map((d) => d.name)

  const lines = [
    `🇰🇷 This Week in Korea — ${dateLabel}`,
    '',
    'Where to go right now (live ranking):',
    ...top5,
  ]
  if (happening.length > 0) lines.push('', '🎪 Festivals on now:', ...happening)
  if (peaks.length > 0) lines.push('', `⚠️ Peak season (expect crowds): ${peaks.join(', ')}`)
  lines.push('', 'Full rankings, timing charts & comparisons → wherekorea 🔗')

  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
