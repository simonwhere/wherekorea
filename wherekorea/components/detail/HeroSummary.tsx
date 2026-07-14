import type { Destination } from '@/data/types'
import Link from 'next/link'
import { KOREAN_NAMES, REGIONS, DAILY_AVG } from '@/data/destinations-meta'
import { usdApprox } from '@/lib/currency'
import { bestNowReason } from '@/lib/best-now'
import { isPeakNow } from '@/lib/crowd'
import KoreaMiniMap from '@/components/shared/KoreaMiniMap'
import DetailActions from '@/components/detail/DetailActions'

interface Props {
  destination: Destination
  currentMonth: number
}

function Metric({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-lg font-extrabold text-white tracking-tight leading-tight truncate">{value}</p>
      <p className="text-[10px] font-semibold text-white/55 uppercase tracking-wider">
        {label}{sub ? ` · ${sub}` : ''}
      </p>
    </div>
  )
}

export default function HeroSummary({ destination: d, currentMonth }: Props) {
  const koreanName = KOREAN_NAMES[d.slug]
  const region = REGIONS[d.slug]
  const perDay = DAILY_AVG[d.slug] ?? d.card_budget_level
  const usd = usdApprox(perDay)
  const nowVal = d.live_weather_current
    ? `${d.live_weather_icon ? d.live_weather_icon + ' ' : ''}${d.live_weather_current}°`
    : (d.live_weather_snapshot.split('·')[1]?.trim() ?? '—').replace('°C', '°')
  const reason = bestNowReason(d, currentMonth)
  const peak = isPeakNow(d, currentMonth)
  const fromSeoul = d.travel_time.from_seoul.replace(/^~/, '')

  return (
    <div className="pb-6 border-b border-white/10">
      {/* Hero image band */}
      <div className="relative -mx-4 sm:mx-0 sm:rounded-xl overflow-hidden mb-5" style={{ aspectRatio: '21/9' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={d.image.src}
          alt={d.image.alt}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(22,24,31,0.92) 0%, rgba(22,24,31,0.25) 55%, rgba(22,24,31,0.35) 100%)' }}
        />
        <Link
          href="/"
          className="absolute top-3 left-4 text-xs text-white/80 hover:text-white bg-black/40 backdrop-blur px-2.5 py-1 rounded-md"
        >
          ← All destinations
        </Link>
        <div className="absolute top-3 right-3 p-1.5 bg-black/40 backdrop-blur rounded-lg leading-none">
          <KoreaMiniMap slug={d.slug} size={34} />
        </div>
        <div className="absolute left-4 right-4 bottom-3">
          <p className="text-[11px] font-semibold text-white/70 uppercase tracking-widest mb-1">
            {koreanName} · {region}
          </p>
          <div className="flex items-end justify-between gap-4">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-none">
              {d.name}
            </h1>
            <div className="flex flex-wrap gap-1.5 justify-end">
              <span className="text-[11px] font-semibold px-2 py-1 rounded-md"
                style={{ background: 'rgba(255,106,61,0.18)', border: '1px solid rgba(255,106,61,0.4)', color: '#FFB49C' }}>
                {reason}
              </span>
              {peak && (
                <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-black/45 border border-white/20 text-white/85">
                  peak season now
                </span>
              )}
            </div>
          </div>
        </div>
        {d.image.credit && (
          <p className="absolute bottom-0.5 right-2 text-[9px] text-white/45">{d.image.credit}</p>
        )}
      </div>

      <p className="text-base text-white/70 leading-relaxed mb-5">{d.hero_summary}</p>

      {/* Metric strip — same hierarchy as the preview panel */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-white/10 mb-4">
        <Metric value={d.recommended_stay} label="Stay" />
        <Metric value={nowVal} label="Now" />
        <Metric value={usd ?? perDay} label="Per day" sub={usd ? perDay : undefined} />
        <Metric value={fromSeoul || '—'} label="From Seoul" />
      </div>

      {/* Happening now — live festival signal (info only) */}
      {d.live_festivals && d.live_festivals.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {d.live_festivals.map((f) => (
            <div key={f.name}
              className="flex items-center gap-2 text-[13px] text-white/90 px-2.5 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,106,61,0.10)', border: '1px solid rgba(255,106,61,0.25)' }}>
              <span aria-hidden>🎪</span>
              <span className="truncate">{f.name}</span>
              <span className="ml-auto shrink-0 text-xs text-white/55">until {f.ends}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {d.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 text-xs bg-white/10 text-white/70 rounded-full">
              {tag}
            </span>
          ))}
          <span className="px-2 py-0.5 text-xs bg-white/10 text-white/70 rounded-full">
            No-car: {d.no_car_friendliness}
          </span>
        </div>
        <DetailActions slug={d.slug} name={d.name} />
      </div>
    </div>
  )
}
