'use client'

import { Card, SectionTitle, cx } from '@/components/ui'
import { activeItems } from '@/lib/logic/checks'
import { folicTimer, habitTimer, isSpermSide } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import { ExternalLink, ProgressBar } from './bits'

/**
 * Two slow timers that make "why keep doing this" visible:
 *  • sperm take ~64–74 days to form + 1–2 weeks to mature (~3 months) → healthy habits D+N (non-cycle-owner)
 *  • folic acid from ≥1 month (KR norm 3 months) before until 12 weeks (cycle owner)
 * Both count from the first day the items were actually checked ('시작 전'
 * until then) — lib/logic/today habitTimer / folicTimer.
 */
export default function HabitTimers() {
  const { state, today, me, cycleOwner } = useApp()
  // The ~3-month sperm timer only fits the member whose cycle isn't tracked (and isn't '아내').
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
            <div>
              <h3 className="text-sm font-bold text-ink">
                <span aria-hidden>🌱 </span>
                {who(other.id, other.name)}의 건강 습관{' '}
                <span className={cx('tabular-nums', habit.day !== undefined ? 'text-him' : 'text-ink-3')}>{habit.label}</span>
              </h3>
            </div>
            <ProgressBar className="mt-2" value={habit.progress} tone="him" label={`${habit.goalText} 중 진행`} />
            <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{habit.note}</p>
          </div>
        ) : null}

        {folic ? (
          <div className={showHabit ? 'border-t border-line pt-4' : undefined}>
            <div>
              <h3 className="text-sm font-bold text-ink">
                <span aria-hidden>💊 </span>
                {cycleOwner.id === me.id ? '' : `${cycleOwner.name}님 · `}
                {folic.day !== undefined ? (
                  <>
                    엽산 먹은 지 <span className="tabular-nums text-her">{folic.label}</span>
                  </>
                ) : (
                  <>
                    엽산 타이머 <span className="text-ink-3">{folic.label}</span>
                  </>
                )}
              </h3>
            </div>
            <ProgressBar className="mt-2" value={folic.progress} tone="her" label={`${folic.goalText} 중 진행`} />
            <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{folic.note}</p>
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
