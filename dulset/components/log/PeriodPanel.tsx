'use client'

import { BigAction, dayWord, type SaveLog } from '@/components/log/parts'
import { addDays, diffDays, formatKo } from '@/lib/dates'
import { dayActions, periodCovering } from '@/lib/logic/calendarView'
import { logPeriodEnd, logPeriodStart, movePeriodStart, removePeriodLog } from '@/lib/logic/logs'
import { PERIOD_ASK_DAYS } from '@/lib/logic/ttcFlow'
import { useApp } from '@/lib/store'
import type { ISODate } from '@/lib/types'

/** 생리: [오늘 시작] [어제 시작] (or the chosen day), 끝났어요, fixes for near-duplicates. */
export default function PeriodPanel({ date, save }: { date: ISODate; save: SaveLog }) {
  const { state, today, viewer } = useApp()
  const len = state.cycle.periodLength
  const a = dayActions(state.periods, date, today, len)
  const { covering, extendable, moveable, nearby } = a
  const day = formatKo(date, { weekday: false })

  const start = (d: ISODate) => {
    // The same days the home card says 수고했어요 for a start logged late (ttcFlow.PERIOD_ASK_DAYS).
    const recent = diffDays(d, today) < PERIOD_ASK_DAYS
    const word = dayWord(d, today)
    save((s) => logPeriodStart(s, d, viewer, today), { kind: 'period' }, recent ? `이번 주기도 수고했어요 · ${word} 시작으로 남겼어요` : `${word} 생리 시작으로 남겼어요`)
  }

  if (covering) {
    const nth = diffDays(covering.start, date) + 1
    return (
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-ink-2">
          {a.isStart ? '생리 시작일로 기록된 날이에요.' : `${formatKo(covering.start)}에 시작한 생리 ${nth}일째예요.`}
          {covering.end ? ` 마지막 날은 ${formatKo(covering.end, { weekday: false })}이에요.` : ''}
        </p>
        {a.isEnd ? (
          <BigAction
            tone="secondary"
            label="마지막 날 지우기"
            hint="아직 끝나지 않았다면"
            onClick={() => save((s) => logPeriodEnd(s, covering.start, undefined), { kind: 'period' }, '마지막 날 기록을 지웠어요')}
          />
        ) : (
          <BigAction
            label="끝났어요"
            hint={`${day}을 마지막 날로 남겨요`}
            onClick={() => save((s) => logPeriodEnd(s, covering.start, date), { kind: 'period' }, `${day}에 끝난 걸로 남겼어요`)}
          />
        )}
        {a.isStart ? (
          <button
            type="button"
            onClick={() => save((s) => removePeriodLog(s, covering.start), { kind: 'period' }, '생리 기록을 지웠어요')}
            className="flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-period hover:bg-period-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            이 생리 기록 지우기
          </button>
        ) : null}
      </div>
    )
  }

  const isToday = date === today
  const yesterday = addDays(date, -1)
  const offerYesterday = isToday && !periodCovering(state.periods, yesterday, len)

  return (
    <div className="space-y-3">
      {nearby ? (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs leading-relaxed text-ink-2">
          {extendable || moveable
            ? `${formatKo(nearby.start)}에 기록한 생리와 가까워요. 같은 생리라면 아래에서 고쳐 주세요.`
            : `${formatKo(nearby.start)} 기록과 ${Math.abs(diffDays(nearby.start, date))}일 차이예요. 날짜가 맞는지 한 번 확인해 주세요.`}
        </p>
      ) : null}
      <div className={offerYesterday ? 'grid grid-cols-2 gap-2' : ''}>
        <BigAction label={isToday ? '오늘 시작' : `${day} 시작`} hint={nearby ? '새 생리로 남겨요' : undefined} onClick={() => start(date)} />
        {offerYesterday ? <BigAction label="어제 시작" hint={formatKo(yesterday, { weekday: false })} onClick={() => start(yesterday)} /> : null}
      </div>
      {extendable ? (
        <BigAction
          tone="secondary"
          label="끝났어요"
          hint={`${formatKo(extendable.start, { weekday: false })}에 시작한 생리가 ${day}까지였어요`}
          onClick={() => save((s) => logPeriodEnd(s, extendable.start, date), { kind: 'period' }, `${day}에 끝난 걸로 남겼어요`)}
        />
      ) : null}
      {moveable ? (
        <BigAction
          tone="secondary"
          label="시작일을 이 날로 옮기기"
          hint={`${formatKo(moveable.start, { weekday: false })} 기록이 사실 ${day} 시작이었다면`}
          onClick={() => save((s) => movePeriodStart(s, moveable.start, date), { kind: 'period' }, `시작일을 ${day}로 옮겼어요`)}
        />
      ) : null}
    </div>
  )
}
