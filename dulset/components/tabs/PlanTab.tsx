'use client'

// 챙길 것: the couple's shared road from preparing to the first months with
// the baby — what to look after this week, booked appointments, and every
// hospital / test / vaccine / work / admin item by phase.

import { useCallback, useMemo, useState } from 'react'
import { Disclaimer, useToast } from '@/components/ui'
import AppointmentList from '@/components/plan/AppointmentList'
import AppointmentSheet from '@/components/plan/AppointmentSheet'
import CustomTaskSheet from '@/components/plan/CustomTaskSheet'
import FocusCard from '@/components/plan/FocusCard'
import type { ItemActions } from '@/components/plan/ItemRow'
import PhaseList from '@/components/plan/PhaseList'
import {
  HEADER_LINE,
  PLAN_NOTE,
  currentPhase,
  draftForItem,
  draftFromAppointment,
  emptyDraft,
  planItems,
  tickItem,
  type AppointmentDraft,
  type PhaseFilter,
  type PlanItem,
} from '@/lib/logic/plan'
import { ROADMAP_CHECKED_AT } from '@/lib/content/roadmap'
import { setAppointmentDone } from '@/lib/logic/appointments'
import { FERTILITY_APPLY_ID, appliedInfo, setFertilityApplied } from '@/lib/logic/partnerTrack'
import { removeCustomTask } from '@/lib/logic/roadmap'
import { useApp } from '@/lib/store'
import type { Appointment, AppState, ISODate, MemberId } from '@/lib/types'

type ApptSheet = { draft: AppointmentDraft; editing?: Appointment } | null

export default function PlanTab() {
  const { state, update, today, me } = useApp()
  const toast = useToast()
  const [filter, setFilter] = useState<PhaseFilter>('stage')
  const [apptSheet, setApptSheet] = useState<ApptSheet>(null)
  const [customOpen, setCustomOpen] = useState(false)

  const items = useMemo(() => planItems(state, today), [state, today])

  const closeAppt = useCallback(() => setApptSheet(null), [])
  const closeCustom = useCallback(() => setCustomOpen(false), [])

  // The 임신 사전건강관리 application is per person (N14): the couple's row is
  // both of them, and each person's own tick sits under it.
  const applyBoth = (s: AppState, done: boolean, at: ISODate, who: MemberId | 'both') => {
    const members: MemberId[] = who === 'both' ? ['a', 'b'] : [who]
    return members.reduce((acc, m) => setFertilityApplied(acc, m, done, at, me.id), s)
  }

  const actions: ItemActions = {
    onToggle: (item: PlanItem) => {
      const done = item.status !== 'done'
      if (item.id === FERTILITY_APPLY_ID && !item.custom) update((s) => applyBoth(s, done, today, 'both'))
      else update(tickItem(item.id, done, today, me.id))
      if (done) toast.show('챙겼어요 ✓')
    },
    onToggleMember: (item: PlanItem, member: MemberId) => {
      const name = state.couple.members.find((m) => m.id === member)?.name ?? ''
      const done = !appliedInfo(state.planDone, member)
      update((s) => setFertilityApplied(s, member, done, today, me.id))
      toast.show(done ? `${name}님 신청으로 체크했어요 ✓` : `${name}님 신청을 되돌렸어요`)
    },
    onSchedule: (item: PlanItem) => setApptSheet({ draft: draftForItem(item, today) }),
    onOpenAppointment: (a: Appointment) => setApptSheet({ draft: draftFromAppointment(a), editing: a }),
    onDeleteCustom: (item: PlanItem) => {
      update((s) => removeCustomTask(s, item.id))
      toast.show('지웠어요')
    },
  }

  const markAppointment = (a: Appointment, done: boolean) => {
    const task = a.taskId ? items.find((i) => i.id === a.taskId) : undefined
    const tickTask = done && !!task && task.status !== 'done'
    // The item is dated to the visit (a test's claim deadline counts from the
    // day of the test, not the day it was ticked). tickItem re-checks on the
    // state it's applied to (it never re-dates a tick).
    const at = a.date <= today ? a.date : today
    update((s) => {
      const next = setAppointmentDone(s, a.id, done)
      if (!done || !a.taskId) return next
      if (a.taskId === FERTILITY_APPLY_ID) return applyBoth(next, true, at, a.who)
      return tickItem(a.taskId, true, at, me.id)(next)
    })
    if (done) toast.show(tickTask ? '챙길 것에도 체크했어요 ✓' : '완료로 표시했어요 ✓')
  }

  const defaultPhase = filter === 'stage' || filter === 'all' ? currentPhase(state, today) : filter

  return (
    <div>
      <header className="mb-4 px-1">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">챙길 것</h1>
        <p className="mt-1 text-sm text-ink-2">{HEADER_LINE[state.stage]}</p>
      </header>

      <FocusCard items={items} actions={actions} />

      <AppointmentList
        onAdd={() => setApptSheet({ draft: emptyDraft(today) })}
        onEdit={(a) => setApptSheet({ draft: draftFromAppointment(a), editing: a })}
        onDone={markAppointment}
      />

      <PhaseList
        items={items}
        filter={filter}
        onFilter={setFilter}
        onAddCustom={() => setCustomOpen(true)}
        actions={actions}
      />

      <Disclaimer>
        {PLAN_NOTE} 병원·회사·보건소마다 다를 수 있어요. (확인일 {ROADMAP_CHECKED_AT})
      </Disclaimer>

      {apptSheet ? (
        <AppointmentSheet
          // A new draft (another item's "일정 잡기") starts a fresh form.
          key={apptSheet.editing?.id ?? apptSheet.draft.taskId ?? 'new'}
          initial={apptSheet.draft}
          editing={apptSheet.editing}
          onClose={closeAppt}
        />
      ) : null}
      {customOpen ? <CustomTaskSheet defaultPhase={defaultPhase} onClose={closeCustom} /> : null}
    </div>
  )
}
