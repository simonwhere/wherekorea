'use client'

import { Card, SectionTitle, cx } from '@/components/ui'
import { KOREAN_DAYS_NOTE } from '@/lib/content/baby'
import { formatKo } from '@/lib/dates'
import { koreanDayRows } from '@/lib/logic/babyView'
import { useApp } from '@/lib/store'
import type { Baby } from '@/lib/types'
import { ExternalLink, Pill, goDiary } from './bits'

export default function KoreanDays({ baby }: { baby: Baby }) {
  const { today } = useApp()
  const rows = koreanDayRows(baby.birthDate, today)

  return (
    <section>
      <SectionTitle sub="태어난 날을 1일로 세어요">기념일</SectionTitle>
      <Card className="px-0 py-1">
        <ol>
          {rows.map((r) => {
            const done = r.status === 'past'
            const isToday = r.status === 'today'
            return (
              <li
                key={r.key}
                className={cx(
                  'flex min-h-[52px] items-center gap-3 border-b border-line/60 px-4 last:border-b-0',
                  isToday && 'bg-brand-soft',
                )}
              >
                <span
                  aria-hidden
                  className={cx(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    done ? 'bg-ok text-white' : isToday ? 'bg-brand text-white' : 'border-2 border-line',
                  )}
                >
                  {done ? '✓' : isToday ? '★' : ''}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cx('text-sm font-bold', done ? 'text-ink-2' : 'text-ink')}>
                    {r.label}
                    {done ? <span className="sr-only"> (지났어요)</span> : null}
                  </p>
                  <p className="text-[11px] text-ink-3">{formatKo(r.date, { year: r.date.slice(0, 4) !== today.slice(0, 4) })}</p>
                </div>
                {done || isToday ? (
                  <button
                    type="button"
                    onClick={goDiary}
                    className="-mr-2 inline-flex h-11 shrink-0 items-center px-2 text-xs font-semibold text-brand-ink underline-offset-2 hover:underline"
                    aria-label={`${r.label} 일기 쓰기`}
                  >
                    일기 쓰기
                  </button>
                ) : null}
                {isToday ? <Pill tone="brand">오늘</Pill> : !done ? <Pill>{r.d}</Pill> : null}
              </li>
            )
          })}
        </ol>
      </Card>

      <details className="group mt-2 rounded-xl bg-surface-2 px-3">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between text-xs font-semibold text-ink-2 [&::-webkit-details-marker]:hidden">
          <span>
            <span aria-hidden className="mr-1">
              🍚
            </span>
            {KOREAN_DAYS_NOTE.title}, 이렇게 보내요
          </span>
          <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <p className="pb-1 text-xs leading-relaxed text-ink-2">{KOREAN_DAYS_NOTE.body}</p>
        <ExternalLink href={KOREAN_DAYS_NOTE.source.url}>출처: {KOREAN_DAYS_NOTE.source.label}</ExternalLink>
      </details>
    </section>
  )
}
