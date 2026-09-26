'use client'

import { Avatar, Card } from '@/components/ui'
import { SEX_EMOJI } from '@/lib/content/baby'
import { dLabel, formatKo } from '@/lib/dates'
import { dayOfLife, nextKoreanDay } from '@/lib/logic/baby'
import { ageAt } from '@/lib/logic/babyView'
import { useApp } from '@/lib/store'
import type { Baby } from '@/lib/types'

export default function BabyHero({ baby, onEdit }: { baby: Baby; onEdit: () => void }) {
  const { today, me, partner } = useApp()
  const day = dayOfLife(baby.birthDate, today)
  const next = nextKoreanDay(baby.birthDate, today)
  const born = day >= 1

  return (
    <Card tone="brand" className="relative">
      <button
        type="button"
        onClick={onEdit}
        aria-label="아기 정보 수정"
        className="absolute right-2 top-2 flex h-11 min-w-[44px] items-center justify-center rounded-full px-3 text-xs font-semibold text-brand-ink hover:bg-surface/60"
      >
        수정
      </button>

      <div className="flex items-center gap-3 pr-12">
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface text-3xl shadow-card"
        >
          {SEX_EMOJI[baby.sex]}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-extrabold text-ink">{baby.name}</h1>
          <p className="text-sm font-semibold text-ink-2">{ageAt(baby.birthDate, today)}</p>
          <p className="text-[11px] text-ink-3">{formatKo(baby.birthDate, { year: true, weekday: false })} 출생</p>
        </div>
      </div>

      <p className="mt-4 text-ink">
        {born ? (
          <>
            <span className="text-sm font-medium text-ink-2">태어난 지 </span>
            <span className="text-3xl font-extrabold text-brand-ink">{day.toLocaleString('ko-KR')}</span>
            <span className="text-sm font-medium text-ink-2">일째</span>
          </>
        ) : (
          <span className="text-sm font-medium text-ink-2">
            태어날 날까지 {dLabel(baby.birthDate, today)}
          </span>
        )}
      </p>

      {next ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-surface/80 px-3 py-2.5">
          {next.date === today ? (
            <p className="text-sm font-bold text-ink">
              오늘은 {next.label}이에요 <span aria-hidden>🎉</span>
            </p>
          ) : (
            <p className="min-w-0 text-sm text-ink-2">
              다음 기념일 <span className="font-bold text-ink">{next.label}</span>
              <span className="ml-1 text-xs text-ink-3">{formatKo(next.date)}</span>
            </p>
          )}
          {next.date !== today ? (
            <span className="shrink-0 rounded-full bg-brand px-2.5 py-1 text-xs font-bold tabular-nums text-white">
              {dLabel(next.date, today)}
            </span>
          ) : null}
        </div>
      ) : null}

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-3">
        <Avatar member={me} size="sm" />
        <Avatar member={partner} size="sm" />
        <span>
          {me.name}님과 {partner.name}님이 함께 보는 기록이에요
        </span>
      </p>
    </Card>
  )
}
