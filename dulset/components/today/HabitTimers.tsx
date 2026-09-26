'use client'

import { Card, SectionTitle } from '@/components/ui'
import { activeItems } from '@/lib/logic/checks'
import { FOLIC_GOAL_DAYS, SPERM_CYCLE_DAYS, folicTimer, habitTimer, isSpermSide } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import { ExternalLink, ProgressBar } from './bits'

/**
 * Two slow timers that make "why keep doing this" visible:
 *  • sperm take ~64–74 days to form + 1–2 weeks to mature (~3 months) → healthy habits D+N (non-cycle-owner)
 *  • folic acid from ≥1 month (KR norm 3 months) before until 12 weeks (cycle owner)
 */
export default function HabitTimers() {
  const { state, today, me, cycleOwner } = useApp()
  // The 74-day sperm timer only fits the member whose cycle isn't tracked (and isn't '아내').
  const other = state.couple.members.find((m) => m.id !== cycleOwner.id && isSpermSide(m))
  const habit = other ? habitTimer(state, other.id, today) : null
  const hasHabits = other ? activeItems(state, other.id).some((i) => i.kind === 'habit') : false
  const folic = folicTimer(state, cycleOwner.id, today)

  const showHabit = !!other && (habit?.day !== undefined || hasHabits)
  if (!showHabit && !folic) return null

  const who = (id: string, name: string) => (id === me.id ? '나' : `${name}님`)

  return (
    <>
      <SectionTitle>건강 습관 타이머</SectionTitle>
      <Card className="space-y-4">
        {showHabit && other && habit ? (
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-ink">
                <span aria-hidden>🌱 </span>
                {who(other.id, other.name)}의 건강 습관{' '}
                {habit.day !== undefined ? <span className="tabular-nums text-him">D+{habit.day}</span> : null}
              </h3>
              {habit.day !== undefined ? (
                <span className="shrink-0 text-[11px] font-medium tabular-nums text-ink-3">
                  {Math.min(habit.day, SPERM_CYCLE_DAYS)}/{SPERM_CYCLE_DAYS}일
                </span>
              ) : null}
            </div>
            <ProgressBar className="mt-2" value={habit.progress} tone="him" label="정자 형성 기간(최대 74일 기준) 중 진행" />
            <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
              {habit.day === undefined
                ? '습관을 체크한 날부터 세어 드려요. '
                : habit.day >= SPERM_CYCLE_DAYS
                  ? '한 바퀴를 채웠어요! 지금처럼 이어 가요. '
                  : ''}
              새 정자가 만들어지는 데 약 64~74일, 성숙하는 데 1~2주가 더 걸려 모두 3개월쯤이에요. 오늘의 습관이 3개월 뒤를 만들어요.
            </p>
          </div>
        ) : null}

        {folic ? (
          <div className={showHabit ? 'border-t border-line pt-4' : undefined}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-ink">
                <span aria-hidden>💊 </span>
                {cycleOwner.id === me.id ? '' : `${cycleOwner.name}님 · `}
                {folic.day !== undefined ? (
                  <>
                    엽산 먹은 지 <span className="tabular-nums text-her">D+{folic.day}</span>
                  </>
                ) : (
                  '엽산 타이머'
                )}
              </h3>
              {folic.day !== undefined ? (
                <span className="shrink-0 text-[11px] font-medium tabular-nums text-ink-3">
                  {Math.min(folic.day, FOLIC_GOAL_DAYS)}/{FOLIC_GOAL_DAYS}일
                </span>
              ) : null}
            </div>
            <ProgressBar className="mt-2" value={folic.progress} tone="her" label="엽산 3개월 중 진행" />
            <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
              {folic.day === undefined ? '엽산을 처음 체크한 날부터 세어 드려요. ' : ''}
              임신 3개월 전부터 12주까지 하루 400µg을 권장해요 (최소 1개월 전부터).
            </p>
          </div>
        ) : null}

        <div className="-mb-2 flex flex-wrap gap-x-3 border-t border-line/70 pt-1">
          {showHabit ? (
            <ExternalLink href="https://onlinelibrary.wiley.com/doi/full/10.2164/jandrol.107.004655">
              정자 형성 기간 (J Androl)
            </ExternalLink>
          ) : null}
          {folic ? (
            <ExternalLink href="https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/folic-acid-for-the-prevention-of-neural-tube-defects-preventive-medication">
              엽산 권고 (USPSTF)
            </ExternalLink>
          ) : null}
        </div>
      </Card>
    </>
  )
}
