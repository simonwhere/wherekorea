'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Card, EmptyState, SectionTitle, cx, useToast } from '@/components/ui'
import { dLabel, formatKo, parts, weekdayKo } from '@/lib/dates'
import {
  APPOINTMENT_KIND_EMOJI,
  APPOINTMENT_KIND_LABEL,
  appointmentIcsEvent,
  pastAppointments,
  removeAppointment,
  upcomingAppointments,
} from '@/lib/logic/appointments'
import { buildIcs, downloadText } from '@/lib/logic/ics'
import { useApp } from '@/lib/store'
import type { Appointment } from '@/lib/types'
import { Owners, btnBrand, btnDanger, btnSecondary } from './bits'
import { ownerText, usableAppointments } from '@/lib/logic/plan'

const PAST_PAGE = 3

/** '다녀왔어요' for visits, '했어요' for applications and the rest. */
function doneLabel(a: Pick<Appointment, 'kind'>): string {
  return a.kind === 'admin' || a.kind === 'other' ? '했어요' : '다녀왔어요'
}

/** 다가오는 일정: shared hospital / test / admin appointments. */
export default function AppointmentList({
  onAdd,
  onEdit,
  onDone,
}: {
  onAdd: () => void
  onEdit: (a: Appointment) => void
  /** Mark done / not done (also ticks the linked 챙길 것 item). */
  onDone: (a: Appointment, done: boolean) => void
}) {
  const { state, today } = useApp()
  const [showPast, setShowPast] = useState(false)
  const [pastShown, setPastShown] = useState(PAST_PAGE)
  const pastId = useId()
  const list = usableAppointments(state.appointments)
  const upcoming = upcomingAppointments(list, today)
  const past = pastAppointments(list, today)

  return (
    <section className="mt-6" aria-labelledby={`${pastId}-title`}>
      <SectionTitle
        sub="둘 중 누가 추가해도 같이 보여요"
        action={
          <button type="button" onClick={onAdd} className={btnBrand}>
            ＋ 일정 추가
          </button>
        }
      >
        <span id={`${pastId}-title`}>다가오는 일정</span>
      </SectionTitle>

      {upcoming.length === 0 ? (
        <EmptyState
          icon="🗓️"
          title="잡아 둔 병원·검사 일정이 없어요"
          body="아래 목록의 ‘일정 잡기’나 ‘일정 추가’로 잡아 두면, 전날과 당일에 가는 사람에게 알림이 가요."
        />
      ) : (
        <Card className="py-1">
          <ul className="divide-y divide-line/70">
            {upcoming.map((a) => (
              <AppointmentRow key={a.id} appt={a} onEdit={onEdit} onDone={onDone} />
            ))}
          </ul>
        </Card>
      )}

      {past.length > 0 ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={showPast}
            aria-controls={pastId}
            className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl px-2 text-left text-xs font-medium text-ink-3 hover:bg-surface-2"
          >
            <span>{showPast ? '지난 일정 접기' : `지난·다녀온 일정 ${past.length}개 보기`}</span>
            <span aria-hidden className={cx('transition-transform', showPast && 'rotate-180')}>
              ▾
            </span>
          </button>
          <div id={pastId} hidden={!showPast}>
            <Card tone="muted" className="py-1">
              <ul className="divide-y divide-line/70">
                {past.slice(0, pastShown).map((a) => (
                  <AppointmentRow key={a.id} appt={a} onEdit={onEdit} onDone={onDone} past />
                ))}
              </ul>
            </Card>
            {past.length > pastShown ? (
              <button
                type="button"
                onClick={() => setPastShown((n) => n + PAST_PAGE * 2)}
                className="mt-1 flex min-h-[44px] w-full items-center justify-center rounded-xl text-xs font-semibold text-ink-3 hover:bg-surface-2"
              >
                지난 일정 {past.length - pastShown}개 더 보기
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function AppointmentRow({
  appt,
  onEdit,
  onDone,
  past,
}: {
  appt: Appointment
  onEdit: (a: Appointment) => void
  onDone: (a: Appointment, done: boolean) => void
  past?: boolean
}) {
  const { state, update, today } = useApp()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const deleteRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  useEffect(() => {
    if (confirming) cancelRef.current?.focus()
    else if (returnFocus.current) {
      returnFocus.current = false
      deleteRef.current?.focus()
    }
  }, [confirming])

  const members = state.couple.members
  const owners = appt.who === 'both' ? members.map((m) => m.id) : [appt.who]
  const { month, day } = parts(appt.date)

  const addToCalendar = () => {
    downloadText(`dulset-${appt.date}.ics`, buildIcs([appointmentIcsEvent(appt, state.settings.discreet)]))
    toast.show('캘린더 파일을 받았어요. 열면 일정에 추가돼요')
  }

  return (
    <li className="flex gap-3 py-3 pl-3 pr-2">
      <div
        aria-hidden
        className={cx(
          'flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl',
          past ? 'bg-surface text-ink-3' : 'bg-brand-soft text-brand-ink',
        )}
      >
        <span className="text-[10px] font-medium">{month}월</span>
        <span className="text-lg font-bold leading-tight tabular-nums">{day}</span>
        <span className="text-[10px]">{weekdayKo(appt.date)}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 pt-0.5">
            {!past ? (
              <span className="rounded-full bg-brand px-1.5 py-px text-[10px] font-bold tabular-nums text-white">
                {dLabel(appt.date, today)}
              </span>
            ) : null}
            <span className="text-[11px] text-ink-3">
              <span className="sr-only">{formatKo(appt.date)}, </span>
              {appt.time ? `${appt.time} · ` : ''}
              {APPOINTMENT_KIND_LABEL[appt.kind]}
              {appt.done ? ` · ${doneLabel(appt)} ✓` : ''}
            </span>
          </div>
          {confirming ? null : (
            <button
              ref={deleteRef}
              type="button"
              className="-mr-1 -mt-3 inline-flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-xl px-2 text-[11px] font-medium text-ink-3 hover:bg-surface-2"
              aria-label={`${appt.title} 일정 삭제`}
              onClick={() => setConfirming(true)}
            >
              삭제
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onEdit(appt)}
          className="-my-1.5 flex min-h-[44px] w-full items-center text-left text-sm font-semibold text-ink hover:underline hover:underline-offset-2"
          aria-label={`${appt.title} 일정 고치기`}
        >
          <span aria-hidden className="mr-1">
            {APPOINTMENT_KIND_EMOJI[appt.kind]}
          </span>
          <span className={cx('min-w-0', past && 'text-ink-2')}>{appt.title}</span>
        </button>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Owners owners={owners} members={members} label={ownerText(owners, members)} />
          {appt.place ? <span className="min-w-0 truncate text-xs text-ink-2">📍 {appt.place}</span> : null}
        </div>
        {appt.note ? <p className="mt-0.5 text-xs text-ink-3">“{appt.note}”</p> : null}

        {confirming ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="일정 삭제 확인">
            <span className="text-xs text-ink-2">이 일정을 지울까요?</span>
            <button
              type="button"
              className={btnDanger}
              onClick={() => {
                update((s) => removeAppointment(s, appt.id))
                toast.show('일정을 지웠어요')
              }}
            >
              지우기
            </button>
            <button
              ref={cancelRef}
              type="button"
              className={btnSecondary}
              onClick={() => {
                returnFocus.current = true
                setConfirming(false)
              }}
            >
              취소
            </button>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {!past ? (
              <button type="button" className={btnSecondary} onClick={addToCalendar}>
                <span aria-hidden>📅</span> 캘린더에 추가
              </button>
            ) : null}
            <button
              type="button"
              aria-pressed={!!appt.done}
              className={cx(btnSecondary, appt.done && 'bg-ok-soft text-ink-2')}
              onClick={() => onDone(appt, !appt.done)}
            >
              {doneLabel(appt)} ✓
            </button>
          </div>
        )}
      </div>
    </li>
  )
}
