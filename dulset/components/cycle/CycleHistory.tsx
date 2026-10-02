'use client'

import { useEffect, useState } from 'react'
import { Card, SectionTitle, cx } from '@/components/ui'
import { diffDays, formatKo } from '@/lib/dates'
import { lhRowLine, type CycleHistory as History, type CycleHistoryRow } from '@/lib/logic/calendarView'
import type { PersonalDayEntry } from '@/lib/logic/personalLog'
import { feelLabel } from '@/lib/logic/ttcFlow'
import type { ISODate } from '@/lib/types'

const COLLAPSED_COUNT = 6

/** sessionStorage key: the home's '지난 주기 컨디션 N개 · 보기' asks the 주기 tab to open that row's list once. */
const OPEN_FEELS_KEY = 'dulset:open-feels'

/** Remember which cycle's feel list to open on the next visit to 주기 (this phone, this session). */
export function requestOpenFeels(cycleStart: ISODate): void {
  try {
    window.sessionStorage.setItem(OPEN_FEELS_KEY, cycleStart)
  } catch {
    /* private mode / blocked storage: the list stays collapsed, nothing else changes */
  }
}

/** Read (and clear) that request. */
export function takeOpenFeels(): ISODate | undefined {
  try {
    const v = window.sessionStorage.getItem(OPEN_FEELS_KEY) ?? undefined
    if (v) window.sessionStorage.removeItem(OPEN_FEELS_KEY)
    return v
  } catch {
    return undefined
  }
}

/**
 * Logged cycles, newest first: length, first LH surge (or strips without one),
 * her own feel chips — and, only when the couple turned it on
 * (settings.showTryCount, Next B), a neutral '주기 N' count since they started.
 */
export default function CycleHistory({
  history,
  today,
  showLH,
  showTryCount = false,
  feels,
  openFeels,
  onSelect,
}: {
  history: History
  today: ISODate
  /** Whether this viewer may see LH results. */
  showLH: boolean
  /** '주기 N' since the couple started trying — off by default (lib/logic/settings.ts showTryCountOn); never '시도'. */
  showTryCount?: boolean
  /** Owner only: her 오늘 컨디션 chips per cycle start (calendarView.cycleFeels). Never passed for the partner. */
  feels?: Record<ISODate, PersonalDayEntry[]>
  /** The cycle whose feel list starts open (from the home's '지난 주기 컨디션 N개 · 보기'). */
  openFeels?: ISODate
  /** Owner only: open the period log for that start. */
  onSelect?: (date: ISODate) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const { rows, current, estimated, maxCycle } = history
  if (rows.length === 0) return null
  const visible = showAll ? rows : rows.slice(0, COLLAPSED_COUNT)
  const thisYear = today.slice(0, 4)

  return (
    <>
      <SectionTitle
        sub={
          showTryCount && current !== undefined
            ? `함께 준비한 뒤 ${estimated ? '약 ' : ''}${current}번째 주기예요${estimated ? ' (기록이 빈 기간은 어림했어요)' : ''}`
            : onSelect
              ? '눌러서 고치거나 지울 수 있어요'
              : undefined
        }
      >
        주기 기록
      </SectionTitle>
      <Card className="px-0 py-1">
        <ul className="divide-y divide-line">
          {visible.map((r) => (
            <li key={r.start}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(r.start)}
                  className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                >
                  <Row r={r} today={today} withYear={r.start.slice(0, 4) !== thisYear} showLH={showLH} showTryCount={showTryCount} maxCycle={maxCycle} />
                </button>
              ) : (
                <div className="flex min-h-[60px] items-center gap-3 px-4 py-2">
                  <Row r={r} today={today} withYear={r.start.slice(0, 4) !== thisYear} showLH={showLH} showTryCount={showTryCount} maxCycle={maxCycle} />
                </div>
              )}
              {feels?.[r.start]?.length ? <FeelList entries={feels[r.start]!} open={openFeels === r.start} /> : null}
            </li>
          ))}
        </ul>
        {rows.length > COLLAPSED_COUNT ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="flex h-11 w-full items-center justify-center border-t border-line text-xs font-semibold text-ink-2 hover:bg-surface-2"
            aria-expanded={showAll}
          >
            {showAll ? '접기' : `모두 보기 (${rows.length})`}
          </button>
        ) : null}
      </Card>
      {rows.some((r) => r.hint === 'gap') ? (
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-ink-3">
          ‘기록 누락?’은 두 기록 사이가 {maxCycle}일을 넘고 평균 주기의 두 배보다 길 때 표시돼요. {maxCycle}일을 넘는 간격은 평균 주기
          계산에서 빠져요.
        </p>
      ) : null}
    </>
  )
}

function Row({
  r,
  today,
  withYear,
  showLH,
  showTryCount,
  maxCycle,
}: {
  r: CycleHistoryRow
  today: ISODate
  withYear: boolean
  showLH: boolean
  showTryCount: boolean
  /** The longest plausible cycle for these settings (cycleHistory.maxCycle). */
  maxCycle: number
}) {
  const details = [r.bleedDays ? `${r.bleedDays}일간` : '마지막 날 미기록']
  // The first surge, or 'LH N회 · 양성 없음' for a finished cycle that tested without one (N11).
  const lh = showLH ? lhRowLine(r) : undefined
  if (lh) details.push(lh)
  return (
    <>
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-period" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-1.5 text-sm font-semibold text-ink">
          {formatKo(r.start, { year: withYear })}
          {r.end ? <span className="font-medium text-ink-2">~ {formatKo(r.end, { weekday: false })}</span> : null}
        </span>
        <span className="block text-xs text-ink-3">
          {showTryCount && r.attempt !== undefined ? <span className="font-semibold text-ink-2">주기 {r.attempt} · </span> : null}
          {details.join(' · ')}
        </span>
      </span>
      <span className="shrink-0 text-right">
        {r.cycleLength !== undefined ? (
          <span className="block text-sm font-bold tabular-nums text-ink">{r.cycleLength}일 주기</span>
        ) : r.start <= today && diffDays(r.start, today) < maxCycle ? (
          <span className="block text-xs font-semibold text-brand-ink">이번 주기 · {diffDays(r.start, today) + 1}일째</span>
        ) : r.start <= today ? (
          <span className="block text-xs text-ink-3">이후 기록 없음</span>
        ) : null}
        {r.hint ? (
          <span className={cx('mt-0.5 inline-block rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn')}>
            {r.hint === 'gap' ? '기록 누락?' : '간격이 짧아요 · 중복?'}
          </span>
        ) : null}
      </span>
    </>
  )
}

/**
 * Her own days of one cycle — feel chips and 나만 보기 lines — as a tiny list
 * under the row: a look back, nothing more (no reading of what they "mean").
 * Collapsed by default; the home's link opens it once.
 */
function FeelList({ entries, open }: { entries: PersonalDayEntry[]; open: boolean }) {
  const [shown, setShown] = useState(open)
  // The request from the home arrives after the first render (sessionStorage is read in an effect).
  useEffect(() => {
    if (open) setShown(true)
  }, [open])
  const feels = entries.filter((e) => e.feel).length
  const notes = entries.filter((e) => e.note).length
  const head = [feels ? `컨디션 ${feels}개` : '', notes ? `메모 ${notes}개` : ''].filter(Boolean).join(' · ')
  return (
    <div className="px-4 pb-1">
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-expanded={shown}
        className="-ml-1 inline-flex min-h-[44px] items-center gap-1 px-1 text-xs font-semibold text-brand-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        {head} · 나만 보기
        <span aria-hidden className={cx('transition-transform', shown && 'rotate-180')}>
          ⌄
        </span>
      </button>
      {shown ? (
        <ul className="mb-2 space-y-1.5 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
          {entries.map((e) => (
            <li key={e.date} className="flex items-start justify-between gap-3">
              <span className="shrink-0 tabular-nums text-ink-3">{formatKo(e.date, { weekday: false })}</span>
              <span className="min-w-0 text-right">
                {e.feel ? <span className="block font-semibold text-ink">{feelLabel(e.feel)}</span> : null}
                {e.note ? <span className="block leading-relaxed text-ink-2">{e.note}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
