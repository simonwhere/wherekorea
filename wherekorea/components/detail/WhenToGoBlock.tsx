import type { Destination } from '@/data/types'
import TimingStrip from '@/components/shared/TimingStrip'
import { CROWD_MONTHLY } from '@/data/crowd-monthly'
import { SIGNATURE_EVENTS } from '@/data/signature-events'
import TicketingBadge from '@/components/shared/TicketingBadge'
import SectionTitle from '@/components/detail/SectionTitle'

interface Props {
  destination: Destination
  currentMonth: number
}

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

export default function WhenToGoBlock({ destination: d, currentMonth }: Props) {
  const crowd = CROWD_MONTHLY[d.slug]
  const maxRatio = crowd ? Math.max(...crowd) : 0
  const signature = SIGNATURE_EVENTS
    .filter((e) => e.city === d.slug)
    .sort((a, b) => Math.min(...a.months) - Math.min(...b.months))

  return (
    <div className="py-6 border-b border-white/10">
      <SectionTitle className="mb-3">When to go</SectionTitle>

      <TimingStrip destination={d} currentMonth={currentMonth} />
      <p className="text-[11px] text-white/55 mt-2 mb-4">
        <span className="text-green-300/90">■</span> best months&ensp;
        <span className="text-yellow-300/70">■</span> shoulder&ensp;
        <span className="text-white/30">■</span> off-season&ensp;
        <span className="text-red-400">•</span> peak crowds
      </p>

      {crowd && (
        <div>
          <p className="text-xs text-white/60 mb-2">
            Visitor volume by month — 1.0 is this destination&apos;s yearly average
            <span className="text-white/50"> (mobile-network visitor data, non-local + foreign
            {d.trust?.crowd ? ` · verified ${d.trust.crowd.last_verified}` : ''})</span>
          </p>
          <div className="flex items-end gap-[3px] h-14 mb-3">
            {crowd.map((r, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  title={`${MONTH_LABELS[i]}: ${r.toFixed(2)}×`}
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
        </div>
      )}

      {d.crowd_notes && (
        <p className="text-sm text-white/85 leading-relaxed mt-1">{d.crowd_notes}</p>
      )}

      {/* Annual highlights — signature events, editorial seed (yearly refresh) */}
      {signature.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold text-white/75 uppercase tracking-wide mb-2">
            Annual highlights
          </p>
          <ul className="space-y-1.5">
            {signature.map((e) => (
              <li key={e.name}
                className="flex items-center gap-2.5 text-[13px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <span className="flex-1 min-w-0">
                  <span className="block text-white/90 truncate">
                    {e.name}
                    {e.months.includes(currentMonth) && (
                      <span className="ml-2 text-[10px] font-semibold" style={{ color: '#FF8E6B' }}>on this month</span>
                    )}
                  </span>
                  <span className="block text-[11px] text-white/50 truncate">{e.note}</span>
                </span>
                <span className="shrink-0 text-[11px] text-white/60 whitespace-nowrap">{e.when}</span>
                <TicketingBadge ticketing={e.ticketing} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Festivals ahead — month-based planning signal (live, info only) */}
      {d.live_festivals_upcoming && d.live_festivals_upcoming.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold text-white/75 uppercase tracking-wide mb-2">
            Festivals ahead
          </p>
          <ul className="space-y-1.5">
            {d.live_festivals_upcoming.map((f) => (
              <li key={f.name}
                className="flex items-center gap-2 text-[13px] text-white/90 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <span aria-hidden>🎪</span>
                <span className="truncate">{f.name}</span>
                <span className="ml-auto shrink-0 text-xs text-white/55">{f.range}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
