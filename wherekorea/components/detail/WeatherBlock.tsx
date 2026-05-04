import type { Destination } from '@/data/types'

interface Props {
  destination: Destination
}

export default function WeatherBlock({ destination: d }: Props) {
  return (
    <div className="py-6 border-b border-gray-200">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Weather
      </h2>
      <p className="text-sm text-gray-500 mb-3">{d.live_weather_snapshot}</p>
      <p className="text-sm text-gray-700 leading-relaxed">{d.seasonal_weather_context}</p>
    </div>
  )
}
