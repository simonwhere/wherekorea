'use client'

import { useCallback, useState } from 'react'
import CoverSheet from '@/components/cover/CoverSheet'
import { Avatar, Button, Card, cx } from '@/components/ui'
import { dLabel, formatKo, isISODate } from '@/lib/dates'
import { daysSince, nextAnniversaries } from '@/lib/logic/anniversary'
import { marriedLine, ourDaysChain } from '@/lib/logic/usView'
import { useApp } from '@/lib/store'

/**
 * "우리" — both of us, 함께한 지 D+N from the day we met, the next
 * anniversary, and the 우리의 날들 chain that keeps growing through each stage.
 */
export default function UsHero({ onEditDates }: { onEditDates: () => void }) {
  const { state, today, me, partner } = useApp()
  const { metDate, marriedDate } = state.couple
  // Stored dates are read defensively (older or hand-edited data).
  const met = isISODate(metDate) && metDate <= today ? metDate : undefined
  const married = isISODate(marriedDate) ? marriedDate : undefined
  const next = nextAnniversaries(state.couple, state.anniversaries, today, 1)[0]
  const chain = ourDaysChain(state, today, me.id)
  const [coverOpen, setCoverOpen] = useState(false)
  const closeCover = useCallback(() => setCoverOpen(false), [])

  return (
    <Card tone="brand">
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 items-center" aria-hidden>
          <Avatar member={me} />
          <span className="-mx-1 z-10 text-sm">💗</span>
          <Avatar member={partner} />
        </div>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
          {me.name} <span className="font-normal text-ink-3">·</span> {partner.name}
        </p>
        {/* The photo at the top of 오늘 — also reachable from here. */}
        <button
          type="button"
          onClick={() => setCoverOpen(true)}
          className={cx(
            'flex h-11 shrink-0 items-center rounded-xl px-2.5 text-xs font-semibold text-ink-2 hover:bg-surface/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand',
            !met && '-mr-2',
          )}
        >
          표지 사진<span className="sr-only"> 바꾸기</span>
        </button>
        {met ? (
          <button
            type="button"
            onClick={onEditDates}
            className="-ml-1 -mr-2 flex h-11 shrink-0 items-center rounded-xl px-2.5 text-xs font-semibold text-ink-2 hover:bg-surface/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            날짜 고치기<span className="sr-only"> (처음 만난 날·결혼한 날)</span>
          </button>
        ) : null}
      </div>
      <CoverSheet open={coverOpen} onClose={closeCover} />

      {met ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-ink-2">함께한 지</p>
          <p className="mt-0.5 text-[34px] font-extrabold leading-none tracking-tight text-ink tabular-nums">
            D+{daysSince(met, today).toLocaleString('ko-KR')}
            <span className="ml-0.5 text-lg font-bold">일</span>
          </p>
          <p className="mt-1.5 text-xs text-ink-2">{formatKo(met, { year: true, weekday: false })} 처음 만났어요</p>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-[17px] font-bold text-ink">처음 만난 날을 알려 주세요</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-2">
            만난 날부터 함께한 날수와 100일·주년을 챙겨 드려요. 결혼한 날도 넣을 수 있어요.
          </p>
          <Button className="mt-3" onClick={onEditDates}>
            만난 날 넣기
          </Button>
        </div>
      )}

      {married ? (
        <p className="mt-2 text-xs font-medium text-ink-2">
          <span aria-hidden>💍 </span>
          {marriedLine(married, today)}
        </p>
      ) : null}

      {next ? (
        <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-surface/70 px-3 py-2.5">
          <span className="text-xl leading-none" aria-hidden>
            {next.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-ink-3">{next.date === today ? '오늘의 기념일' : '다음 기념일'}</p>
            <p className="truncate text-sm font-bold text-ink">{next.title}</p>
            <p className="text-xs text-ink-2">{formatKo(next.date, { year: next.date.slice(0, 4) !== today.slice(0, 4) })}</p>
          </div>
          <span
            className={cx(
              'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums',
              next.date === today ? 'bg-brand text-white' : 'bg-surface text-brand-ink',
            )}
          >
            {next.date === today ? '오늘' : dLabel(next.date, today)}
          </span>
        </div>
      ) : null}

      {chain.length ? (
        <div className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none]">
          <ol aria-label="우리의 날들" className="flex w-max items-center gap-1">
            {chain.map((link, i) => (
              <li key={link.key} className="flex items-center gap-1">
                {i > 0 ? (
                  <span aria-hidden className="text-xs text-ink-3">
                    →
                  </span>
                ) : null}
                <span className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border border-brand/20 bg-surface px-2.5 text-xs font-semibold text-ink-2">
                  <span aria-hidden>{link.emoji}</span>
                  {link.text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </Card>
  )
}
