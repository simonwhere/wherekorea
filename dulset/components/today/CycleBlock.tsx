'use client'

// Home block 1, "오늘의 주기": today's moment — one eyebrow, one title, the
// cycle ring (or the partner's week row), one sentence and one action
// (lib/logic/ttcFlow decides all of it per viewer; the copy is used as is).
// The card is always surface; only the quiet 'muted' moments (쉬는 주기, after
// a loss) sit on surface-2.

import { useCallback, useState } from 'react'
import type { TabKey } from '@/components/AppShell'
import { Card, cx, useToast } from '@/components/ui'
import { formatKo } from '@/lib/dates'
import { openLog } from '@/lib/logLauncher'
import { isSurge } from '@/lib/logic/cycle'
import { ringLegend, type LegendItem } from '@/lib/logic/cycleRing'
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
import CycleRing from './CycleRing'
import LossSupport from './LossSupport'
import { MonthlyTaskBody } from './MonthlyTask'
import OurWeekIdeas from './OurWeekIdeas'
import PregnancyConfirmSheet from './PregnancyConfirmSheet'
import WeekRow from './WeekRow'
import { ExternalLink, LinkButton, PillButton } from './bits'

type Nav = (tab: TabKey) => void

/** Keep "(예상)" on the line of the date it belongs to. */
const keepTogether = (text: string) => text.replace(/ \(예상\)/g, ' (예상)')

const EYEBROW: Record<Moment['tone'], string> = {
  default: 'text-ink-2',
  brand: 'text-brand-ink',
  fert: 'text-fert',
  muted: 'text-ink-2',
}

/** Notes up to this long sit with the body beside the ring; longer ones become a footnote. */
const NOTE_BESIDE_MAX = 45

/** The ring's own way to the calendar (the old "달력 보기" becomes this). */
const TO_CYCLE: MomentAction = { type: 'nav', to: 'cycle', label: '주기 보기' }

/** "가임기예요 (예상)" → the "(예상)" a size smaller, never on a line of its own. */
function Title({ text }: { text: string }) {
  const m = /^(.*) \(예상\)$/.exec(text)
  if (!m) return <>{keepTogether(text)}</>
  return (
    <>
      {keepTogether(m[1]!)}
      {' '}
      <small className="text-[15px] font-bold tracking-[-0.02em] text-ink-2">(예상)</small>
    </>
  )
}

function Legend({ items }: { items: LegendItem[] }) {
  if (!items.length) return null
  return (
    // mt-2: the ring's float already carries 4px of bottom margin, so the gap is the mockup's 12px.
    <ul aria-hidden className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] leading-4 text-ink-2">
      {items.map((i) => (
        <li key={i.key} className="inline-flex items-center gap-[5px]">
          {i.key === 'period' ? <span className="h-[9px] w-[9px] rounded-full bg-period" /> : null}
          {i.key === 'period-predicted' ? <span className="h-[9px] w-[9px] rounded-full bg-period/30" /> : null}
          {i.key === 'window' ? (
            <span className="h-[9px] w-4 rounded-full bg-gradient-to-r from-fert/[.34] to-fert/[.62]" />
          ) : null}
          {i.key === 'peak' ? <span className="h-[9px] w-[9px] rounded-full bg-fert" /> : null}
          {i.key === 'lh' ? (
            <>
              {i.lh?.surge ? <span className="h-[7px] w-[7px] rounded-full bg-fert" /> : null}
              {i.lh?.low ? <span className="h-[7px] w-[7px] rounded-full border-[1.6px] border-ink-3" /> : null}
            </>
          ) : null}
          {i.label}
        </li>
      ))}
    </ul>
  )
}

export default function CycleBlock({
  moment,
  task,
  onTaskDone,
  onNavigate,
  className,
}: {
  moment: Moment
  /** The partner's "이번 달 할 일", when this card features it. */
  task?: MonthlyTask
  /** [했어요] for the featured task (completeMonthlyTask, with 되돌리기). */
  onTaskDone?: (task: MonthlyTask) => void
  onNavigate: Nav
  className?: string
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
  const muted = m.tone === 'muted'
  // Boxes inside the card: surface-2 on a surface card, surface on a muted one.
  const inner = cx('mt-3.5 rounded-[18px] p-3.5', muted ? 'bg-surface' : 'bg-surface-2')
  // Period days 1–3: "수고했어요" first — no window on the ring (or its legend).
  const quietWindow = m.kind === 'period-early'

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

  const primary = m.primary
  const pending = m.kind === 'positive-pending' && m.role === 'owner'
  // "달력 보기" says the same as the ring's "주기 보기".
  const secondary = m.secondary?.type === 'nav' && m.secondary.to === 'cycle' && strip ? undefined : m.secondary
  const secondaryLink = secondary?.type === 'nav' ? secondary : undefined
  const secondaryPill = secondary && secondary.type !== 'nav' && !pending ? secondary : undefined
  // With a ring or week row there is always a way to the calendar.
  const cycleLink = strip ? TO_CYCLE : undefined
  // Right of the primary: a link (the moment's own, else 주기 보기), unless a second pill takes the row.
  const actionLink = primary && !secondaryPill && !pending ? (secondaryLink ?? cycleLink) : undefined
  // Without a primary, the one link sits at the right of the eyebrow row (as does
  // 주기 보기 when the action row is full: two pills, or the 병원 확인 전 buttons).
  const headerLink = pending || (primary && secondaryPill) ? cycleLink : !primary ? (secondaryLink ?? cycleLink) : undefined

  const legend = strip?.mode === 'cycle' ? ringLegend(strip, { quietWindow }) : []
  // A long caveat (the vaccine rest's sources) reads as a footnote under the
  // action, so the action keeps its place on the first screen.
  const footnote = !!m.note && m.note.length > NOTE_BESIDE_MAX
  const text = (
    <>
      <p className="text-[14.5px] leading-[1.55] tracking-[-0.01em] text-ink-2">{m.body}</p>
      {m.note && !footnote ? <p className="mt-[5px] text-[12.5px] leading-[1.5] text-ink-3">{m.note}</p> : null}
      {/* Today's LH result as a chip — unless the title already says it ("LH 양성이 나왔어요"). */}
      {m.todayLH && m.voice === 'explicit' && !(isSurge(m.todayLH) && m.title.startsWith('LH 양성')) ? (
        <p className="mt-2 inline-flex rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] font-semibold text-ink-2">
          오늘 기록 · LH {LH_LABEL[m.todayLH]}
        </p>
      ) : null}
    </>
  )

  return (
    <div className={cx('space-y-3', className)}>
      {/* The live-vaccine wait comes before any window talk. */}
      {hint ? <VaccineRestCard hint={hint} /> : null}
      <section
        aria-label="오늘의 주기"
        className={cx(
          'rounded-card border px-[18px] pb-[18px] pt-4 [@media(max-height:700px)]:pt-3.5',
          'border-transparent dark:border-line/70 forced-colors:border-line',
          muted ? 'bg-surface-2' : 'bg-surface shadow-warm dark:shadow-none',
        )}
      >
        <div className="flex min-h-[22px] items-center justify-between gap-2">
          <p className={cx('min-w-0 text-[12.5px] font-bold tracking-[-0.01em]', EYEBROW[m.tone])}>{m.eyebrow}</p>
          {headerLink ? (
            <LinkButton size="md" arrow onClick={() => run(headerLink)} className="-my-[11px] -mr-1 shrink-0 px-1">
              {headerLink.label}
            </LinkButton>
          ) : null}
        </div>
        {/* data-fold: what must stay above the tab bar on the first screen (useFoldFit). */}
        <h2
          data-fold={primary ? undefined : ''}
          className="mt-1 text-[23px] font-extrabold leading-[1.3] tracking-[-0.04em] text-ink"
        >
          <Title text={m.title} />
        </h2>

        {strip?.mode === 'cycle' ? (
          <>
            {/* The text wraps around the ring, so longer copy runs full width below it. */}
            <div className="mt-3 flow-root [@media(max-height:700px)]:mt-2.5">
              <CycleRing strip={strip} quietWindow={quietWindow} className="float-left mb-1 mr-3.5" />
              <div className="pt-0.5">{text}</div>
            </div>
            <Legend items={legend} />
          </>
        ) : (
          <>
            <div className="mt-1">{text}</div>
            {strip?.mode === 'weeks' ? <WeekRow strip={strip} /> : null}
          </>
        )}

        {featuredTask && onTaskDone ? (
          <MonthlyTaskBody task={featuredTask} onDone={onTaskDone} onNavigate={onNavigate} onSurface2={!muted} className={inner} />
        ) : null}

        {m.partnerTip ? (
          <p className={cx(inner, 'text-[13px] leading-[1.55] text-ink-2')}>
            <b className="font-bold text-ink">오늘 해 줄 수 있는 것</b> · {m.partnerTip}
          </p>
        ) : null}

        {m.dateIdeas ? <OurWeekIdeas className={cx('mt-3.5', muted ? 'bg-surface' : 'bg-surface-2')} /> : null}

        {m.askTell ? (
          <div className={inner}>
            <h3 className="text-[14.5px] font-extrabold tracking-[-0.02em] text-ink">{partner.name}님에게 알릴까요?</h3>
            <p className="mt-[3px] text-[12.5px] leading-[1.5] text-ink-3">‘이번 달은 쉬어 가요’라고 조용히 알려 드려요.</p>
            <div className="mt-3 flex gap-2">
              <PillButton size="md" className="min-w-0 flex-1" onClick={() => tellPeriod(m.askTell!.start)}>
                알리기
              </PillButton>
              <PillButton size="md" variant={muted ? 'soft' : 'surface'} className="min-w-0 flex-1" onClick={() => skipPeriod(m.askTell!.start)}>
                괜찮아요
              </PillButton>
            </div>
          </div>
        ) : null}

        {m.support ? <LossSupport heading={false} className={cx('mt-3.5 rounded-[18px] px-3.5 pb-3 pt-1', muted ? 'bg-surface' : 'bg-surface-2')} /> : null}

        {pending ? (
          later ? (
            <div className="mt-2 flex justify-end">
              <LinkButton size="md" onClick={() => setLater(false)}>
                할 일 다시 보기
              </LinkButton>
            </div>
          ) : (
            <>
              <div className="mt-4 space-y-2">
                {primary ? (
                  <div data-fold="">
                    <PillButton full onClick={() => run(primary)}>
                      {primary.label}
                    </PillButton>
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  {secondary ? (
                    <PillButton variant="soft" size="split" onClick={() => run(secondary)}>
                      {secondary.label}
                    </PillButton>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setLater(true)}
                    className="flex h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold text-ink-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    나중에
                  </button>
                </div>
              </div>
              {m.offerTellPositive ? (
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/75 pt-1">
                  <p className="text-[12.5px] text-ink-2">{partner.name}님에게도 알릴까요?</p>
                  <LinkButton size="md" onClick={tellPositive} className="shrink-0">
                    차분히 알리기
                  </LinkButton>
                </div>
              ) : null}
            </>
          )
        ) : primary ? (
          <div data-fold="" className="mt-4 flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1 [@media(max-height:700px)]:mt-3.5">
            {secondaryPill ? (
              <>
                <PillButton size="split" onClick={() => run(primary)}>
                  {primary.label}
                </PillButton>
                <PillButton size="split" variant={muted ? 'surface' : 'soft'} onClick={() => run(secondaryPill)}>
                  {secondaryPill.label}
                </PillButton>
              </>
            ) : (
              <>
                <PillButton icon={primary.type === 'log' ? 'plus' : undefined} onClick={() => run(primary)}>
                  {primary.label}
                </PillButton>
                {actionLink ? (
                  <LinkButton size="md" arrow onClick={() => run(actionLink)} className="-mr-1 shrink-0 px-1">
                    {actionLink.label}
                  </LinkButton>
                ) : null}
              </>
            )}
          </div>
        ) : secondaryPill ? (
          <PillButton variant="outline" full className="mt-3.5" onClick={() => run(secondaryPill)}>
            {secondaryPill.label}
          </PillButton>
        ) : null}

        {footnote ? <p className="mt-3 text-[12.5px] leading-[1.5] text-ink-3">{m.note}</p> : null}
      </section>

      <PregnancyConfirmSheet open={confirmOpen} onClose={closeConfirm} />
    </div>
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
    <Card tone="warn" className="rounded-card">
      <p className="text-[12.5px] font-bold text-warn">
        <span aria-hidden>💉 </span>최근 {hint.label} 항목을 챙겼어요
      </p>
      <p className="mt-1 text-sm leading-relaxed text-ink">
        접종했다면, 생백신이라 접종 뒤 {hint.wait}({formatKo(hint.until, { weekday: false })} 무렵까지)는 임신을 미루도록
        안내해요. 이번 주기는 쉬어 갈까요?
      </p>
      <div data-fold="" className="mt-3 flex gap-2">
        <PillButton size="md" className="min-w-0 flex-1" onClick={accept}>
          이번 주기는 쉬어요
        </PillButton>
        <PillButton size="md" variant="surface" className="min-w-0 flex-1" onClick={dismiss}>
          괜찮아요
        </PillButton>
      </div>
      <div className="-mb-2 mt-1 flex flex-wrap gap-x-3">
        <ExternalLink href="https://nip.kdca.go.kr/irhp/infm/goVcntInfo.do?menuLv=1&menuCd=1122">질병관리청 예방접종도우미</ExternalLink>
        <ExternalLink href="https://www.cdc.gov/vaccines-pregnancy/hcp/vaccination-guidelines/index.html">CDC 안내</ExternalLink>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">자세한 건 담당의와 확인하세요. 병원·보건소마다 안내가 조금씩 달라요.</p>
    </Card>
  )
}
