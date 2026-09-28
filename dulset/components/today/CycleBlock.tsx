'use client'

// Home block 1: the cycle strip + today's moment — one title, one sentence,
// one primary action (lib/logic/ttcFlow decides all of it per viewer).

import { useCallback, useState } from 'react'
import type { TabKey } from '@/components/AppShell'
import { Button, Card, cx, useToast } from '@/components/ui'
import { formatKo } from '@/lib/dates'
import { openLog } from '@/lib/logLauncher'
import type { MonthlyTask } from '@/lib/logic/partnerTrack'
import { canLogCycle } from '@/lib/logic/prefs'
import { stampOn } from '@/lib/logic/today'
import {
  LH_LABEL,
  acceptVaccineRest,
  cycleStrip,
  dismissVaccineRest,
  endRestFromHome,
  skipTellPartnerPeriod,
  tellPartnerPeriod,
  tellPartnerPositive,
  vaccineRestHint,
  type Moment,
  type MomentAction,
  type VaccineRestHint,
} from '@/lib/logic/ttcFlow'
import { useApp } from '@/lib/store'
import CycleStrip from './CycleStrip'
import LossSupport from './LossSupport'
import { MonthlyTaskBody } from './MonthlyTask'
import OurWeekIdeas from './OurWeekIdeas'
import PregnancyConfirmSheet from './PregnancyConfirmSheet'
import { ExternalLink, LinkButton } from './bits'

type Nav = (tab: TabKey) => void

/** Keep "(예상)" on the line of the date it belongs to. */
const keepTogether = (text: string) => text.replace(/ \(예상\)/g, '\u00a0(예상)')

const TONE_BG: Record<Moment['tone'], string> = {
  default: '',
  brand: 'bg-brand-soft',
  fert: 'bg-fert-soft',
  muted: 'bg-surface-2',
}

const EYEBROW: Record<Moment['tone'], string> = {
  default: 'text-ink-2',
  brand: 'text-brand-ink',
  fert: 'text-fert',
  muted: 'text-ink-2',
}

export default function CycleBlock({
  moment,
  task,
  onTaskDone,
  onNavigate,
}: {
  moment: Moment
  /** The partner's "이번 달 할 일", when this card features it. */
  task?: MonthlyTask
  /** [했어요] for the featured task (completeMonthlyTask, with 되돌리기). */
  onTaskDone?: (task: MonthlyTask) => void
  onNavigate: Nav
}) {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Stable, so the Sheet's open effect doesn't re-run (and refocus) on every state change.
  const closeConfirm = useCallback(() => setConfirmOpen(false), [])
  const [later, setLater] = useState(false)
  const strip = cycleStrip(state, today, me.id)
  const hint = vaccineRestHint(state, today, me.id)
  const m = moment
  const featuredTask = m.monthlyTask ? task : undefined

  const run = (a: MomentAction) => {
    switch (a.type) {
      case 'log':
        // Only the person whose cycle it is logs periods, LH and tests.
        if (canLogCycle(state, me.id)) openLog({ kind: a.kind })
        return
      case 'nav':
        onNavigate(a.to)
        return
      case 'end-rest':
        update((s) => endRestFromHome(s, today, stampOn(today)))
        toast.show('다시 켰어요. 예상과 알림이 돌아와요')
        return
      case 'confirm-pregnancy':
        setConfirmOpen(true)
    }
  }

  const tellPeriod = (start: string) => {
    update((s) => tellPartnerPeriod(s, start, stampOn(today)))
    toast.show(`${partner.name}님에게 조용히 알렸어요`)
  }
  const skipPeriod = (start: string) => update((s) => skipTellPartnerPeriod(s, start, stampOn(today)))
  const tellPositive = () => {
    update((s) => tellPartnerPositive(s, stampOn(today)))
    toast.show(`${partner.name}님에게 차분히 알렸어요`)
  }

  // A featured month task brings its own [했어요] and 챙길 것 link.
  const primary = m.primary
  // The strip header already links to 주기.
  const secondary = m.secondary?.type === 'nav' && m.secondary.to === 'cycle' && strip ? undefined : m.secondary
  const secondaryIsLink = secondary?.type === 'nav'
  // A lone link (달력 보기, 아이디어 더 보기 …) sits in the eyebrow row, not a row of its own.
  const headerLink = !primary && secondaryIsLink && m.kind !== 'positive-pending' ? secondary : undefined
  const stripTitle =
    strip?.mode === 'cycle' ? `주기 ${strip.cycleDay}일째` : strip?.mode === 'weeks' ? '이번 주 · 다음 주' : null

  return (
    <>
      {/* The live-vaccine wait comes before any window talk. */}
      {hint ? <VaccineRestCard hint={hint} /> : null}
      <section aria-label="오늘의 주기" className="overflow-hidden rounded-xl2 border border-line bg-surface shadow-card">
        {strip ? (
          <div className="border-b border-line/70 px-4 pb-3 pt-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-ink-2">{stripTitle}</p>
              <LinkButton onClick={() => onNavigate('cycle')} className="-mr-1 shrink-0">
                주기 <span aria-hidden>→</span>
              </LinkButton>
            </div>
            <CycleStrip strip={strip} />
          </div>
        ) : null}

        <div className={cx('px-4 pb-4 pt-3.5', TONE_BG[m.tone])}>
          {m.eyebrow || headerLink ? (
            <div className={cx('flex items-center justify-between gap-2', headerLink && '-my-2.5')}>
              <p className={cx('min-w-0 text-xs font-semibold', EYEBROW[m.tone])}>{m.eyebrow}</p>
              {headerLink ? (
                <LinkButton onClick={() => run(headerLink)} className="-mr-1 shrink-0">
                  {headerLink.label} <span aria-hidden>→</span>
                </LinkButton>
              ) : null}
            </div>
          ) : null}
          <h2 className="mt-0.5 text-xl font-extrabold leading-snug tracking-tight text-ink">{keepTogether(m.title)}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{m.body}</p>
          {m.note ? <p className="mt-1 text-xs leading-relaxed text-ink-3">{m.note}</p> : null}
          {m.todayLH && m.voice === 'explicit' ? (
            <p className="mt-2 inline-flex rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-2">
              오늘 기록 · LH {LH_LABEL[m.todayLH]}
            </p>
          ) : null}

          {featuredTask && onTaskDone ? (
            <MonthlyTaskBody
              task={featuredTask}
              onDone={onTaskDone}
              onNavigate={onNavigate}
              className="mt-3 rounded-xl bg-surface-2 px-3 pb-1 pt-2.5"
            />
          ) : null}

          {m.partnerTip ? (
            <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-2">
              <b className="font-semibold text-ink">오늘 해 줄 수 있는 것</b> · {m.partnerTip}
            </p>
          ) : null}

          {m.dateIdeas ? <OurWeekIdeas /> : null}

          {m.askTell ? (
            <div className="mt-3 rounded-xl bg-surface-2 p-3">
              <p className="text-sm font-semibold text-ink">{partner.name}님에게 알릴까요?</p>
              <p className="mt-0.5 text-xs text-ink-3">‘이번 달은 쉬어 가요’라고 조용히 알려 드려요.</p>
              <div className="mt-2 flex gap-2">
                <Button className="flex-1" onClick={() => tellPeriod(m.askTell!.start)}>
                  알리기
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => skipPeriod(m.askTell!.start)}>
                  괜찮아요
                </Button>
              </div>
            </div>
          ) : null}

          {m.support ? <LossSupport className="mt-3 rounded-xl bg-surface px-3 pb-1 pt-2.5" /> : null}

          {m.kind === 'positive-pending' && m.role === 'owner' ? (
            later ? (
              <LinkButton onClick={() => setLater(false)}>할 일 다시 보기</LinkButton>
            ) : (
              <>
                <div className="mt-3 space-y-2">
                  {primary ? (
                    <Button full onClick={() => run(primary)}>
                      {primary.label}
                    </Button>
                  ) : null}
                  <div className="flex gap-2">
                    {secondary ? (
                      <Button variant="secondary" className="flex-[2]" onClick={() => run(secondary)}>
                        {secondary.label}
                      </Button>
                    ) : null}
                    <Button variant="ghost" className="flex-1" onClick={() => setLater(true)}>
                      나중에
                    </Button>
                  </div>
                </div>
                {m.offerTellPositive ? (
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-brand/15 pt-1">
                    <p className="text-xs text-ink-2">{partner.name}님에게도 알릴까요?</p>
                    <LinkButton onClick={tellPositive} className="shrink-0">
                      차분히 알리기
                    </LinkButton>
                  </div>
                ) : null}
              </>
            )
          ) : primary || (secondary && !headerLink) ? (
            <div className={cx('mt-3 flex items-center gap-2', !primary && 'justify-end')}>
              {primary ? (
                <Button className="flex-[2]" onClick={() => run(primary)}>
                  {primary.label}
                </Button>
              ) : null}
              {secondary ? (
                secondaryIsLink ? (
                  <LinkButton onClick={() => run(secondary)} className="shrink-0 px-1">
                    {secondary.label} <span aria-hidden>→</span>
                  </LinkButton>
                ) : (
                  <Button variant="secondary" className="flex-1" onClick={() => run(secondary)}>
                    {secondary.label}
                  </Button>
                )
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <PregnancyConfirmSheet open={confirmOpen} onClose={closeConfirm} />
    </>
  )
}

/** After MMR·수두: suggest a rest cycle, with the 4주 / 1개월 guidance and its sources. */
function VaccineRestCard({ hint }: { hint: VaccineRestHint }) {
  const { update, today } = useApp()
  const toast = useToast()
  const accept = () => {
    update((s) => acceptVaccineRest(s, hint))
    toast.show('이번 주기는 쉬어요. 날짜 예상과 알림을 잠시 꺼 둘게요')
  }
  const dismiss = () => update((s) => dismissVaccineRest(s, hint, stampOn(today)))
  return (
    <Card tone="warn">
      <p className="text-xs font-semibold text-warn">
        <span aria-hidden>💉 </span>최근 {hint.label} 항목을 챙겼어요
      </p>
      <p className="mt-1 text-sm leading-relaxed text-ink">
        접종했다면, 생백신이라 접종 뒤 {hint.wait}({formatKo(hint.until, { weekday: false })} 무렵까지)는 임신을 미루도록
        안내해요. 이번 주기는 쉬어 갈까요?
      </p>
      <div className="mt-3 flex gap-2">
        <Button className="flex-1" onClick={accept}>
          이번 주기는 쉬어요
        </Button>
        <Button variant="secondary" className="flex-1" onClick={dismiss}>
          괜찮아요
        </Button>
      </div>
      <div className="-mb-2 mt-1 flex flex-wrap gap-x-3">
        <ExternalLink href="https://nip.kdca.go.kr/irhp/infm/goVcntInfo.do?menuLv=1&menuCd=1122">질병관리청 예방접종도우미</ExternalLink>
        <ExternalLink href="https://www.cdc.gov/vaccines-pregnancy/hcp/vaccination-guidelines/index.html">CDC 안내</ExternalLink>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">자세한 건 담당의와 확인하세요. 병원·보건소마다 안내가 조금씩 달라요.</p>
    </Card>
  )
}
