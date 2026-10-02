'use client'

// 관계 (Next B) — the 관계일 record's own panel in the "+ 기록" sheet, shown only
// to the person who gave the separate consent (설정 › 공유 범위) while they
// still log the cycle. One tap marks or unmarks the day
// (lib/logic/intimacy.ts toggleIntimacyDay); the toggle is its own 되돌리기,
// so there is no undo toast. Nothing anywhere reads these days for a
// prediction, a card or a notice — this is a diary, not an input.

import { useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { formatKo } from '@/lib/dates'
import { intimacyDays, isIntimacyDay, toggleIntimacyDay } from '@/lib/logic/intimacy'
import { useApp } from '@/lib/store'
import type { ISODate } from '@/lib/types'
import { dayWord } from './parts'

/** Recent marked days listed under the button. */
const RECENT_MAX = 6

export default function IntimacyPanel({ date }: { date: ISODate }) {
  const { state, update, today, viewer, partner } = useApp()
  const toast = useToast()
  const on = isIntimacyDay(state, viewer, date)
  const days = intimacyDays(state, viewer)
  const recent = days.filter((d) => d <= today).slice(-RECENT_MAX).reverse()
  const when = dayWord(date, today)

  const toggle = (d: ISODate) => {
    const was = isIntimacyDay(state, viewer, d)
    update((s) => toggleIntimacyDay(s, viewer, d, today))
    toast.show(was ? `${dayWord(d, today)} 기록을 지웠어요` : `${dayWord(d, today)} 기록을 남겼어요 · 나만 볼 수 있어요`)
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        aria-pressed={on}
        onClick={() => toggle(date)}
        className={
          on
            ? 'flex min-h-[64px] w-full items-center justify-between gap-3 rounded-xl border border-brand bg-brand-soft px-4 text-left transition-colors active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
            : 'flex min-h-[64px] w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 text-left transition-colors hover:bg-surface-2 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
        }
      >
        <span className="min-w-0">
          <span className="block text-base font-bold text-ink">{on ? `${when} 관계했어요` : `${when} 관계했어요?`}</span>
          <span className="block text-[11px] leading-snug text-ink-3">{on ? '한 번 더 누르면 지워져요' : '한 번 누르면 이 날에 표시돼요'}</span>
        </span>
        {on ? <Icon name="check" className="h-6 w-6 shrink-0 text-brand-ink" strokeWidth={2.4} /> : null}
      </button>

      <p className="rounded-xl bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">나만 보는 기록이에요.</span> 이 폰에만 남고 {partner.name}님 화면·알림·내보내기 어디에도 나오지
        않아요. 앱은 이 날짜로 아무것도 예상하거나 권하지 않아요. 설정 › 공유 범위에서 한 번에 지울 수 있어요.
      </p>

      {recent.length ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink-2">최근 기록 {days.length}일</p>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {recent.map((d) => (
              <li key={d} className="flex items-center justify-between gap-2 pl-3">
                <span className="text-sm text-ink">{formatKo(d, { year: d.slice(0, 4) !== today.slice(0, 4) })}</span>
                <button
                  type="button"
                  onClick={() => toggle(d)}
                  aria-label={`${formatKo(d, { weekday: false })} 기록 지우기`}
                  className="h-11 shrink-0 rounded-lg px-3 text-xs font-semibold text-ink-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  지우기
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
