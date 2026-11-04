'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { BrowseState } from '@/lib/browse-state'
import { track } from '@/lib/analytics'
import { TIMING_MONTHS, timingMonthHref } from '@/components/whentogo/timing-model'

export default function TravelMonthSelect({ browse, contextHref }: { browse: BrowseState; contextHref: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/20 bg-white/5 p-4 my-5">
      <label htmlFor="timing-travel-month" className="text-sm font-semibold text-white">Travel month</label>
      <select id="timing-travel-month" value={browse.month} disabled={pending}
        aria-describedby="timing-month-help"
        className="min-h-11 rounded-lg border border-white/30 bg-[#202a36] px-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff936b] disabled:opacity-60"
        onChange={(event) => {
          const month = Number(event.target.value)
          track('month_selected', { month, is_now: false })
          startTransition(() => router.replace(timingMonthHref(browse, month, contextHref), { scroll: false }))
        }}>
        {TIMING_MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
      </select>
      <p id="timing-month-help" className="text-xs text-white/70">Seasonal guidance, not a dated forecast. Your other conditions stay selected.</p>
      <span role="status" className="sr-only">{pending ? 'Updating selected month' : `${TIMING_MONTHS[browse.month - 1]} selected`}</span>
    </div>
  )
}
