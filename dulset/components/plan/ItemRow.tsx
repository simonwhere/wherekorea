'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cx } from '@/components/ui'
import { formatShort, isISODate } from '@/lib/dates'
import { useApp } from '@/lib/store'
import type { Appointment } from '@/lib/types'
import { CheckBox, ExternalLink, Owners, Pill, btnDanger, btnGhost, btnSecondary } from './bits'
import {
  KIND_EMOJI,
  canSchedule,
  countdown,
  dateText,
  isShared,
  linkedAppointment,
  ownerText,
  shortDate,
  statusPill,
  type PlanItem,
} from '@/lib/logic/plan'

export interface ItemActions {
  onToggle: (item: PlanItem) => void
  onSchedule: (item: PlanItem) => void
  onOpenAppointment: (a: Appointment) => void
  onDeleteCustom: (item: PlanItem) => void
}

/**
 * One roadmap row: tick, what, who, when. The full list rows open for the
 * detail, sources and "일정 잡기"; the focus card uses the compact form.
 */
export default function ItemRow({ item, compact, actions }: { item: PlanItem; compact?: boolean; actions: ItemActions }) {
  const { state, today } = useApp()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const detailId = useId()
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
  const done = item.status === 'done'
  const pill = statusPill(item, state.stage)
  const cd = countdown(item, today)
  const appt = linkedAppointment(state.appointments, item.id, today)
  const t = item.template
  const doneByName = item.doneBy ? members.find((m) => m.id === item.doneBy)?.name : undefined
  const when = item.start ? dateText(item, today) : item.custom ? '날짜 없음' : item.when

  return (
    <li
      className={cx('flex gap-3 rounded-xl px-2 py-2.5', item.status === 'overdue' && !compact && 'bg-warn-soft')}
    >
      <div className="pt-0.5">
        <CheckBox
          checked={done}
          onToggle={() => actions.onToggle(item)}
          label={`${item.title} 챙김`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {pill ? <Pill tone={pill.tone}>{pill.label}</Pill> : null}
          <span className={cx('text-[11px] font-medium tabular-nums', item.status === 'now' ? 'text-brand-ink' : 'text-ink-3')}>
            {when}
          </span>
          {cd ? (
            <span
              className={cx(
                'text-[11px] font-semibold tabular-nums',
                item.status === 'overdue' || item.deadline ? 'text-ink' : 'text-ink-3',
              )}
            >
              · {cd}
            </span>
          ) : null}
        </div>
        <p className={cx('mt-0.5 text-sm font-semibold leading-snug', done ? 'text-ink-3 line-through' : 'text-ink')}>
          <span aria-hidden className="mr-1">
            {KIND_EMOJI[item.kind]}
          </span>
          {item.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Owners owners={item.owners} members={members} label={ownerText(item.owners, members)} />
          {done && isISODate(item.doneAt) ? (
            <span className="text-[11px] font-medium text-ok">
              ✓ {formatShort(item.doneAt)}
              {doneByName ? ` ${doneByName}` : ''} 챙김
            </span>
          ) : null}
          {t?.deadline && !done ? <span className="text-[11px] font-medium text-ink-2">📌 기한 있음</span> : null}
          {appt && !done ? (
            <button
              type="button"
              onClick={() => actions.onOpenAppointment(appt)}
              className="-my-3 inline-flex min-h-[44px] items-center text-[11px] font-semibold text-brand-ink underline-offset-2 hover:underline"
            >
              📅 {shortDate(appt.date, today)}
              {appt.time ? ` ${appt.time}` : ''} 예약됨
            </button>
          ) : null}
        </div>

        {compact ? null : (
          <>
            <div className="-mb-2 -mt-0.5 flex flex-wrap gap-x-1">
              {item.detail ? (
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  aria-expanded={open}
                  aria-controls={detailId}
                  className={cx(btnGhost, '-ml-3')}
                >
                  {open ? '접기' : '자세히'}
                  <span aria-hidden className={cx('transition-transform', open && 'rotate-180')}>
                    ▾
                  </span>
                </button>
              ) : null}
              {canSchedule(item) && !appt ? (
                <button type="button" onClick={() => actions.onSchedule(item)} className={cx(btnGhost, item.detail ? '' : '-ml-3')}>
                  <span aria-hidden>📅</span> 일정 잡기
                </button>
              ) : null}
              {item.custom && !confirming ? (
                <button
                  ref={deleteRef}
                  type="button"
                  onClick={() => setConfirming(true)}
                  className={btnGhost}
                  aria-label={`${item.title} 지우기`}
                >
                  지우기
                </button>
              ) : null}
            </div>

            {confirming ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="직접 추가한 항목 지우기 확인">
                <span className="text-xs text-ink-2">이 항목을 지울까요?</span>
                <button type="button" className={btnDanger} onClick={() => actions.onDeleteCustom(item)}>
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
            ) : null}

            {item.detail ? (
              <div id={detailId} hidden={!open} className="mt-2 rounded-xl bg-surface-2 px-3 py-2.5">
                {item.start && t ? <p className="mb-1 text-[11px] font-medium text-ink-3">{t.when}</p> : null}
                <p className="text-xs leading-relaxed text-ink-2">{item.detail}</p>
                {isShared(item) ? (
                  <p className="mt-1.5 text-[11px] text-ink-3">임신·아기 탭의 같은 항목과 함께 체크돼요.</p>
                ) : null}
                {t?.link ? (
                  <div className="-mb-1">
                    <ExternalLink href={t.link.url}>{t.link.label}에서 보기</ExternalLink>
                  </div>
                ) : null}
                {t?.sources.length ? (
                  <div className="mt-1 border-t border-line/70 pt-1.5">
                    <p className="text-[11px] font-semibold text-ink-3">출처</p>
                    <ul className="-mb-1">
                      {t.sources.map((s) => (
                        <li key={s.url}>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[44px] items-center text-[11px] text-ink-3 underline underline-offset-2 hover:text-ink-2"
                          >
                            {s.name}
                            <span className="sr-only"> (새 창)</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </li>
  )
}
