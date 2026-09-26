'use client'

import { useMemo, useState } from 'react'
import { Button, Sheet, cx, useToast } from '@/components/ui'
import { diffDays, formatKo } from '@/lib/dates'
import { addPeriod, cycleAt, dayInfo, removePeriod, setLHTest, setPeriodEnd } from '@/lib/logic/cycle'
import {
  CHANCE_LABEL,
  PHASE_CLASS,
  dayActions,
  dayChanceLabel,
  dayTitle,
  explainDay,
  futureDayNote,
  knownCycleDay,
  phaseLabel,
  visiblePhase,
  type FertilityView,
} from '@/lib/logic/calendarView'
import { useApp } from '@/lib/store'
import type { ISODate, LHResult } from '@/lib/types'

export default function DaySheet({
  date,
  onClose,
  view,
}: {
  date: ISODate | null
  onClose: () => void
  view: FertilityView
}) {
  const { today } = useApp()
  return (
    <Sheet
      open={date !== null}
      onClose={onClose}
      title={
        date ? (
          <span className="flex items-center gap-2">
            {dayTitle(date, today)}
            {date === today ? (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-ink">오늘</span>
            ) : null}
          </span>
        ) : (
          ''
        )
      }
    >
      {date ? <DayBody key={date} date={date} view={view} /> : null}
    </Sheet>
  )
}

function DayBody({ date, view }: { date: ISODate; view: FertilityView }) {
  const { state, update, today } = useApp()
  const toast = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)

  // `today` stops projections past a missed period / an ended pregnancy, like the grid.
  const info = useMemo(() => dayInfo(state, date, today), [state, date, today])
  const cycle = useMemo(() => cycleAt(state, date), [state, date])
  const actions = useMemo(
    () => dayActions(state.periods, date, today, state.cycle.periodLength),
    [state.periods, date, today, state.cycle.periodLength],
  )
  const phase = visiblePhase(info.phase, view)
  const label = phaseLabel(phase, view)
  const chance = dayChanceLabel(info, view)
  const cycleDay = knownCycleDay(info)
  const lh = state.lhTests.find((t) => t.date === date)?.result
  const dayName = formatKo(date, { weekday: false })

  const act = (fn: Parameters<typeof update>[0], message: string) => {
    update(fn)
    toast.show(message)
  }

  const setLH = (result: LHResult | null) =>
    act(
      (s) => setLHTest(s, date, result),
      result === 'positive'
        ? 'LH 양성으로 기록했어요 · 예측을 다시 계산했어요'
        : result === 'negative'
          ? 'LH 음성으로 기록했어요'
          : 'LH 기록을 지웠어요',
    )

  const { covering, extendable, moveable, nearby } = actions

  return (
    <div className="space-y-5">
      <section aria-label="예측">
        <div className="flex items-start gap-3">
          <span className={cx('mt-0.5 h-5 w-5 shrink-0 rounded-full', phase === 'none' ? 'bg-surface-2' : PHASE_CLASS[phase])} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              {label ||
                (cycleDay !== undefined
                  ? `주기 ${cycleDay}일째`
                  : info.cycleDay !== undefined || info.unpredicted
                    ? '예측 없음'
                    : '기록 전')}
              {label && cycleDay !== undefined ? (
                <span className="ml-1.5 text-xs font-medium text-ink-3">주기 {cycleDay}일째</span>
              ) : null}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{explainDay(info, view, date < today)}</p>
            {view === 'explicit' && info.isOvulation && cycle ? (
              <p className="mt-2 text-[13px] font-medium text-fert">
                <span aria-hidden>⭐ </span>배란 예상일 · {cycle.basis === 'lh' ? 'LH 양성 다음 날로 계산했어요' : '달력으로 계산했어요'}
              </p>
            ) : null}
            {chance ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
                임신 가능성(예상):
                <strong
                  className={cx(
                    'font-bold',
                    chance === CHANCE_LABEL.high ? 'text-fert' : chance === CHANCE_LABEL.low ? 'text-ink-3' : 'text-ink',
                  )}
                >
                  {chance}
                </strong>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {!actions.canLog ? (
        <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2">{futureDayNote(view)}</p>
      ) : (
        <>
          <section aria-labelledby="day-period-title" className="space-y-2">
            <h3 id="day-period-title" className="text-xs font-semibold text-ink-2">
              생리 기록
            </h3>
            {covering ? (
              <>
                <p className="text-[13px] text-ink-2">
                  {actions.isStart
                    ? '생리 시작일로 기록된 날이에요.'
                    : `${formatKo(covering.start)}에 시작한 생리 기간이에요.`}
                  {covering.end ? ` 마지막 날은 ${formatKo(covering.end, { weekday: false })}이에요.` : ''}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {actions.isEnd ? (
                    <Button
                      variant="secondary"
                      onClick={() => act((s) => setPeriodEnd(s, covering.start, undefined), '마지막 날 기록을 지웠어요')}
                    >
                      마지막 날 지우기
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        act((s) => setPeriodEnd(s, covering.start, date), `${dayName}을 마지막 날로 설정했어요`)
                      }
                    >
                      생리 마지막 날로 설정
                    </Button>
                  )}
                  {confirmDelete ? null : (
                    <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                      이 기록 삭제
                    </Button>
                  )}
                </div>
                {confirmDelete ? (
                  <div
                    role="group"
                    aria-labelledby="day-delete-confirm"
                    className="rounded-xl border border-period/30 bg-period-soft p-3"
                  >
                    <p id="day-delete-confirm" className="text-[13px] text-ink">
                      {formatKo(covering.start)}에 시작한 생리 기록을 지울까요? 예측이 다시 계산돼요.
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <ConfirmCancel onClick={() => setConfirmDelete(false)} />
                      <Button
                        variant="danger"
                        onClick={() => {
                          setConfirmDelete(false)
                          act((s) => removePeriod(s, covering.start), '생리 기록을 지웠어요')
                        }}
                      >
                        지우기
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {nearby ? (
                  <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs leading-relaxed text-ink-2">
                    {extendable || moveable
                      ? `${formatKo(nearby.start)}에 기록한 생리와 가까워요. 같은 생리라면 새로 기록하기보다 아래 버튼으로 고쳐 주세요.`
                      : `${formatKo(nearby.start)} 기록과 ${Math.abs(diffDays(nearby.start, date))}일 차이라 새 주기로 보기엔 짧아요. 날짜가 맞는지 한 번 확인해 주세요.`}
                  </p>
                ) : null}
                {extendable ? (
                  <FixButton
                    onClick={() =>
                      act((s) => setPeriodEnd(s, extendable.start, date), `${dayName}을 마지막 날로 설정했어요`)
                    }
                    label="생리 마지막 날로 설정"
                    hint={`${formatKo(extendable.start, { weekday: false })}에 시작한 생리가 이 날까지였다면`}
                  />
                ) : null}
                {moveable ? (
                  <FixButton
                    onClick={() =>
                      act(
                        (s) => addPeriod(removePeriod(s, moveable.start), date, moveable.end),
                        `시작일을 ${dayName}로 옮겼어요`,
                      )
                    }
                    label="시작일을 이 날로 옮기기"
                    hint={`${formatKo(moveable.start, { weekday: false })} 기록이 사실 이 날 시작이었다면`}
                  />
                ) : null}
                <Button
                  full
                  variant={nearby ? 'secondary' : 'primary'}
                  onClick={() => act((s) => addPeriod(s, date), `${dayName} 생리 시작으로 기록했어요 · 두 사람 화면에 함께 보여요`)}
                >
                  {nearby ? '새 생리 시작일로 기록' : '생리 시작일로 기록'}
                </Button>
                {date === today ? (
                  <p className="text-[11px] leading-relaxed text-ink-3">
                    다른 날 시작했다면 창을 닫고 달력에서 그 날짜를 눌러 기록해 주세요.
                  </p>
                ) : null}
              </>
            )}
          </section>

          {view !== 'hidden' ? (
            <section aria-labelledby="day-lh-title" className="space-y-2">
              <h3 id="day-lh-title" className="text-xs font-semibold text-ink-2">
                {view === 'soft' ? 'LH 테스트' : 'LH 배란테스트'}
              </h3>
              <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="day-lh-title">
                <LHButton selected={lh === 'positive'} onClick={() => setLH('positive')} tone="ok">
                  양성
                </LHButton>
                <LHButton selected={lh === 'negative'} onClick={() => setLH('negative')} tone="ink">
                  음성
                </LHButton>
                <Button variant="ghost" disabled={!lh} onClick={() => setLH(null)}>
                  지우기
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-ink-3">
                {view === 'soft'
                  ? '첫 양성이 나온 날과 다음 날이 가장 좋아요. 기록하면 우리의 주간 예측을 바로 고쳐요.'
                  : '첫 양성이 나온 날과 다음 날이 가장 좋아요. 기록하면 배란 예상일을 바로 다시 계산해요.'}
              </p>
            </section>
          ) : null}
        </>
      )}

      <p className="text-[11px] leading-relaxed text-ink-3">
        기록은 두 사람 화면에 함께 보여요. 모든 날짜는 참고용 예상이며 피임 목적으로 쓰면 안 돼요.
      </p>
    </div>
  )
}

/** "취소" that takes focus when the inline delete confirmation opens (the 삭제 button it replaced is gone). */
function ConfirmCancel({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus
      className="inline-flex h-11 items-center justify-center rounded-xl bg-surface-2 px-4 text-sm font-semibold text-ink hover:bg-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      취소
    </button>
  )
}

function FixButton({ onClick, label, hint }: { onClick: () => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[52px] w-full flex-col items-start justify-center rounded-xl bg-surface-2 px-4 py-2 text-left hover:bg-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="text-[11px] text-ink-3">{hint}</span>
    </button>
  )
}

function LHButton({
  selected,
  onClick,
  tone,
  children,
}: {
  selected: boolean
  onClick: () => void
  tone: 'ok' | 'ink'
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        'h-11 rounded-xl border text-sm font-semibold transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        selected
          ? tone === 'ok'
            ? 'border-ok bg-ok text-surface'
            : 'border-ink-2 bg-ink-2 text-bg'
          : 'border-line bg-surface text-ink hover:bg-surface-2',
      )}
    >
      {selected ? '✓ ' : ''}
      {children}
    </button>
  )
}
