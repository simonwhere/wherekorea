'use client'

// Home block 3 "우리 한 줄": the partner's month task (first, for the partner),
// the other person's progress with 콕 / 응원, and then (Now 3 N21):
//  • '이번 주 민수님' on the cycle owner's home — up to three things he did this
//    week (weekTogether.partnerWeekSummary) and [고마워요] once a week
//    (thankWeek + one 🔔 through sendWeekThanks). A week with nothing in it shows no
//    line and no button (positioning §4 rule 2: never a 0, never '안 했어요'),
//    and the whole thing rests in the quiet after a loss (the summary is empty).
//  • a received signal to answer, and the other person's reply to mine
//    (model.receivedReply) — so an answer shows on the home, not only as a 🔔;
//  • '신호 보내기' as one compact row (signals/SignalChips), out of 더 보기.

import type { TabKey } from '@/components/AppShell'
import { cx, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { addDays, formatKo, isISODate, weekdayKo } from '@/lib/dates'
import type { MonthlyTask } from '@/lib/logic/partnerTrack'
import { canNudge as nudgeAllowed, sendCheer, sendNudge, sendWeekThanks, WEEK_THANKS_BODY } from '@/lib/logic/notifications'
import { canLogCycle } from '@/lib/logic/prefs'
import { pendingSignal } from '@/lib/logic/signals'
import { stampOn } from '@/lib/logic/today'
import { canThankWeek, partnerWeekSummary, thankWeek, weekOf, weekThanked } from '@/lib/logic/weekTogether'
import { useApp } from '@/lib/store'
import type { ISODate } from '@/lib/types'
import { PendingSignal, SignalChips, timeKo } from '@/components/signals/SignalsCard'
import { dailyProgress, nudgeTarget, receivedReply, type ReceivedReply } from './model'
import { MonthlyTaskBody } from './MonthlyTask'
import { MemberBubble } from './bits'

const small =
  "relative inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-surface-2 px-3 text-[13px] font-bold text-ink-2 transition-colors before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] hover:bg-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"

/** Up to this many progress segments; more items read better as the number alone. */
const DOTS_MAX = 6

/** What the 🔔 that goes with [고마워요] says (notifications.WEEK_THANKS_BODY). */
export const WEEK_THANKS_MESSAGE = WEEK_THANKS_BODY

export default function UsLine({
  task,
  onTaskDone,
  onNavigate,
  className,
}: {
  task?: MonthlyTask
  /** [했어요] for the month task (completeMonthlyTask, with 되돌리기). */
  onTaskDone: (task: MonthlyTask) => void
  onNavigate: (tab: TabKey) => void
  className?: string
}) {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const prog = dailyProgress(state, partner.id, today)
  const target = nudgeTarget(state, partner.id, today)
  // No 콕 button once today's are used — or at all for a partner who turned 콕 받기 off (Next B).
  const canNudge = !!target && nudgeAllowed(state, me.id, partner.id, today)
  // A signal to answer — with 해 줄 말 · 아껴 둘 말 when she sent it to him (PendingSignal, N30).
  const pending = pendingSignal(state, me.id, today)
  const reply = receivedReply(state, me.id, today)

  // '이번 주 민수님' is the cycle owner's line about the partner's week.
  const owner = canLogCycle(state, me.id)
  const week = owner ? partnerWeekSummary(state, today, partner.id) : []
  const thankedOn = owner ? weekThanked(state, me.id, weekOf(today)) : undefined
  const canThank = owner && canThankWeek(state, me.id, today)

  const nudge = () => {
    if (!canNudge) return
    update((s) => sendNudge(s, me.id, partner.id, today, stampOn(today), target?.label))
    toast.show(`${partner.name}님에게 콕! 보냈어요`)
  }
  const cheer = () => {
    update((s) => sendCheer(s, me.id, partner.id, stampOn(today)))
    toast.show(`${partner.name}님에게 응원을 보냈어요`)
  }
  const thank = () => {
    if (!canThank) return
    const at = stampOn(today)
    // Once a week: remembered for the week (his card keeps '고마워했어요'), plus one 🔔
    // '💛 지은님이 고마워했어요' keyed by the week, so a second tap adds nothing.
    update((s) => {
      const next = thankWeek(s, me.id, today)
      return next === s ? s : sendWeekThanks(next, me.id, partner.id, today, at)
    })
    toast.show(`${partner.name}님에게 고마운 마음을 전했어요`)
  }

  const dot = partner.tracksCycle ? 'bg-her' : 'bg-him'
  const soft = partner.tracksCycle ? 'bg-her-soft' : 'bg-him-soft'

  return (
    // id="us-line": the cover's "답하기" scrolls here (html's scroll-padding clears the sticky header).
    <section id="us-line" aria-labelledby="us-line-title" className={className}>
      <h2 id="us-line-title" className="mb-1.5 px-0.5 text-[17px] font-extrabold tracking-[-0.03em] text-ink">
        우리 한 줄
      </h2>
      <div className="rounded-[22px] border border-transparent bg-surface px-3.5 pb-3.5 pt-3 shadow-warm dark:border-line/70 dark:shadow-none forced-colors:border-line">
        {task ? (
          <MonthlyTaskBody
            task={task}
            onDone={onTaskDone}
            onNavigate={onNavigate}
            className="mb-3 border-b border-line/75 pb-2"
          />
        ) : null}

        <div className="flex min-h-12 items-center gap-2.5">
          <MemberBubble member={partner} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold tracking-[-0.02em] text-ink">{partner.name}님</p>
            {/* No '0' about the other person (positioning §4 rule 2): the count appears once something is done. */}
            {prog.total > 0 && prog.done > 0 ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
                <span className="tabular-nums">
                  오늘 {prog.done}/{prog.total}
                </span>
                {prog.complete ? <span className="text-ok">완료</span> : null}
                {prog.total <= DOTS_MAX ? (
                  <span aria-hidden className="inline-flex gap-[3px]">
                    {Array.from({ length: prog.total }, (_, i) => (
                      <i key={i} className={cx('h-[5px] w-3.5 rounded-full', i < prog.done ? dot : 'bg-line')} />
                    ))}
                  </span>
                ) : null}
              </p>
            ) : prog.total === 0 ? (
              <p className="mt-0.5 text-[12.5px] text-ink-3">체크 항목 없음</p>
            ) : null}
          </div>
          {canNudge ? (
            <button type="button" onClick={nudge} className={small} aria-label={`${partner.name}님에게 콕 찌르기 (${target!.label})`}>
              <span aria-hidden>👉</span> 콕
            </button>
          ) : null}
          <button type="button" onClick={cheer} className={small}>
            <span aria-hidden>👏</span> 응원
          </button>
        </div>

        {week.length ? (
          <div className="mt-3 border-t border-line/75 pt-3" data-week-summary>
            <div className="flex min-h-9 items-center gap-2">
              <p className="min-w-0 flex-1 text-[13.5px] font-bold tracking-[-0.02em] text-ink">이번 주 {partner.name}님</p>
              {canThank ? (
                <button type="button" onClick={thank} className={small} aria-label={`${partner.name}님에게 이번 주 고마워요`}>
                  <Icon name="heart" className="h-4 w-4 text-her" strokeWidth={2.2} /> 고마워요
                </button>
              ) : thankedOn ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-ink-3">
                  <Icon name="heart" className="h-3.5 w-3.5 fill-current text-her" strokeWidth={1.5} />
                  고마워요를 전했어요 ({weekdayKo(thankedOn)})
                </span>
              ) : null}
            </div>
            <ul aria-label={`이번 주 ${partner.name}님이 한 것`} className="mt-1.5 flex flex-wrap gap-1.5">
              {week.map((d) => (
                <li
                  key={d.kind}
                  className={cx('inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-ink', soft)}
                >
                  <Icon name="check" className="h-3.5 w-3.5 shrink-0 text-ok" strokeWidth={2.6} />
                  {d.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {pending ? (
          <div className="mt-3 border-t border-line/75 pt-3">
            <PendingSignal />
          </div>
        ) : null}

        {reply ? <ReplyLine reply={reply} today={today} className="mt-3 border-t border-line/75 pt-3" /> : null}

        <SignalChips className="mt-3 border-t border-line/75 pt-3" />
      </div>
    </section>
  )
}

/**
 * '오후 6:12' today, '어제 오후 6:12', '그저께', else '10월 5일 (월)' — an
 * unread reply applied after her phone was closed for days (signals.REPLY_UNSEEN_DAYS).
 */
function whenKo(at: string, today: ISODate): string {
  const day = at.slice(0, 10)
  if (day === today) return timeKo(at)
  if (day === addDays(today, -1)) return `어제 ${timeKo(at)}`.trim()
  if (day === addDays(today, -2)) return '그저께'
  return isISODate(day) ? formatKo(day) : ''
}

/** The other person's answer to my signal: who, when, to what, and the reply as a bubble in their colour. */
function ReplyLine({ reply, today, className }: { reply: ReceivedReply; today: ISODate; className?: string }) {
  const { state } = useApp()
  const sender = state.couple.members.find((m) => m.id === reply.from)
  const when = whenKo(reply.at, today)
  return (
    <div className={className} data-received-reply>
      <p className="text-xs font-semibold text-ink-3">
        {sender ? `${sender.name}님이 답했어요` : '답장이 왔어요'}
        {when ? ` · ${when}` : ''}
        {reply.answered ? <span className="font-normal"> · ‘{reply.answered.text}’에</span> : null}
      </p>
      <p
        className={cx(
          'mt-1.5 inline-block rounded-[18px_18px_18px_6px] px-3.5 py-2.5 text-[15px] font-bold tracking-[-0.02em] text-ink',
          sender?.tracksCycle ? 'bg-her-soft' : 'bg-him-soft',
        )}
      >
        <span aria-hidden>{reply.reply.emoji} </span>
        {reply.reply.text}
      </p>
    </div>
  )
}
