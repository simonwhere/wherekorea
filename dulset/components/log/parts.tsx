'use client'

// Small building blocks of the "+ 기록" sheet.

import { cx } from '@/components/ui'
import { addDays, formatKo, isISODate } from '@/lib/dates'
import type { LogKind, LogTarget } from '@/lib/logic/logs'
import type { AppState, ISODate } from '@/lib/types'

/**
 * Save one change from the sheet: applies it, offers 되돌리기 for a few
 * seconds and closes the sheet unless `keepOpen`.
 */
export type SaveLog = (
  change: (s: AppState) => AppState,
  target: LogTarget,
  message: string,
  opts?: { keepOpen?: boolean },
) => void

export const KIND_LABEL: Record<LogKind, string> = { period: '생리', lh: 'LH', ptest: '임테기', note: '메모' }

/** '(으)로' after a Korean word: 음성으로 · 희미로 · 가장 진함으로. */
export function ro(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return `${word}로`
  const final = code % 28
  return final === 0 || final === 8 ? `${word}로` : `${word}으로`
}

/** 'HH:MM' of a Date (the device clock). */
export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

/** ‹ date › with a small picker. Never goes past today. */
export function DateStepper({
  date,
  today,
  onChange,
  line,
}: {
  date: ISODate
  today: ISODate
  onChange: (date: ISODate) => void
  /** e.g. "주기 12일째 · 가임기 예상" */
  line?: string
}) {
  const otherYear = date.slice(0, 4) !== today.slice(0, 4)
  return (
    <div className="rounded-xl2 bg-surface px-1 py-2 shadow-card">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(addDays(date, -1))}
          aria-label="전날"
          className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-ink-2 hover:bg-surface-2', FOCUS)}
        >
          ‹
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="flex items-center justify-center gap-1.5 text-base font-bold text-ink" aria-live="polite">
            {formatKo(date, { year: otherYear })}
            {date === today ? (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-ink">오늘</span>
            ) : null}
          </p>
          {line ? <p className="mt-0.5 truncate text-xs text-ink-3">{line}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => onChange(addDays(date, 1))}
          disabled={date >= today}
          aria-label="다음 날"
          className={cx(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-ink-2 hover:bg-surface-2 disabled:opacity-30',
            FOCUS,
          )}
        >
          ›
        </button>
      </div>
      <label className="mt-1 flex items-center justify-center gap-2 text-xs text-ink-3">
        다른 날
        <input
          type="date"
          max={today}
          value={date}
          onChange={(e) => {
            const v = e.target.value
            if (isISODate(v) && v <= today) onChange(v)
          }}
          className="h-11 rounded-lg border border-control bg-surface px-2 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </label>
    </div>
  )
}

export function KindChips({ kinds, value, onChange }: { kinds: LogKind[]; value: LogKind; onChange: (k: LogKind) => void }) {
  return (
    <div
      role="group"
      aria-label="기록 종류"
      className="grid gap-1 rounded-xl bg-surface-2 p-1"
      style={{ gridTemplateColumns: `repeat(${kinds.length}, minmax(0, 1fr))` }}
    >
      {kinds.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          aria-pressed={value === k}
          className={cx(
            'h-11 rounded-lg text-sm font-semibold transition-colors',
            FOCUS,
            value === k ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:bg-surface/60',
          )}
        >
          {KIND_LABEL[k]}
        </button>
      ))}
    </div>
  )
}

/** How dark the test line (T) looks next to the control line (C). */
export type LineLevel = 'none' | 'faint' | 'full' | 'dark'

/** A tiny test strip: test line on the left, control line on the right. */
export function Strip({ level }: { level: LineLevel }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-11 shrink-0 items-center justify-center gap-3 rounded border border-line bg-surface"
    >
      <span
        className={cx(
          'h-3.5 rounded-full bg-her',
          level === 'dark' ? 'w-[5px]' : 'w-[3px]',
          level === 'none' && 'opacity-0',
          level === 'faint' && 'opacity-30',
        )}
      />
      <span className="h-3.5 w-[3px] rounded-full bg-her" />
    </span>
  )
}

/** A large one-tap choice: saves immediately (no save button). */
export function ChoiceButton({
  label,
  hint,
  level,
  onClick,
  current,
}: {
  label: string
  hint: string
  level?: LineLevel
  onClick: () => void
  /** Already logged at this time. */
  current?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={current || undefined}
      className={cx(
        'flex min-h-[68px] w-full flex-col justify-center gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors active:scale-[0.98]',
        FOCUS,
        current ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:bg-surface-2',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-base font-bold text-ink">{label}</span>
        {level ? <Strip level={level} /> : null}
      </span>
      <span className="block text-[11px] leading-snug text-ink-3">{hint}</span>
    </button>
  )
}

/** A big primary action (생리 [오늘 시작] …). */
export function BigAction({
  label,
  hint,
  onClick,
  tone = 'primary',
}: {
  label: string
  hint?: string
  onClick: () => void
  tone?: 'primary' | 'secondary'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex min-h-[64px] w-full flex-col items-center justify-center rounded-xl px-3 py-2 text-center transition-colors active:scale-[0.98]',
        FOCUS,
        tone === 'primary' ? 'bg-period text-surface hover:bg-period/90' : 'bg-surface-2 text-ink hover:bg-line/60',
      )}
    >
      <span className="text-base font-bold">{label}</span>
      {hint ? <span className={cx('text-[11px]', tone === 'primary' ? 'text-surface/85' : 'text-ink-3')}>{hint}</span> : null}
    </button>
  )
}

/** "08:10 · 음성  [지우기]" rows for tests already logged that day. */
export function LoggedList({
  title,
  items,
}: {
  title: string
  items: Array<{ key: string; text: string; onRemove: () => void; removeLabel: string }>
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-ink-2">{title}</p>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {items.map((i) => (
          <li key={i.key} className="flex items-center justify-between gap-2 pl-3">
            <span className="text-sm tabular-nums text-ink">{i.text}</span>
            <button
              type="button"
              onClick={(e) => {
                // The row (and this button) goes away: keep focus inside the sheet.
                const dialog = e.currentTarget.closest<HTMLElement>('[role="dialog"]')
                i.onRemove()
                dialog?.focus()
              }}
              aria-label={i.removeLabel}
              className={cx('h-11 shrink-0 rounded-lg px-3 text-xs font-semibold text-ink-2 hover:bg-surface-2', FOCUS)}
            >
              지우기
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function dayWord(date: ISODate, today: ISODate): string {
  if (date === today) return '오늘'
  if (date === addDays(today, -1)) return '어제'
  return formatKo(date, { weekday: false })
}
