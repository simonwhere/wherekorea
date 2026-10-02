'use client'

import { BigAction, dayWord, type SaveLog } from '@/components/log/parts'
import { QuickDateChips } from '@/components/onboarding/parts'
import { addDays, diffDays, formatKo } from '@/lib/dates'
import { dayActions, periodCovering } from '@/lib/logic/calendarView'
import { logPeriodEnd, movePeriodStart, openPeriodOn, removePeriodLog } from '@/lib/logic/logs'
import { PERIOD_ASK_DAYS, logPeriodOrBleeding, periodStartDuringPositive } from '@/lib/logic/ttcFlow'
import { useApp } from '@/lib/store'
import type { ISODate } from '@/lib/types'

/** 생리: [오늘 시작] [어제 시작] (or the chosen day), 끝났어요, fixes for near-duplicates. */
export default function PeriodPanel({ date, save }: { date: ISODate; save: SaveLog }) {
  const { state, today, viewer } = useApp()
  const len = state.cycle.periodLength
  const a = dayActions(state.periods, date, today, len)
  const { covering, extendable, moveable, nearby } = a
  const day = formatKo(date, { weekday: false })

  // 병원 확인 전 (a positive test waiting for the clinic): a start from that day
  // on is kept as the day bleeding began, not yet a period — the home card then
  // offers 병원에 연락하기 / 생리로 기록할게요 (ttcFlow.logPeriodOrBleeding).
  const bleeding = periodStartDuringPositive(state, date)
  const start = (d: ISODate) => {
    if (periodStartDuringPositive(state, d)) {
      save((s) => logPeriodOrBleeding(s, d, viewer, today), { kind: 'period' }, '출혈 시작일로 남겼어요 · 홈에서 안내를 볼 수 있어요')
      return
    }
    // The same days the home card says 수고했어요 for a start logged late (ttcFlow.PERIOD_ASK_DAYS).
    const recent = diffDays(d, today) < PERIOD_ASK_DAYS
    const word = dayWord(d, today)
    save(
      (s) => logPeriodOrBleeding(s, d, viewer, today),
      { kind: 'period' },
      recent ? `이번 주기도 수고했어요 · ${word} 시작으로 남겼어요` : `${word} 생리 시작으로 남겼어요`,
    )
  }

  if (covering) {
    const nth = diffDays(covering.start, date) + 1
    const end = (d: ISODate) => {
      const word = dayWord(d, today)
      const when = word === '오늘' || word === '어제' ? word : `${word}에`
      save((s) => logPeriodEnd(s, covering.start, d), { kind: 'period' }, `${when} 끝난 걸로 남겼어요`)
    }
    // Still bleeding by the record and today is inside it: one tap closes it (D-11).
    // The chosen day comes second when it isn't today, so a late log still works.
    const openToday = !covering.end && openPeriodOn(state.periods, today, len)?.start === covering.start
    const yesterday = addDays(today, -1)
    const offerYesterday = openToday && yesterday > covering.start
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
        ) : openToday ? (
          <>
            <div className={offerYesterday ? 'grid grid-cols-2 gap-2' : ''}>
              <BigAction label="오늘 끝났어요" hint="오늘을 마지막 날로 남겨요" onClick={() => end(today)} />
              {offerYesterday ? (
                <BigAction
                  tone="secondary"
                  label="어제 끝났어요"
                  hint={formatKo(yesterday, { weekday: false })}
                  onClick={() => end(yesterday)}
                />
              ) : null}
            </div>
            {date !== today && date !== yesterday ? (
              <BigAction tone="secondary" label={`${day}에 끝났어요`} hint={`${day}을 마지막 날로 남겨요`} onClick={() => end(date)} />
            ) : null}
          </>
        ) : (
          <BigAction label={date === today ? '오늘 끝났어요' : '끝났어요'} hint={`${day}을 마지막 날로 남겨요`} onClick={() => end(date)} />
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

  // Nothing logged yet: the first record is the LAST start, which is often not
  // today — the chosen day first, then [어제][1주 전][2주 전][3주 전] (N15).
  if (state.periods.length === 0) {
    const first = (d: ISODate) =>
      save(
        (s) => logPeriodOrBleeding(s, d, viewer, today),
        { kind: 'period' },
        `${dayWord(d, today)} 시작으로 남겼어요. 이제부터 예상을 보여 드릴게요`,
      )
    return (
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-ink-2">
          첫 기록이에요. 마지막 생리가 시작된 날 하나면 돼요 — 대략적인 날이어도 괜찮아요.
        </p>
        <BigAction label={isToday ? '오늘 시작' : `${day} 시작`} hint="마지막 생리 시작일로 남겨요" onClick={() => first(date)} />
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-2">또는</p>
          <QuickDateChips today={today} onPick={first} label="마지막 생리 시작일 빠른 선택" skip={[diffDays(date, today)]} />
        </div>
        <p className="text-[11px] leading-relaxed text-ink-3">
          다른 날은 위의 날짜에서 고르고, 쓰던 앱의 이전 시작일은 주기 탭에서 더 넣을 수 있어요.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {bleeding ? (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-2">
          병원 확인 전이라 생리 대신 <b className="font-semibold text-ink">출혈 시작일</b>로 남겨요. 홈에서 안내를 볼 수 있고, 생리로 바꿀
          수도 있어요.
        </p>
      ) : null}
      {nearby ? (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs leading-relaxed text-ink-2">
          {extendable || moveable
            ? `${formatKo(nearby.start)}에 기록한 생리와 가까워요. 같은 생리라면 아래에서 고쳐 주세요.`
            : `${formatKo(nearby.start)} 기록과 ${Math.abs(diffDays(nearby.start, date))}일 차이예요. 날짜가 맞는지 한 번 확인해 주세요.`}
        </p>
      ) : null}
      <div className={offerYesterday ? 'grid grid-cols-2 gap-2' : ''}>
        <BigAction
          label={isToday ? '오늘 시작' : `${day} 시작`}
          hint={bleeding ? '출혈 시작일로 남겨요' : nearby ? '새 생리로 남겨요' : undefined}
          onClick={() => start(date)}
        />
        {offerYesterday ? (
          <BigAction label="어제 시작" hint={formatKo(yesterday, { weekday: false })} onClick={() => start(yesterday)} />
        ) : null}
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
