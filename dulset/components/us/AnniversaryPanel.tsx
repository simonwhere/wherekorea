'use client'

import { useCallback, useMemo, useState } from 'react'
import { Button, Card, EmptyState, SectionTitle, cx } from '@/components/ui'
import { dLabel, formatKo } from '@/lib/dates'
import type { AnniversaryEvent } from '@/lib/logic/anniversary'
import { anniversaryEmoji, anniversaryLists, nextCustomOccurrence } from '@/lib/logic/usView'
import { useApp } from '@/lib/store'
import AnniversarySheet, { type AnniversaryTarget } from './AnniversarySheet'

/** Upcoming rows shown before "더 보기". */
const FIRST_ROWS = 6

/** 우리 › 기념일: what's coming, what we celebrated this year, our own days, and where it all starts. */
export default function AnniversaryPanel({ onEditDates }: { onEditDates: () => void }) {
  const { state, today } = useApp()
  const { couple, anniversaries } = state
  const { upcoming, pastThisYear } = useMemo(
    () => anniversaryLists(couple, anniversaries, today),
    [couple, anniversaries, today],
  )
  const [showAll, setShowAll] = useState(false)
  const [target, setTarget] = useState<AnniversaryTarget>(null)
  const close = useCallback(() => setTarget(null), [])
  const custom = useMemo(() => [...anniversaries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)), [anniversaries])
  const rows = showAll ? upcoming : upcoming.slice(0, FIRST_ROWS)
  const hasStart = !!(couple.metDate || couple.marriedDate)

  return (
    <div>
      <SectionTitle sub="100일 단위와 주년은 저절로 생겨요 · 한 주 전과 당일에 둘 다에게 알려 드려요">다가오는 날</SectionTitle>
      {upcoming.length ? (
        <Card className="py-1">
          <ul>
            {rows.map((e, i) => (
              <EventRow key={e.key} event={e} today={today} divider={i > 0} />
            ))}
          </ul>
          {upcoming.length > FIRST_ROWS ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              className="flex h-11 w-full items-center justify-center border-t border-line text-xs font-semibold text-ink-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              {showAll ? '접기' : `${upcoming.length - FIRST_ROWS}개 더 보기`}
            </button>
          ) : null}
        </Card>
      ) : (
        <EmptyState
          icon="🗓️"
          title="챙길 기념일이 아직 없어요"
          body="처음 만난 날이나 결혼한 날을 넣으면 100일·주년이 저절로 생겨요. 우리만의 날도 더할 수 있어요."
          action={hasStart ? undefined : <Button onClick={onEditDates}>만난 날 넣기</Button>}
        />
      )}

      {pastThisYear.length ? (
        <>
          <SectionTitle>올해 지난 날</SectionTitle>
          <Card tone="muted" className="py-1">
            <ul>
              {pastThisYear.map((e, i) => (
                <EventRow key={e.key} event={e} today={today} divider={i > 0} past />
              ))}
            </ul>
          </Card>
        </>
      ) : null}

      <SectionTitle
        sub="첫 여행, 프러포즈한 날처럼 둘만 아는 날"
        action={
          <Button size="md" variant="secondary" onClick={() => setTarget({ kind: 'new' })}>
            + 더하기
          </Button>
        }
      >
        우리가 정한 날
      </SectionTitle>
      {custom.length ? (
        <Card className="py-1">
          <ul>
            {custom.map((c, i) => {
              const next = nextCustomOccurrence(c, today)
              return (
                <li key={c.id} className={cx('flex items-center gap-3 py-2', i > 0 && 'border-t border-line')}>
                  <span className="text-xl leading-none" aria-hidden>
                    {anniversaryEmoji(c)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{c.title}</p>
                    <p className="text-xs text-ink-3">
                      {formatKo(c.date, { year: true, weekday: false })} · {c.yearly ? '매년' : '한 번'}
                      {next ? (
                        <>
                          {' · '}
                          <span className="whitespace-nowrap text-ink-2">
                            {next.n ? `${next.n}주년 ` : ''}
                            {dLabel(next.date, today)}
                          </span>
                        </>
                      ) : (
                        ' · 지난 날'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTarget({ kind: 'edit', id: c.id })}
                    className="-mr-2 flex h-11 shrink-0 items-center rounded-xl px-3 text-xs font-semibold text-ink-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    고치기<span className="sr-only"> ({c.title})</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : (
        <p className="rounded-xl2 border border-dashed border-line px-4 py-4 text-center text-xs leading-relaxed text-ink-3">
          아직 없어요. 둘만의 날을 더해 두면 같은 방식으로 챙겨 드려요.
        </p>
      )}

      <SectionTitle>우리의 시작</SectionTitle>
      <Card className="py-1">
        <ul>
          <StartRow label="처음 만난 날" icon="💞" date={couple.metDate} />
          <StartRow label="결혼한 날" icon="💍" date={couple.marriedDate} divider />
        </ul>
        <Button variant="secondary" full className="mb-2 mt-1" onClick={onEditDates}>
          {hasStart ? '날짜 고치기' : '날짜 넣기'}
        </Button>
      </Card>

      <AnniversarySheet target={target} onClose={close} />
    </div>
  )
}

function EventRow({
  event,
  today,
  divider,
  past = false,
}: {
  event: AnniversaryEvent
  today: string
  divider: boolean
  past?: boolean
}) {
  const isToday = event.date === today
  return (
    <li className={cx('flex items-center gap-3 py-2.5', divider && 'border-t border-line')}>
      <span className="text-xl leading-none" aria-hidden>
        {event.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cx('truncate text-sm font-semibold', past ? 'text-ink-2' : 'text-ink')}>{event.title}</p>
        <p className="text-xs text-ink-3">
          {formatKo(event.date, { year: event.date.slice(0, 4) !== today.slice(0, 4) })}
        </p>
      </div>
      <span
        className={cx(
          'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums',
          isToday ? 'bg-brand text-white' : past ? 'bg-surface text-ink-3' : 'bg-brand-soft text-brand-ink',
        )}
      >
        {isToday ? '오늘' : dLabel(event.date, today)}
      </span>
    </li>
  )
}

function StartRow({ label, icon, date, divider = false }: { label: string; icon: string; date?: string; divider?: boolean }) {
  return (
    <li className={cx('flex items-center gap-3 py-2.5', divider && 'border-t border-line')}>
      <span className="text-xl leading-none" aria-hidden>
        {icon}
      </span>
      <p className="min-w-0 flex-1 text-sm font-medium text-ink">{label}</p>
      <p className={cx('shrink-0 text-sm', date ? 'font-semibold text-ink-2' : 'text-ink-3')}>
        {date ? formatKo(date, { year: true, weekday: false }) : '아직 없어요'}
      </p>
    </li>
  )
}
