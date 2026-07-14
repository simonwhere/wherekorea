'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SIGNATURE_EVENTS } from '@/data/signature-events'
import { KOREAN_NAMES } from '@/data/destinations-meta'
import TicketingBadge from '@/components/shared/TicketingBadge'

// Signature annual events explorer — month-first (defaults to the current month,
// because travelers land asking "what's on around my dates"), city as a secondary
// narrowing chip. Rows link to the destination — events are reasons to pick a city,
// not a directory (docs/planning-neighborhoods-events.md).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function cityLabel(slug: string): string {
  return slug === 'damyang-boseong'
    ? 'Damyang & Boseong'
    : slug.charAt(0).toUpperCase() + slug.slice(1)
}

interface Props {
  currentMonth: number // 1–12
}

export default function SignatureEventsExplorer({ currentMonth }: Props) {
  // Default to the current month — but if it has no events, open on All months
  // (an empty first screen is worse than a full one).
  const hasCurrent = SIGNATURE_EVENTS.some((e) => e.months.includes(currentMonth))
  const [month, setMonth] = useState<number>(hasCurrent ? currentMonth : 0) // 0 = all
  const [city, setCity] = useState<string>('all')

  const cities = [...new Set(SIGNATURE_EVENTS.map((e) => e.city))]

  const list = SIGNATURE_EVENTS.filter(
    (e) =>
      (month === 0 || e.months.includes(month)) &&
      (city === 'all' || e.city === city)
  ).sort((a, b) => Math.min(...a.months) - Math.min(...b.months))

  const chip = (active: boolean): React.CSSProperties => ({
    fontSize: 11.5, fontWeight: active ? 600 : 500,
    padding: '3px 11px', borderRadius: 7, cursor: 'pointer',
    transition: 'all 120ms', whiteSpace: 'nowrap',
    background: active ? '#fff' : 'transparent',
    color: active ? '#16181f' : 'rgba(255,255,255,0.60)',
    border: active ? '1px solid #fff' : '1px solid rgba(255,255,255,0.18)',
  })

  return (
    <div className="mt-12 lg:mt-0">
      <h2 className="text-sm font-semibold text-white/55 uppercase tracking-wide mb-1">
        Signature events
      </h2>
      <p className="text-sm text-white/60 mb-4">
        The annual highlights worth planning around — pick your month.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <button style={chip(month === 0)} onClick={() => setMonth(0)}>All months</button>
        {MONTHS.map((m, i) => (
          <button key={m} style={chip(month === i + 1)} onClick={() => setMonth(i + 1)}>
            {m}{i + 1 === currentMonth ? ' · now' : ''}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-5">
        <button style={chip(city === 'all')} onClick={() => setCity('all')}>All places</button>
        {cities.map((c) => (
          <button key={c} style={chip(city === c)} onClick={() => setCity(c)}>
            {cityLabel(c)}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-white/40 py-6">
          No signature events for this pick — check the timing strips above for seasons instead.
        </p>
      ) : (
        <div>
          {list.map((e, i) => (
            <Link
              key={`${e.city}-${e.name}`}
              href={`/destination/${e.city}`}
              className={`flex items-center gap-3 py-2.5 px-1 group ${i < list.length - 1 ? 'border-b border-white/10' : ''}`}
            >
              <span className="w-24 sm:w-32 shrink-0 text-[12.5px] font-semibold text-white group-hover:underline">
                {cityLabel(e.city)}
                <span className="hidden sm:inline text-white/45 font-normal"> {KOREAN_NAMES[e.city]}</span>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] text-white/90 truncate">{e.name}</span>
                <span className="block text-[11px] text-white/50 truncate">{e.note}</span>
              </span>
              <span className="shrink-0 text-[11px] text-white/60 whitespace-nowrap">{e.when}</span>
              <TicketingBadge ticketing={e.ticketing} />
            </Link>
          ))}
        </div>
      )}
      <p className="text-[11px] text-white/45 mt-3">
        Timing shown as typical windows — exact dates shift yearly. Uncertain events are left out rather than guessed.
      </p>
    </div>
  )
}
