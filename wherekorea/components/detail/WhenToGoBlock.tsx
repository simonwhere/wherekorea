import type { Destination } from '@/data/types'
import TimingStrip from '@/components/shared/TimingStrip'
import { CROWD_MONTHLY } from '@/data/crowd-monthly'
import { SIGNATURE_EVENTS } from '@/data/signature-events'
import { festivalDateLabel, koreaDateKey } from '@/lib/live/festival-dates'
import FestivalMap from '@/components/whentogo/FestivalMap'
import { signatureTimingLabel } from '@/components/whentogo/timing-model'
import SectionTitle from '@/components/detail/SectionTitle'
import { CROWD_SAMPLE_NOTE } from '@/lib/trust'
import { crowdIndex, MONTH_SHORT } from '@/lib/crowd'

interface Props {
  destination: Destination
  currentMonth: number
  showLive?: boolean
}

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

export default function WhenToGoBlock({ destination: d, currentMonth, showLive = false }: Props) {
  const crowd = CROWD_MONTHLY[d.slug]
  const today = koreaDateKey()
  const selectedCrowd = crowdIndex(d.slug, currentMonth)
  const maxRatio = crowd ? Math.max(...crowd) : 0
  const signature = SIGNATURE_EVENTS
    .filter((e) => e.city === d.slug)
    .sort((a, b) => Math.min(...a.months) - Math.min(...b.months))

  return (
    <div className="py-6 border-b border-white/10">
      <SectionTitle className="mb-3">When to go · {MONTH_SHORT[currentMonth - 1]} selected</SectionTitle>

      <TimingStrip destination={d} currentMonth={currentMonth} />
      <p className="text-xs text-white/70 leading-relaxed mt-3">
        Recommended months: {d.best_months.map((month) => MONTH_SHORT[month - 1]).join(', ') || 'not recorded'}.
        {' '}Usually busier: {d.crowd_peak_months.map((month) => MONTH_SHORT[month - 1]).join(', ') || 'no marked months'}.
      </p>
      <p className="text-[11px] text-white/55 mt-2 mb-4">
        <span className="text-green-300/90">■</span> best months&ensp;
        <span className="text-yellow-300/70">■</span> shoulder&ensp;
        <span className="text-white/30">■</span> off-season&ensp;
        <span className="text-red-400">•</span> usual peak period · not live crowd data
      </p>

      {crowd && (
        <div>
          <p className="text-xs text-white/60 mb-2">
            Past visitor levels · 1.0 = this place&apos;s average.
          </p>
          {selectedCrowd !== null && <p className="text-xs text-white/80 mb-3">{MONTH_SHORT[currentMonth - 1]}: {selectedCrowd.toFixed(1)}× average in the sample.</p>}
          <div role="img" aria-label={`Historical visitor sample index: ${crowd.map((ratio, index) => `${MONTH_SHORT[index]} ${ratio.toFixed(1)} times its own sampled average`).join('; ')}`} className="flex items-end gap-[3px] h-14 mb-3">
            {crowd.map((r, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  title={`${MONTH_SHORT[i]}: ${r.toFixed(1)}×`}
                  style={{
                    width: '100%',
                    height: `${Math.max(6, (r / maxRatio) * 44)}px`,
                    borderRadius: 3,
                    background: d.crowd_peak_months.includes(i + 1)
                      ? 'rgba(248,113,113,0.75)'
                      : currentMonth === i + 1
                        ? 'rgba(255,255,255,0.75)'
                        : 'rgba(255,255,255,0.22)',
                  }}
                />
                <span className={`text-[8.5px] font-semibold ${currentMonth === i + 1 ? 'text-white/90' : 'text-white/50'}`}>
                  {MONTH_LABELS[i]}
                </span>
              </div>
            ))}
          </div>
          <details className="text-[11px] text-white/55 leading-relaxed mb-3">
            <summary className="cursor-pointer">About the visitor data</summary>
            <p className="mt-2">{CROWD_SAMPLE_NOTE}</p>
          </details>
        </div>
      )}

      {d.crowd_notes && (
        <p className="text-sm text-white/85 leading-relaxed mt-1">{d.crowd_notes}</p>
      )}

      {/* Published event dates and typical seasons share this list. */}
      {signature.length > 0 && (
        <div id="festivals" className="mt-5 scroll-mt-24">
          <p className="text-xs font-bold text-white/75 uppercase tracking-wide mb-2">
            Festivals &amp; seasons
          </p>
          <p className="text-xs text-white/65 leading-relaxed mb-3">
            Published dates include the year. Other listings show their usual season.
          </p>
          <ul className="space-y-1.5">
            {signature.map((e) => (
              <li key={e.name} id={e.official?.anchor}
                className="scroll-mt-24 text-[13px] px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
                <span className="flex-1 min-w-0">
                  <span className="block text-white/90 leading-relaxed">
                    {e.name}
                    {!e.official && e.months.includes(currentMonth) && (
                      <span className="ml-2 text-[10px] font-semibold" style={{ color: '#ff936b' }}>typically in {MONTH_SHORT[currentMonth - 1]}</span>
                    )}
                  </span>
                  {e.official && <span className="block text-xs text-white/65 mt-0.5" lang="ko">{e.official.korean}</span>}
                  <span className={e.official ? 'block text-xs font-semibold text-[#ffc4aa] mt-1.5' : 'block text-[11px] text-white/65 mt-1'}>{signatureTimingLabel(e, today)}</span>
                </span>
                {e.official && (
                  <div className="text-[13px] leading-relaxed text-white/85">
                    <p className="mt-2">{e.note}</p>
                    {e.official.visitorDetails && (
                      <dl className="mt-3 space-y-2">
                        {e.official.visitorDetails.map(detail => <div key={detail.label}>
                          <dt className="font-semibold text-white">{detail.label}</dt>
                          <dd>{detail.text}</dd>
                        </div>)}
                      </dl>
                    )}
                    {e.official.maps && <FestivalMap points={e.official.maps} />}
                    {e.official.schedule.kind === 'dated' && today > e.official.schedule.end && <p className="mt-2 text-xs text-white/70">The next edition’s dates are pending.</p>}
                    <div className="mt-2 flex flex-wrap gap-x-3 items-center text-xs">
                      <a href={e.official.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-[#ffb495] hover:underline">{e.official.source.label} ↗</a>
                      {e.official.visitorInfo && <a href={e.official.visitorInfo.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-[#ffb495] hover:underline">{e.official.visitorInfo.label} ↗</a>}
                      <span className="text-white/55">Checked {festivalDateLabel(e.official.source.checked)}</span>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Same-day feed entries are separate from the seasonal guide. */}
      {showLive && d.live_festivals_upcoming && d.live_festivals_upcoming.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold text-white/75 uppercase tracking-wide mb-2">
            Upcoming festivals
          </p>
          <p className="text-xs text-white/65 leading-relaxed mb-3">
            Check dates and entry requirements with the organizer before travel.
          </p>
          <ul className="space-y-1.5">
            {d.live_festivals_upcoming.map((f) => (
              <li key={f.name}
                className="text-[13px] text-white/90 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
                <p className="flex items-start gap-2 leading-relaxed"><span aria-hidden>🎪</span><span className="min-w-0 break-words">{f.name}</span></p>
                <p className="mt-1.5 text-xs text-white/65 leading-relaxed">{f.range}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
