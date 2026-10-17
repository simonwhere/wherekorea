'use client'

import { useId, useState } from 'react'
import { Button, Field, Sheet, Toggle, inputClass, textareaClass, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { APPOINTMENT_KIND_ICON } from '@/components/ui/kindIcons'
import { templateById } from '@/lib/content/roadmap'
import { addDays, formatKo, isISODate } from '@/lib/dates'
import {
  APPOINTMENT_KIND_LABEL,
  addAppointment,
  hasAppointmentNotice,
  needsTime,
  privateOwner,
  updateAppointment,
} from '@/lib/logic/appointments'
import { useApp } from '@/lib/store'
import { APPOINTMENT_KINDS, type Appointment, type AppointmentKind } from '@/lib/types'
import { ChoiceChips, FieldError } from './bits'
import {
  APPT_PLACEHOLDER,
  APPT_TEXT_MAX,
  APPT_TITLE_MAX,
  validateDraft,
  type AppointmentDraft,
  type DraftError,
  type Who,
} from '@/lib/logic/plan'

// 주사·약 (N13) last: the clinic-cycle kinds, which ask for a time of day.
const KINDS: readonly AppointmentKind[] = APPOINTMENT_KINDS

/** A visit that already happened (a test to claim for, a clinic day logged late) may be up to a year back (N13 ⑤). */
export const APPT_PAST_DAYS = 365
/** "같은 일정 +2일" — the clinic's usual rhythm (채혈·초음파 every other day). */
const DUPLICATE_AFTER_DAYS = 2

const ERROR_TEXT: Record<DraftError, string> = {
  date: '지난 1년 안이나 앞으로의 날짜를 골라 주세요.',
  time: '시간을 다시 확인해 주세요.',
  'time-required': '주사·약은 몇 시인지 적어 주세요.',
  title: '무슨 일정인지 한 줄로 적어 주세요.',
}

/**
 * Add or edit an appointment (병원·검사·접종·신청). Both phones see it — unless
 * the person going keeps their own one '나만 보기' ('{partner}님에게도 보여요'
 * off, Appointment.privateTo; on by default, 2026-10-17) — and reminders go
 * out the day before / the morning of.
 */
export default function AppointmentSheet({
  initial,
  editing,
  onClose,
}: {
  initial: AppointmentDraft
  /** Set when editing an existing appointment. */
  editing?: Appointment
  onClose: () => void
}) {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const errorId = useId()
  const [draft, setDraft] = useState<AppointmentDraft>(initial)
  // '{partner}님에게도 보여요' — on (shared) unless the appointment being edited is already '나만 보기' for me.
  const [shared, setShared] = useState(() => !editing || privateOwner(editing) !== me.id)
  const [error, setError] = useState<DraftError | null>(null)
  const [a, b] = state.couple.members
  // Past visits count too (a test already taken, a clinic day written up at night).
  const minDate = addDays(today, -APPT_PAST_DAYS)
  const task = draft.taskId ? (templateById(draft.taskId) ?? state.customTasks.find((c) => c.id === draft.taskId)) : undefined

  const timed = needsTime(draft.kind)
  // The choice is the person going's, on their own appointment only: '둘 다'
  // is always shared, and so is the other person's visit.
  const mine = draft.who === me.id
  const privateTo = mine && !shared ? me.id : undefined
  // Already told (the day-before heads-up went to {partner} while it was
  // shared): the 🔔 one goes with the switch (updateAppointment), but a phone
  // notification already shown cannot be taken back — so the line says '앞으로'.
  const told = !!editing && hasAppointmentNotice(state, editing.id, partner.id)

  const set = <K extends keyof AppointmentDraft>(key: K, value: AppointmentDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    // Switching who to '둘 다' or to the other person shares it again.
    if (key === 'who' && value !== me.id) setShared(true)
    if (error === key || (key === 'time' && error === 'time-required') || (key === 'kind' && error === 'time-required')) setError(null)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const err = validateDraft(draft, minDate)
    setError(err)
    if (err) return
    const input = {
      date: draft.date,
      time: draft.time || undefined,
      title: draft.title,
      place: draft.place,
      who: draft.who,
      kind: draft.kind,
      note: draft.note,
      taskId: draft.taskId,
      // Always sent: undefined shares an edited one again (updateAppointment).
      privateTo,
    }
    if (editing) {
      update((s) => updateAppointment(s, editing.id, { ...input, time: draft.time }))
      toast.show('일정을 고쳤어요')
    } else {
      update((s) => addAppointment(s, input, me.id))
      toast.show(privateTo ? '나만 보는 일정으로 넣었어요' : `${partner.name}님 화면에도 보여요`)
    }
    onClose()
  }

  /** "같은 일정 +2일": one more of this appointment two days on (the draft as it is now). */
  const duplicate = () => {
    const err = validateDraft(draft, minDate)
    setError(err)
    if (err) return
    const date = addDays(draft.date, DUPLICATE_AFTER_DAYS)
    update((s) =>
      addAppointment(
        s,
        {
          date,
          time: draft.time || undefined,
          title: draft.title,
          place: draft.place,
          who: draft.who,
          kind: draft.kind,
          note: draft.note,
          taskId: draft.taskId,
          // The copy keeps '나만 보기' as the form has it now.
          privateTo,
        },
        me.id,
      ),
    )
    toast.show(`${formatKo(date)}에 같은 일정을 넣었어요`)
    onClose()
  }

  const describe = (key: DraftError) => (error === key ? `${errorId}-${key}` : undefined)

  return (
    <Sheet open onClose={onClose} title={editing ? '일정 고치기' : '일정 추가'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {task ? (
          <p className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
            <Icon name="list" className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span>
              챙길 것 · <b className="font-semibold text-ink">{task.title}</b>
            </span>
          </p>
        ) : null}

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="날짜">
            <input
              type="date"
              className={inputClass}
              value={draft.date}
              min={minDate}
              required
              aria-invalid={error === 'date'}
              aria-describedby={describe('date')}
              onChange={(e) => set('date', e.target.value)}
            />
          </Field>
          <Field label={timed ? '시간' : '시간 (선택)'}>
            <input
              type="time"
              className={`${inputClass} w-[7.5rem]`}
              value={draft.time}
              required={timed}
              aria-invalid={error === 'time' || error === 'time-required'}
              aria-describedby={describe('time') ?? describe('time-required')}
              onChange={(e) => set('time', e.target.value)}
            />
          </Field>
        </div>
        {error === 'date' || error === 'time' || error === 'time-required' ? (
          <FieldError id={`${errorId}-${error}`}>{ERROR_TEXT[error]}</FieldError>
        ) : null}

        <Field label="무슨 일정">
          <input
            className={inputClass}
            value={draft.title}
            maxLength={APPT_TITLE_MAX}
            placeholder={APPT_PLACEHOLDER[state.stage].title}
            required
            aria-invalid={error === 'title'}
            aria-describedby={describe('title')}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
        {error === 'title' ? <FieldError id={`${errorId}-title`}>{ERROR_TEXT.title}</FieldError> : null}

        <Field label="어디서 (선택)">
          <input
            className={inputClass}
            value={draft.place}
            maxLength={APPT_TEXT_MAX}
            placeholder="예: ○○산부인과 3층"
            onChange={(e) => set('place', e.target.value)}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-ink-2">누가 가요</span>
          <ChoiceChips<Who>
            label="누가 가요"
            value={draft.who}
            onChange={(v) => set('who', v)}
            options={[
              { value: 'both', label: '둘 다' },
              { value: a.id, label: a.name },
              { value: b.id, label: b.name },
            ]}
          />
          {mine ? (
            // '나만 보기' (2026-10-17): on = shared (the default, as before); off = only me.
            <div className="mt-2 rounded-xl border border-line px-3" data-share-toggle>
              <Toggle
                checked={shared}
                onChange={setShared}
                label={`${partner.name}님에게도 보여요`}
                description={
                  shared ? undefined : (
                    <span className="inline-flex items-start gap-1">
                      <Icon name="lock" className="mt-px h-3.5 w-3.5 text-ink-2" strokeWidth={2} />
                      <span>
                        {told
                          ? `앞으로 ${partner.name}님 화면·알림·링크에 나오지 않아요. 이미 폰에 뜬 알림은 남을 수 있어요`
                          : `${partner.name}님 화면·알림·링크에 나오지 않아요`}
                      </span>
                    </span>
                  )
                }
              />
            </div>
          ) : null}
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-ink-2">종류</span>
          <ChoiceChips<AppointmentKind>
            label="종류"
            value={draft.kind}
            onChange={(v) => set('kind', v)}
            options={KINDS.map((k) => ({
              value: k,
              label: (
                <>
                  <Icon name={APPOINTMENT_KIND_ICON[k]} className="h-3.5 w-3.5 shrink-0" /> {APPOINTMENT_KIND_LABEL[k]}
                </>
              ),
            }))}
          />
        </div>

        <Field label="메모 (선택)">
          <textarea
            className={textareaClass}
            rows={2}
            value={draft.note}
            maxLength={APPT_TEXT_MAX}
            placeholder={APPT_PLACEHOLDER[state.stage].note}
            onChange={(e) => set('note', e.target.value)}
          />
        </Field>

        <div className="flex items-start gap-1.5 rounded-xl bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2">
          <Icon name="bell" className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span>
            {draft.who === 'both' ? '둘 다' : draft.who === me.id ? '나' : `${partner.name}님`}
            에게 <b className="font-semibold text-ink">{isISODate(draft.date) ? formatKo(draft.date) : '그날'}</b> 전날과 당일에 알림이
            가요.
            {/* A '나만 보기' one tells no one else — never promise the heads-up then. */}
            {draft.who !== 'both' && !privateTo ? ' 함께 가지 않는 사람에게도 전날 살짝 알려 줘요.' : null}
          </span>
        </div>

        <Button type="submit" full size="lg">
          {editing ? '저장' : '일정 추가'}
        </Button>
        {editing ? (
          <Button type="button" full variant="ghost" onClick={duplicate}>
            같은 일정 +{DUPLICATE_AFTER_DAYS}일 복제
          </Button>
        ) : null}
      </form>
    </Sheet>
  )
}
