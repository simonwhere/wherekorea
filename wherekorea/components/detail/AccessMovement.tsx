import type { Destination } from '@/data/types'

interface Props {
  destination: Destination
}

export default function AccessMovement({ destination: d }: Props) {
  return (
    <div className="py-6 border-b border-gray-200">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
        Getting there &amp; getting around
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 rounded-md p-3">
          <p className="text-xs text-gray-400 mb-1">From Seoul</p>
          <p className="text-sm text-gray-700">{d.travel_time.from_seoul}</p>
        </div>
        <div className="bg-gray-50 rounded-md p-3">
          <p className="text-xs text-gray-400 mb-1">From Incheon Airport</p>
          <p className="text-sm text-gray-700">{d.travel_time.from_incheon_airport}</p>
        </div>
        <div className="bg-gray-50 rounded-md p-3">
          <p className="text-xs text-gray-400 mb-1">From Busan Station</p>
          <p className="text-sm text-gray-700">{d.travel_time.from_busan_station}</p>
        </div>
      </div>

      <div className="flex items-start gap-2 mb-3">
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${
            d.no_car_friendliness === 'Easy'
              ? 'bg-gray-100 border-gray-200 text-gray-700'
              : d.no_car_friendliness === 'Hard'
              ? 'bg-gray-100 border-gray-300 text-gray-700'
              : 'bg-gray-50 border-gray-200 text-gray-600'
          }`}
        >
          No-car: {d.no_car_friendliness}
        </span>
        {d.car_recommended && (
          <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600">
            Car recommended
          </span>
        )}
      </div>

      <p className="text-sm text-gray-700 leading-relaxed">{d.local_movement}</p>
    </div>
  )
}
