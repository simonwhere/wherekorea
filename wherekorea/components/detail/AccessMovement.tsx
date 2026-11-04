import type { Destination } from '@/data/types'
import SectionTitle from '@/components/detail/SectionTitle'
import { TRAVEL_SCOPE, metricEvidence } from '@/lib/trust'
import { getTravelEvidence } from '@/data/travel-evidence'

interface Props {
  destination: Destination
  hasLocalGuide?: boolean
}

export default function AccessMovement({ destination: d, hasLocalGuide = false }: Props) {
  const bookingLinks = hasLocalGuide ? getTravelEvidence(d.slug)?.bookingLinks ?? [] : []
  return (
    <div className="py-6 border-b border-white/10">
      <SectionTitle className="mb-4">Getting there &amp; getting around</SectionTitle>
      <p className="text-xs text-white/65 leading-relaxed mb-4">{TRAVEL_SCOPE}</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white/5 rounded-md p-3">
          <p className="text-xs text-white/55 mb-1">From Seoul</p>
          <p className="text-sm text-white/85">{d.travel_time.from_seoul}</p>
        </div>
        <div className="bg-white/5 rounded-md p-3">
          <p className="text-xs text-white/55 mb-1">From Incheon Airport</p>
          <p className="text-sm text-white/85">{d.travel_time.from_incheon_airport}</p>
        </div>
        <div className="bg-white/5 rounded-md p-3">
          <p className="text-xs text-white/55 mb-1">From Busan Station</p>
          <p className="text-sm text-white/85">{d.travel_time.from_busan_station}</p>
        </div>
      </div>

      {d.trust?.travel_time && (
        <details className="text-[11px] text-white/55 leading-relaxed mb-4">
          <summary className="cursor-pointer">Route information</summary>
          <p className="mt-2">{metricEvidence(d.trust.travel_time)} Check timetables for your travel date.</p>
        </details>
      )}

      <div className="flex items-start gap-2 mb-3">
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${
            d.no_car_friendliness === 'Easy'
              ? 'bg-white/10 border-white/10 text-white/85'
              : d.no_car_friendliness === 'Hard'
              ? 'bg-white/10 border-white/30 text-white/85'
              : 'bg-white/5 border-white/10 text-white/70'
          }`}
        >
          Without a car: {d.no_car_friendliness}
        </span>
        {d.car_recommended && (
          <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/70">
            Car recommended
          </span>
        )}
      </div>

      {!hasLocalGuide && <p className="text-sm text-white/85 leading-relaxed">{d.local_movement}</p>}
      {bookingLinks.map(link => <div key={link.url} className="mt-3">
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-[#ffb495] underline underline-offset-4">
          {link.label} ↗<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <p className="text-xs text-white/65 leading-relaxed">{link.scope}</p>
      </div>)}
    </div>
  )
}
