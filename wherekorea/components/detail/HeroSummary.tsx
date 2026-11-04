import type { Destination } from '@/data/types'
import Link from 'next/link'
import { KOREAN_NAMES, REGIONS, DAILY_AVG } from '@/data/destinations-meta'
import { usdApprox } from '@/lib/currency'
import { isPeakNow, MONTH_SHORT } from '@/lib/crowd'
import type { BrowseState } from '@/lib/browse-state'
import { withBrowseContext } from '@/lib/browse-state'
import { arrivalPath, hasArrivalCard } from '@/lib/arrival-routes'
import { rankDestinations } from '@/lib/recommendation'
import { BUDGET_ASSUMPTIONS, TRAVEL_SCOPE } from '@/lib/trust'
import KoreaMiniMap from '@/components/shared/KoreaMiniMap'
import DetailActions from '@/components/detail/DetailActions'
import PhotoCredit from '@/components/shared/PhotoCredit'
import { getDestinationGuide } from '@/data/destination-guides'
import DestinationPhotoGallery from './DestinationPhotoGallery'

interface Props {
  destination: Destination
  currentMonth: number
  browse: BrowseState
  showLive: boolean
  backHref: string
  sharePath: string
}

function Metric({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-base font-bold text-white tracking-tight leading-snug">{value}</p>
      <p className="text-[10px] font-semibold text-white/55 uppercase tracking-wider">
        {label}{sub ? ` · ${sub}` : ''}
      </p>
    </div>
  )
}

export default function HeroSummary({ destination: d, currentMonth, browse, showLive, backHref, sharePath }: Props) {
  const koreanName = KOREAN_NAMES[d.slug]
  const region = REGIONS[d.slug]
  const perDay = DAILY_AVG[d.slug] ?? d.card_budget_level
  const usd = usdApprox(perDay)
  const hasLiveWeather = d.live_weather_is_live === true
  const nowVal = hasLiveWeather && d.live_weather_current !== undefined
    ? `${d.live_weather_icon ? d.live_weather_icon + ' ' : ''}${d.live_weather_current}°`
    : '—'
  const matchesConditions = rankDestinations([d], browse).length > 0
  const peak = isPeakNow(d, currentMonth)
  const fromSeoul = d.travel_time.from_seoul.replace(/^~/, '')
  const guide = getDestinationGuide(d.slug)

  return (
    <div className="pb-6 border-b border-white/10">
      {guide ? <>
        <Link href={backHref} className="inline-flex min-h-11 items-center text-xs text-white/80 hover:text-white">← Back to your results</Link>
        <div className="flex items-center justify-between gap-4 mt-2">
          <div><p className="text-xs text-white/65 mb-2">{koreanName} · {region}</p><h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{d.name}</h1></div>
          <KoreaMiniMap slug={d.slug} size={46} />
        </div>
        <p className="mt-3 text-xs font-semibold text-[#ffb495]">{showLive ? 'Right now' : `Planning · ${MONTH_SHORT[currentMonth - 1]}`}{peak ? ` · Peak month` : ''}</p>
        {hasArrivalCard(d.slug) && <Link className="wk-arrival-entry" href={withBrowseContext(arrivalPath(d.slug), backHref.split('?')[1] ?? '')}>From Seoul · {d.name} arrival card →</Link>}
        <DestinationPhotoGallery key={d.slug} photos={guide.photos} name={d.name} />
      </> : <>
      <div className="relative -mx-4 sm:mx-0 sm:rounded-xl overflow-hidden mb-5" style={{ aspectRatio: '21/9' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={d.image.src}
          alt={d.image.alt}
          className="absolute inset-0 w-full h-full object-cover"
          style={d.slug === 'jeonju' ? { objectPosition: '50% 80%' } : undefined}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(22,24,31,0.92) 0%, rgba(22,24,31,0.25) 55%, rgba(22,24,31,0.35) 100%)' }}
        />
        <Link
          href={backHref}
          className="absolute top-3 left-4 text-xs text-white/80 hover:text-white bg-black/40 backdrop-blur px-2.5 py-1 rounded-md"
        >
          ← Back to your results
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
                {showLive ? 'Right now' : `Planning · ${MONTH_SHORT[currentMonth - 1]}`}
              </span>
              {peak && (
                <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-black/45 border border-white/20 text-white/85">
                  peak month · {MONTH_SHORT[currentMonth - 1]}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <PhotoCredit image={d.image} className="wk-hero-credit" />
      </>}

      <p className="text-base text-white/70 leading-relaxed mb-5">{d.hero_summary}</p>

      {/* Metric strip — same hierarchy as the preview panel */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-white/10 mb-4">
        <Metric value={d.recommended_stay} label="Recommended stay" />
        <Metric value={showLive ? nowVal : d.no_car_friendliness} label={showLive ? (hasLiveWeather ? 'Now' : 'Weather unavailable') : 'Without a car'} />
        <Metric value={usd ?? perDay} label="Est. per person/day" sub={usd ? perDay : undefined} />
        {d.slug === 'seoul' ? (
          <Metric value={d.travel_time.from_incheon_airport.replace(/^~/, '')} label="Main route · Incheon" />
        ) : (
          <Metric value={fromSeoul || '—'} label="Main route · Seoul" />
        )}
      </div>
      <details className="text-xs text-white/65 leading-relaxed mb-5">
        <summary className="cursor-pointer">About these estimates</summary>
        <p className="mt-2">{BUDGET_ASSUMPTIONS}</p>
        <p className="mt-2">{TRAVEL_SCOPE}</p>
      </details>
      {!matchesConditions && <p className="text-xs text-amber-200 leading-relaxed mb-5">Outside your current filters. Return to your results to see matching places.</p>}

      {/* Happening now — live festival signal (info only) */}
      {showLive && d.live_festivals && d.live_festivals.length > 0 && (
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
        <DetailActions slug={d.slug} name={d.name} sharePath={sharePath} />
      </div>
    </div>
  )
}
