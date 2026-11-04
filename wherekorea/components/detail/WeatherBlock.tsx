import type { Destination } from '@/data/types'
import type { MonthlyAvg, DailyForecast } from '@/lib/weather'
import { forecastDayLabel, wmoToCondition, wmoToEmoji } from '@/lib/weather'
import SectionTitle from '@/components/detail/SectionTitle'
import { MONTH_SHORT } from '@/lib/crowd'

interface Props {
  destination: Destination
  monthlyAvg?: MonthlyAvg | null
  daily?: DailyForecast[]
  showLive?: boolean
  month?: number
}

export default function WeatherBlock({ destination: d, monthlyAvg, daily, showLive = true, month }: Props) {
  return (
    <div className="py-6 border-b border-white/10">
      <SectionTitle className="mb-3">{showLive ? 'Current weather & next 7 days' : 'Weather through the year'}</SectionTitle>
      {!showLive && <p className="text-xs text-white/60 mb-3">{month ? `${MONTH_SHORT[month - 1]} selected. ` : ''}Typical conditions; check the forecast before departure.</p>}
      {showLive && <p className="text-sm text-white/60 mb-1">
        {d.live_weather_is_live ? d.live_weather_snapshot : 'Live forecast temporarily unavailable.'}
      </p>}
      {showLive && monthlyAvg && (
        <p className="text-sm text-white/55 mb-3">
          {monthlyAvg.monthName} {monthlyAvg.year} archive · average daily low {monthlyAvg.avgLow}°C / high {monthlyAvg.avgHigh}°C · {monthlyAvg.condition}.
          {' '}Based on {monthlyAvg.sampleDays} days; not a forecast.
        </p>
      )}

      {/* 7-day forecast strip (live; hidden on fallback) */}
      {showLive && d.live_weather_is_live && daily && daily.length > 0 && (
        <div className="grid grid-cols-7 gap-1 mb-4">
          {daily.slice(0, 7).map((f) => (
            <div key={f.date} role="group" className="bg-white/5 rounded-md py-2 text-center" aria-label={`${f.date}: ${wmoToCondition(f.code)}, high ${f.tmax} degrees Celsius, low ${f.tmin} degrees Celsius`}>
              <p className="text-[10px] text-white/65 mb-1">{forecastDayLabel(f.date)}</p>
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
