import type { Destination } from '@/data/types'
import type { MonthlyAvg } from '@/lib/weather'

interface Props {
  destination: Destination
  monthlyAvg?: MonthlyAvg | null
}

export default function WeatherBlock({ destination: d, monthlyAvg }: Props) {
  return (
    <div className="py-6 border-b border-gray-200">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Weather
      </h2>
      <p className="text-sm text-gray-500 mb-1">{d.live_weather_snapshot}</p>
      {monthlyAvg && (
        <p className="text-sm text-gray-400 mb-3">
          {monthlyAvg.monthName} avg · {monthlyAvg.avgLow}–{monthlyAvg.avgHigh}°C · {monthlyAvg.condition}
        </p>
      )}
      <p className="text-sm text-gray-700 leading-relaxed">{d.seasonal_weather_context}</p>
    </div>
  )
}
