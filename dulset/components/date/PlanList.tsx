'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, EmptyState, SectionTitle, cx, useToast } from '@/components/ui'
import { DATE_IDEAS } from '@/lib/content/dateIdeas'
import { dLabel, formatKo, parts, weekdayKo } from '@/lib/dates'
import {
  acceptDatePlan,
  canMarkDone,
  isPlanAccepted,
  pastPlans,
  planIcsEvent,
  removeDatePlan,
  toggleDatePlanDone,
  upcomingPlans,
} from '@/lib/logic/dateIdeas'
import { buildIcs, downloadText } from '@/lib/logic/ics'
import { stampOn } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import type { DatePlan } from '@/lib/types'

const PAST_PAGE = 3

const btn =
  'inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
const btnSecondary = cx(btn, 'bg-surface-2 text-ink-2 hover:bg-line/60')

/** 우리 데이트 일정: upcoming plans first, then past ones. Shared by both phones. */
export default function PlanList({ onAdd }: { onAdd: () => void }) {
  const { state, today } = useApp()
  const [pastShown, setPastShown] = useState(PAST_PAGE)
  const upcoming = upcomingPlans(state, today)
  const past = pastPlans(state, today)

  return (
    <section className="mt-6">
      <SectionTitle
        sub="둘 중 누가 담아도 같이 보여요"
        action={
          <button type="button" onClick={onAdd} className={cx(btn, 'text-brand-ink hover:bg-brand-soft')}>
            ＋ 직접 추가
          </button>
        }
      >
        우리 데이트 일정
      </SectionTitle>

      {upcoming.length === 0 ? (
        <EmptyState
          icon="🗓️"
          title="아직 정한 데이트가 없어요"
          body="마음에 드는 아이디어에서 '일정에 담기'를 누르면 서로에게 제안이 가요."
        />
      ) : (
        <Card className="py-1">
          <ul className="divide-y divide-line/70">
            {upcoming.map((p) => (
              <PlanRow key={p.id} plan={p} />
            ))}
          </ul>
        </Card>
      )}

      {past.length > 0 ? (
        <div className="mt-4">
          <h3 className="mb-2 px-1 text-xs font-semibold text-ink-3">지난 데이트</h3>
          <Card tone="muted" className="py-1">
            <ul className="divide-y divide-line/70">
              {past.slice(0, pastShown).map((p) => (
                <PlanRow key={p.id} plan={p} />
              ))}
            </ul>
          </Card>
          {past.length > pastShown ? (
            <button
              type="button"
              onClick={() => setPastShown((n) => n + PAST_PAGE * 2)}
              className={cx(btn, 'mt-1 w-full text-ink-3 hover:bg-surface-2')}
            >
              지난 데이트 {past.length - pastShown}개 더 보기
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function PlanRow({ plan }: { plan: DatePlan }) {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const deleteRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  // Keyboard/screen-reader users land on the question, and back on 삭제 after 취소.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus()
    else if (returnFocus.current) {
      returnFocus.current = false
      deleteRef.current?.focus()
    }
  }, [confirming])
  const idea = plan.ideaId ? DATE_IDEAS.find((i) => i.id === plan.ideaId) : undefined
  const creator = state.couple.members.find((m) => m.id === plan.createdBy)
  const mine = plan.createdBy === me.id
  const isPast = plan.done || plan.date < today
  const { month, day } = parts(plan.date)
  const iAccepted = !mine && isPlanAccepted(state, plan.id, me.id)
  const partnerAccepted = mine && isPlanAccepted(state, plan.id, partner.id)

  const addToCalendar = () => {
    downloadText(`dulset-date-${plan.date}.ics`, buildIcs([planIcsEvent(plan)]))
    toast.show('캘린더 파일을 받았어요. 열면 일정에 추가돼요')
  }

  const cancelDelete = () => {
    returnFocus.current = true
    setConfirming(false)
  }

  const confirmDelete = () => {
    update((s) => removeDatePlan(s, plan.id))
    toast.show('일정을 지웠어요')
  }

  const writeDiary = () => {
    window.location.hash = 'diary'
    window.scrollTo({ top: 0 })
  }

  return (
    <li className="flex gap-3 py-3">
      <div
        className={cx(
          'flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl',
          isPast ? 'bg-surface text-ink-3' : 'bg-brand-soft text-brand-ink',
        )}
        aria-hidden
      >
        <span className="text-[10px] font-medium">{month}월</span>
        <span className="text-lg font-bold leading-tight tabular-nums">{day}</span>
        <span className="text-[10px]">{weekdayKo(plan.date)}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 pt-0.5">
            {!isPast ? (
              <span className="rounded-full bg-brand px-1.5 py-px text-[10px] font-bold tabular-nums text-white">
                {dLabel(plan.date, today)}
              </span>
            ) : null}
            <span className="text-[11px] text-ink-3">
              <span className="sr-only">{formatKo(plan.date)}, </span>
              {creator ? `${creator.name}님 제안` : null}
              {partnerAccepted ? ` · 👍 ${partner.name}님도 좋대요` : null}
            </span>
          </div>
          {confirming ? null : (
            <button
              ref={deleteRef}
              type="button"
              className="-mr-2 -mt-3 inline-flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-xl px-2 text-[11px] font-medium text-ink-3 hover:bg-surface-2"
              aria-label={`${plan.title} 일정 삭제`}
              onClick={() => setConfirming(true)}
            >
              삭제
            </button>
          )}
        </div>
        <p className={cx('mt-0.5 text-sm font-semibold', isPast && !plan.done ? 'text-ink-2' : 'text-ink')}>
          {idea ? <span aria-hidden>{idea.emoji} </span> : null}
          {plan.title}
        </p>
        {plan.place ? <p className="mt-0.5 truncate text-xs text-ink-2">📍 {plan.place}</p> : null}
        {plan.note ? <p className="mt-0.5 text-xs text-ink-3">“{plan.note}”</p> : null}

        {confirming ? (
          <div key="confirm" className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="일정 삭제 확인">
            <span className="text-xs text-ink-2">이 일정을 지울까요?</span>
            <button
              type="button"
              className={cx(btn, 'bg-period-soft text-period hover:bg-period/15')}
              onClick={confirmDelete}
            >
              지우기
            </button>
            <button ref={cancelRef} type="button" className={btnSecondary} onClick={cancelDelete}>
              취소
            </button>
          </div>
        ) : (
          <div key="actions" className="mt-2 flex flex-wrap gap-1.5">
            {!isPast && !mine ? (
              iAccepted ? (
                <span className="inline-flex min-h-[44px] items-center px-1 text-xs font-medium text-ok">
                  👍 좋다고 전했어요
                </span>
              ) : (
                <button
                  type="button"
                  className={cx(btn, 'bg-brand text-white hover:bg-brand/90')}
                  onClick={() => {
                    update((s) => acceptDatePlan(s, plan.id, me.id, stampOn(today)))
                    toast.show(`${partner.name}님에게 좋다고 전했어요`)
                  }}
                >
                  👍 좋아요
                </button>
              )
            ) : null}
            {plan.done || canMarkDone(plan, today) ? (
              <button
                type="button"
                aria-pressed={plan.done}
                className={cx(
                  btn,
                  plan.done ? 'bg-ok-soft text-ok hover:bg-ok/15' : 'bg-surface-2 text-ink hover:bg-line/60',
                )}
                onClick={() => update((s) => toggleDatePlanDone(s, plan.id))}
              >
                다녀왔어요 ✓
              </button>
            ) : null}
            {!isPast ? (
              <button type="button" className={btnSecondary} onClick={addToCalendar}>
                📅 캘린더에 추가
              </button>
            ) : null}
            {plan.done ? (
              <button
                type="button"
                className={cx(btn, 'bg-brand-soft text-brand-ink hover:bg-brand/15')}
                onClick={writeDiary}
              >
                📔 기록으로 남기기
              </button>
            ) : null}
          </div>
        )}
      </div>
    </li>
  )
}
