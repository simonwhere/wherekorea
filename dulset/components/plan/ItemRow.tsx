'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { ROADMAP_KIND_ICON } from '@/components/ui/kindIcons'
import { ROADMAP_AUDIT } from '@/lib/content/roadmap'
import { formatShort, isISODate } from '@/lib/dates'
import { FERTILITY_APPLY_ID, appliedInfo } from '@/lib/logic/partnerTrack'
import { useApp } from '@/lib/store'
import type { Appointment, MemberId } from '@/lib/types'
import { CheckBox, ExternalLink, Owners, Pill, btnDanger, btnGhost, btnSecondary } from './bits'
import SupportButton from './SupportButton'
import { togetherRow, type TogetherItem } from '@/lib/logic/together'
import { weekQuiet } from '@/lib/logic/weekTogether'
import {
  canSchedule,
  countdown,
  dateText,
  isShared,
  linkedAppointment,
  ownerText,
  shortDate,
  statusPill,
  type PillTone,
  type PlanItem,
} from '@/lib/logic/plan'

/** The other person's item on my screen: a neutral status only (lib/logic/together). */
const NEUTRAL_TONE: Record<string, PillTone> = { done: 'ok', 'this-week': 'soft', upcoming: 'muted' }

function neutralPill(row: TogetherItem): { label: string; tone: PillTone } | null {
  return row.label ? { label: row.label, tone: NEUTRAL_TONE[row.status] ?? 'muted' } : null
}

export interface ItemActions {
  onToggle: (item: PlanItem) => void
  onSchedule: (item: PlanItem) => void
  onOpenAppointment: (a: Appointment) => void
  onDeleteCustom: (item: PlanItem) => void
  /** One person's step of a per-person row (임신 사전건강관리 신청, N14). */
  onToggleMember?: (item: PlanItem, member: MemberId) => void
}

/**
 * The couple's 임신 사전건강관리 row is one row for two applications: each
 * person's own tick sits under it (the row itself reads done once both have
 * applied — lib/logic/partnerTrack.setFertilityApplied keeps them in step).
 */
function PerPerson({ item, actions }: { item: PlanItem; actions: ItemActions }) {
  const { state } = useApp()
  if (!actions.onToggleMember) return null
  return (
    <div role="group" aria-label="사람별 신청" className="-my-1 flex flex-wrap gap-x-1.5">
      {state.couple.members.map((m) => {
        const done = appliedInfo(state.planDone, m.id)
        return (
          <button
            key={m.id}
            type="button"
            role="checkbox"
            aria-checked={!!done}
            aria-label={`${m.name} 신청`}
            onClick={() => actions.onToggleMember!(item, m.id)}
            className="group inline-flex h-11 items-center rounded-full focus-visible:outline-none"
          >
            <span
              className={cx(
                'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition-colors',
                'group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-brand',
                done ? 'border-ok/40 bg-ok-soft text-ink-2' : 'border-line bg-surface text-ink-3 group-hover:bg-surface-2',
              )}
            >
              {m.name} {done ? `✓ ${formatShort(done.at)}` : '신청 전'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * One roadmap row: tick, what, who, when. The full list rows open for the
 * detail, sources and "일정 잡기"; the focus card uses the compact form.
 *
 * Together (founder request 2026-10-09 — "같이 하는 거야"; lib/logic/together
 * togetherRow): on the other person's item the row shows a neutral status only
 * ('예정 · 10월 21일' / '이번 주' / '했어요 ✓' — never '기한 지남', a red row or a
 * countdown about them); for the 함께하는 사람, her items and the shared ones
 * carry what he can do (the support line) and [같이 할게요]; on her own screen
 * an item he said it to reads '민수님이 같이 챙긴대요'.
 */
export default function ItemRow({ item, compact, actions }: { item: PlanItem; compact?: boolean; actions: ItemActions }) {
  const { state, today, me } = useApp()
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
  const row = togetherRow(state, today, me.id, item)
  // The 42 quiet days after a loss: no support line, no [같이 할게요], no '민수님이 같이 챙긴대요' (together.ts rests).
  const quiet = weekQuiet(state, today)
  // Not mine alone to look after → no warning, no countdown, only where it stands.
  const neutral = row.whose === 'theirs'
  const pill = neutral ? neutralPill(row) : statusPill(item, state.stage)
  const cd = neutral ? undefined : countdown(item, today)
  const appt = linkedAppointment(state.appointments, item.id, today)
  const t = item.template
  // lib/content/data audit: false until a person has checked the item against its official original ('미확인').
  const unverified = !!t && ROADMAP_AUDIT[t.id]?.verified === false
  const doneByName = item.doneBy ? members.find((m) => m.id === item.doneBy)?.name : undefined
  // A neutral label that carries its day ('예정 · 10월 21일') says the date already.
  const when = neutral && row.date ? '' : item.start ? dateText(item, today) : item.custom ? '날짜 없음' : item.when
  const perPerson = item.id === FERTILITY_APPLY_ID && !item.custom && state.stage === 'preparing'

  return (
    <li
      className={cx('flex gap-3 rounded-xl px-2 py-2.5', item.status === 'overdue' && !neutral && !compact && 'bg-warn-soft')}
      data-plan-row={item.id}
    >
      <div className="pt-0.5">
        <CheckBox checked={done} onToggle={() => actions.onToggle(item)} label={`${item.title} 챙김`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {pill ? <Pill tone={pill.tone}>{pill.label}</Pill> : null}
          {when ? (
            <span
              className={cx('text-[11px] font-medium tabular-nums', item.status === 'now' && !neutral ? 'text-brand-ink' : 'text-ink-3')}
            >
              {when}
            </span>
          ) : null}
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
        <p
          className={cx(
            'mt-0.5 flex items-start gap-1.5 text-sm font-semibold leading-snug',
            done ? 'text-ink-3 line-through' : 'text-ink',
          )}
        >
          <Icon name={ROADMAP_KIND_ICON[item.kind]} className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" />
          <span className="min-w-0">{item.title}</span>
        </p>
        {/* What the 함께하는 사람 can do to share it, and [같이 할게요] (together.ts). */}
        {/* Not on one whose time went by (a lapsed window; her passed deadline reads as nothing on his screen). */}
        {row.support && !quiet && !done && !item.lapsed && !(neutral && item.status === 'overdue') ? (
          <div className="mt-1 flex items-center gap-2" data-support-line>
            <p className="flex min-w-0 flex-1 items-start gap-1.5 text-xs leading-relaxed text-ink-2">
              <Icon name="users" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-him" />
              <span className="min-w-0">
                <span className="sr-only">내가 할 수 있는 것: </span>
                {row.support}
              </span>
            </p>
            <SupportButton itemId={item.id} title={item.title} supported={row.supported} canSupport={row.canSupport} />
          </div>
        ) : null}
        {/* Her screen: his [같이 할게요] on this item. */}
        {row.supportedBy && !quiet && !done ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-ink" data-supported-by>
            <Icon name="users" className="h-3.5 w-3.5 shrink-0 text-him" />
            {row.supportedBy}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Owners owners={item.owners} members={members} label={ownerText(item.owners, members)} />
          {perPerson ? (
            <PerPerson item={item} actions={actions} />
          ) : done && isISODate(item.doneAt) ? (
            <span className="text-[11px] font-medium text-ok">
              ✓ {formatShort(item.doneAt)}
              {doneByName ? ` ${doneByName}` : ''} 챙김
            </span>
          ) : null}
          {t?.deadline && !done && !neutral ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-ink-2">
              <Icon name="pin" className="h-3 w-3" strokeWidth={2} />
              기한 있음
            </span>
          ) : null}
          {/* An own item with '기한 알림' on (N13): D-7 · D-1 · 당일 notices, even while preparing. */}
          {item.custom && !done && state.customTasks.find((c) => c.id === item.id)?.deadlineAlerts === true ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-ink-2">
              <Icon name="bell" className="h-3 w-3" strokeWidth={2} />
              기한 알림
            </span>
          ) : null}
          {appt && !done ? (
            <button
              type="button"
              onClick={() => actions.onOpenAppointment(appt)}
              className="-my-3 inline-flex min-h-[44px] items-center gap-0.5 text-[11px] font-semibold text-brand-ink underline-offset-2 hover:underline"
            >
              <Icon name="cal" className="h-3 w-3" strokeWidth={2} />
              {shortDate(appt.date, today)}
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
                  <Icon name="chev" className={cx('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} strokeWidth={2.2} />
                </button>
              ) : null}
              {canSchedule(item) && !appt ? (
                <button type="button" onClick={() => actions.onSchedule(item)} className={cx(btnGhost, item.detail ? '' : '-ml-3')}>
                  <Icon name="cal" className="h-3.5 w-3.5" strokeWidth={2} /> 일정 잡기
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
                {row.supportNote && !quiet && !done ? (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-ink-2">
                    <Icon name="users" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-him" />
                    <span className="min-w-0">{row.supportNote}</span>
                  </p>
                ) : null}
                {isShared(item) ? <p className="mt-1.5 text-[11px] text-ink-3">임신·아기 탭의 같은 항목과 함께 체크돼요.</p> : null}
                {t?.link ? (
                  <div className="-mb-1">
                    <ExternalLink href={t.link.url}>{t.link.label}에서 보기</ExternalLink>
                  </div>
                ) : null}
                {t?.sources.length ? (
                  <div className="mt-1 border-t border-line/70 pt-1.5">
                    <p className="text-[11px] font-semibold text-ink-3">
                      출처
                      {unverified ? <span className="font-medium"> · 원문 확인 중 — 공식 안내에서 한 번 더 확인해 주세요</span> : null}
                    </p>
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
