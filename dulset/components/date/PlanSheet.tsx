'use client'

import { useId, useState } from 'react'
import { Button, Field, Sheet, inputClass, textareaClass, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import type { DateIdea } from '@/lib/content/dateIdeas'
import { formatKo, isISODate } from '@/lib/dates'
import { uid } from '@/lib/id'
import {
  PLAN_TEXT_MAX,
  PLAN_TITLE_MAX,
  planDateHint,
  proposeDatePlan,
  suggestPlanDate,
  validatePlan,
  type PlanError,
} from '@/lib/logic/dateIdeas'
import { stampOn } from '@/lib/logic/today'
import { useApp } from '@/lib/store'

const ERROR_TEXT: Record<PlanError, string> = {
  date: '오늘이나 이후 날짜를 골라 주세요.',
  title: '무엇을 할지 한 줄로 적어 주세요.',
}

/**
 * "일정에 담기": pick a day (defaults to the coming Saturday — never the fertile
 * window, so a date never reads as a signal) and send it to the partner.
 */
export default function PlanSheet({ idea, onClose }: { idea?: DateIdea; onClose: () => void }) {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const errorId = useId()
  // The suggestion is made once, when the sheet opens.
  const [suggested] = useState(() => suggestPlanDate(state, today))
  const [date, setDate] = useState(suggested.date)
  const [title, setTitle] = useState(idea?.title ?? '')
  const [place, setPlace] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<PlanError | null>(null)

  const dateHint = date === suggested.date ? planDateHint(suggested, today) : undefined

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const err = validatePlan({ date, title }, today)
    setError(err)
    if (err) return
    // Id and timestamp are made here so the updater stays pure (StrictMode may run it twice).
    const input = { date, title, ideaId: idea?.id, place, note, createdBy: me.id }
    const id = uid()
    const now = stampOn(today)
    update((s) => proposeDatePlan(s, input, now, id))
    toast.show(`${partner.name}님에게 제안했어요`)
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={idea ? '일정에 담기' : '데이트 일정 추가'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="언제" hint={error === 'date' ? undefined : dateHint}>
          <input
            type="date"
            className={inputClass}
            value={date}
            min={today}
            required
            aria-invalid={error === 'date'}
            aria-describedby={error === 'date' ? `${errorId}-date` : undefined}
            onChange={(e) => {
              setDate(e.target.value)
              if (error === 'date') setError(null)
            }}
          />
        </Field>
        {error === 'date' ? (
          <p id={`${errorId}-date`} role="alert" className="-mt-2 text-xs font-medium text-period">
            {ERROR_TEXT.date}
          </p>
        ) : null}

        <Field label="무엇을">
          <input
            className={inputClass}
            value={title}
            maxLength={PLAN_TITLE_MAX}
            placeholder="예: 한강 피크닉"
            required
            aria-invalid={error === 'title'}
            aria-describedby={error === 'title' ? `${errorId}-title` : undefined}
            onChange={(e) => {
              setTitle(e.target.value)
              if (error === 'title') setError(null)
            }}
          />
        </Field>
        {error === 'title' ? (
          <p id={`${errorId}-title`} role="alert" className="-mt-2 text-xs font-medium text-period">
            {ERROR_TEXT.title}
          </p>
        ) : null}

        <Field label="어디서 (선택)">
          <input
            className={inputClass}
            value={place}
            maxLength={PLAN_TEXT_MAX}
            placeholder={idea ? `예: ${idea.mapQuery}` : '예: 동네 공원'}
            onChange={(e) => setPlace(e.target.value)}
          />
        </Field>

        <Field label="한마디 (선택)">
          <textarea
            className={textareaClass}
            rows={2}
            value={note}
            maxLength={PLAN_TEXT_MAX}
            placeholder="예: 저녁 7시 어때요? 예약은 내가 할게요"
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        <div className="flex gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2">
          <Icon name="mail" className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
          <span>
            {partner.name}님에게 <b className="font-semibold text-ink">{isISODate(date) ? formatKo(date) : '고른 날'}</b> 데이트
            제안 알림이 가요.
          </span>
        </div>

        <Button type="submit" full size="lg">
          {partner.name}님에게 제안하기
        </Button>
      </form>
    </Sheet>
  )
}
