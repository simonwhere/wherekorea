'use client'

// "더 보기" — everything that isn't needed every day, folded under the three
// home blocks: habit timers (in full, with their sources — his 내 준비 line on
// the week block is the short form), this week's roadmap, the doctor card and
// the rest-cycle / clinic switches. 우리 신호 moved out to 우리 한 줄 (Now 3
// N21 ③: components/signals/SignalChips); the diary prompt and the 둘만의 시간
// row left in N27 (the preparing stage hides the record book's breadth).

import type { TabKey } from '@/components/AppShell'
import ClinicSwitch from '@/components/cycle/ClinicSwitch'
import { Card, Toggle, cx, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { formatKo } from '@/lib/dates'
import { isClinicMode } from '@/lib/logic/clinic'
import { canLogCycle } from '@/lib/logic/prefs'
import { recentlyEnded } from '@/lib/logic/pregnancy'
import { doctorAdvice, stampOn } from '@/lib/logic/today'
import { activeRest, startRestCycle } from '@/lib/logic/ttc'
import { endRestFromHome, type Moment } from '@/lib/logic/ttcFlow'
import { useApp } from '@/lib/store'
import { DoctorCard } from './ExtraCards'
import HabitTimers from './HabitTimers'
import LossSupport from './LossSupport'
import { PlanFocusCard, UpcomingCard } from './PlanCards'

type Nav = (tab: TabKey) => void

export default function MoreSection({
  moment,
  onNavigate,
  className,
}: {
  moment: Moment | null
  onNavigate: Nav
  className?: string
}) {
  const { state, today, me } = useApp()
  const owner = canLogCycle(state, me.id)
  const support = recentlyEnded(state, today) && moment?.kind !== 'after-loss'
  const clinic = isClinicMode(state)

  return (
    <details className={cx('group', className)}>
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-ink-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">더 보기</span>
        <span className="hidden group-open:inline">접기</span>
        <Icon name="chev" className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>

      <div className="mt-2 space-y-3">
        {/* While a clinic sets the timing the ordinary rest switch has nothing to add. */}
        {owner && !clinic ? <RestSwitch /> : null}
        {owner ? <ClinicSwitch /> : null}
        {support ? (
          <Card>
            <LossSupport />
          </Card>
        ) : null}
        <UpcomingCard onNavigate={onNavigate} />
        <PlanFocusCard onNavigate={onNavigate} />
      </div>

      <HabitTimers />

      {/* No "see a specialist" card for a couple already preparing with one (N13). */}
      {!clinic && doctorAdvice(state, today, me.id) ? (
        <div className="mt-6">
          <DoctorCard />
        </div>
      ) : null}

      {/* '준비 일기' and '둘만의 시간' rows left here in N27: the 기록장 is the 우리 tab and the ideas
          stay behind the 우리의 주간 card's '아이디어 더 보기' (#date still opens). 기록 지키기 sits
          under ③ 우리 한 줄 (BackupBanner, N16). */}
    </details>
  )
}

/**
 * "이번 주기는 쉬어요" — the cycle owner's switch; the next period turns it
 * back on. After a pregnancy ended it is the 'loss' quiet (ttc.startLossRest):
 * on until its last day whatever is logged, and this is where she turns it off early.
 */
function RestSwitch() {
  const { state, update, today } = useApp()
  const toast = useToast()
  const rest = activeRest(state, today)
  const loss = rest?.reason === 'loss'
  const onChange = (next: boolean) => {
    if (next) {
      update((s) => startRestCycle(s, today, 'rest'))
      toast.show('이번 주기는 쉬어요. 날짜 예상과 알림을 잠시 꺼 둘게요')
    } else {
      update((s) => endRestFromHome(s, today, stampOn(today)))
      toast.show(loss ? '다시 켰어요. 생리를 기록한 날부터 다시 예상해요' : '다시 켰어요')
    }
  }
  return (
    <Card className="py-2">
      <Toggle
        checked={!!rest}
        onChange={onChange}
        label={loss ? '쉬어 가는 중이에요' : '이번 주기는 쉬어요'}
        description={
          loss
            ? `${rest?.until ? `${formatKo(rest.until, { weekday: false })}까지 ` : ''}날짜 예상과 알림을 쉬어요. 끄면 기록한 생리부터 다시 예상해요.`
            : rest?.reason === 'vaccine'
              ? '접종 뒤 한 달이 지나고 첫 생리를 기록하면 다시 켜져요.'
              : '날짜 예상과 알림을 쉬어요. 다음 생리를 기록하면 다시 켜져요.'
        }
      />
    </Card>
  )
}
