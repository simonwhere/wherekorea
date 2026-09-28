'use client'

import { useEffect, useState } from 'react'
import type { TabKey } from '@/components/AppShell'
import { formatKo } from '@/lib/dates'
import { greetingFor } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import { togetherDays } from './model'

export default function Greeting({
  onNavigate,
  showTogether = true,
}: {
  onNavigate: (tab: TabKey) => void
  /** The "함께한 지 D+N" pill (off on the preparing home — it lives in 우리). */
  showTogether?: boolean
}) {
  const { state, today, me } = useApp()
  // The clock hour only picks the greeting; date logic always uses `today`.
  const [hour, setHour] = useState(() => new Date().getHours())
  useEffect(() => {
    const t = window.setInterval(() => setHour(new Date().getHours()), 5 * 60_000)
    return () => window.clearInterval(t)
  }, [])
  const together = showTogether ? togetherDays(state.couple, today) : null

  return (
    <div className="px-1 pb-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-3">{formatKo(today, { year: true })}</p>
        {together !== null ? (
          // 28px pill; the ::before strip makes the tap target 44px tall.
          <button
            type="button"
            onClick={() => onNavigate('diary')}
            className="relative -my-1 inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2.5 text-[11px] font-semibold text-brand-ink transition-colors before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] hover:bg-brand/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span aria-hidden>💞</span>
            함께한 지 <span className="tabular-nums">D+{together.toLocaleString('ko-KR')}</span>
            <span className="sr-only"> · 우리 탭 열기</span>
          </button>
        ) : null}
      </div>
      <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-ink outline-none">
        {me.name}님, {greetingFor(hour)}
      </h1>
    </div>
  )
}
