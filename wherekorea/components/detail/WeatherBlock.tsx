import type { Destination } from '@/data/types'
import type { MonthlyAvg, DailyForecast } from '@/lib/weather'
import { wmoToEmoji } from '@/lib/weather'

interface Props {
  destination: Destination
  monthlyAvg?: MonthlyAvg | null
  daily?: DailyForecast[]
}

function dayLabel(iso: string, i: number): string {
  if (i === 0) return 'Today'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleString('en-US', { weekday: 'short' })
}

export default function WeatherBlock({ destination: d, monthlyAvg, daily }: Props) {
  return (
    <div className="py-6 border-b border-white/10">
      <h2 className="text-sm font-semibold text-white/55 uppercase tracking-wide mb-3">
        Weather
      </h2>
      <p className="text-sm text-white/60 mb-1">{d.live_weather_snapshot}</p>
      {monthlyAvg && (
        <p className="text-sm text-white/55 mb-3">
          {monthlyAvg.monthName} avg · {monthlyAvg.avgLow}–{monthlyAvg.avgHigh}°C · {monthlyAvg.condition}
        </p>
      )}

      {/* 7-day forecast strip (live; hidden on fallback) */}
      {daily && daily.length > 0 && (
        <div className="grid grid-cols-7 gap-1 mb-4">
          {daily.slice(0, 7).map((f, i) => (
            <div key={f.date} className="bg-white/5 rounded-md py-2 text-center">
              <p className="text-[10px] text-white/55 mb-1">{dayLabel(f.date, i)}</p>
              <p className="text-base leading-none mb-1" aria-hidden>{wmoToEmoji(f.code)}</p>
              <p className="text-xs text-white/85">{f.tmax}°</p>
              <p className="text-[10px] text-white/55">{f.tmin}°</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-white/85 leading-relaxed">{d.seasonal_weather_context}</p>
    </div>
  )
}
