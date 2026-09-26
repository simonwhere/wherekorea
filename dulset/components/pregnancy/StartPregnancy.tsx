'use client'

import { useCallback, useState } from 'react'
import { Button, EmptyState, Field, Sheet, inputClass, useToast } from '@/components/ui'
import { DUE_DATE_NOTE } from '@/lib/content/pregnancy'
import { addDays, formatKo } from '@/lib/dates'
import { localNowISO } from '@/lib/logic/notifications'
import { PREGNANCY_DAYS, updatePregnancy } from '@/lib/logic/pregnancy'
import { defaultLmp, dueDateBounds, lmpBounds, validateDueDate, validateLmp } from '@/lib/logic/pregnancyView'
import { confirmPregnancy } from '@/lib/logic/today'
import { useApp } from '@/lib/store'

/** Shown only if the stage is 'pregnant' but no pregnancy record exists. */
export default function StartPregnancy() {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <>
      <EmptyState
        icon="🤰"
        title="임신 주수를 계산해 볼까요?"
        body="마지막 생리 시작일을 알려 주면 주수와 예정일을 예상해 드려요."
        action={<Button onClick={() => setOpen(true)}>날짜 입력하기</Button>}
      />
      <Sheet open={open} onClose={close} title="임신 정보 입력">
        {open ? <StartForm onDone={close} /> : null}
      </Sheet>
    </>
  )
}

function StartForm({ onDone }: { onDone: () => void }) {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const [lmp, setLmp] = useState(() => defaultLmp(state, today))
  const [due, setDue] = useState('')
  const lmpError = validateLmp(lmp, today)
  const dueError = due ? validateDueDate(due, today) : null
  const lmpB = lmpBounds(today)
  const dueB = dueDateBounds(today)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (lmpError || dueError) return
    const now = localNowISO()
    const override = due || undefined
    // Same path as the 오늘 tab's "임신했어요": the partner hears about it too.
    update((s) => updatePregnancy(confirmPregnancy(s, lmp, today, me.id, partner.id, now), { dueDateOverride: override }))
    toast.show('축하해요! 임신 기록을 시작했어요')
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="마지막 생리 시작일" hint={lmpError ?? `예상 예정일: ${formatKo(addDays(lmp, PREGNANCY_DAYS))}`}>
        <input
          type="date"
          className={inputClass}
          value={lmp}
          min={lmpB.min}
          max={lmpB.max}
          onChange={(e) => setLmp(e.target.value)}
          aria-invalid={!!lmpError}
          required
        />
      </Field>
      <Field label="병원에서 알려 준 예정일 (선택)" hint={dueError ?? '있으면 이 날짜를 기준으로 주수를 계산해요.'}>
        <input
          type="date"
          className={inputClass}
          value={due}
          min={dueB.min}
          max={dueB.max}
          onChange={(e) => setDue(e.target.value)}
          aria-invalid={!!dueError}
        />
      </Field>
      <p className="rounded-xl bg-surface-2 p-3 text-[11px] leading-relaxed text-ink-3">{DUE_DATE_NOTE}</p>
      <Button type="submit" full size="lg" disabled={!!lmpError || !!dueError}>
        시작하기
      </Button>
    </form>
  )
}
