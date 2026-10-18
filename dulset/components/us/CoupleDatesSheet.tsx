'use client'

import { useId, useState } from 'react'
import { Button, Sheet, cx, inputClass, useToast } from '@/components/ui'
import { setCoupleDates } from '@/lib/logic/anniversary'
import { checkPastDate, type DateCheck } from '@/lib/logic/usView'
import { useApp } from '@/lib/store'

const ERROR: Partial<Record<DateCheck, string>> = {
  invalid: '날짜를 한 번 더 확인해 주세요',
  future: '오늘 이후 날짜는 넣을 수 없어요',
}

/** 처음 만난 날 · 결혼한 날 — both optional, never after today. `onClose` must be stable. */
export default function CoupleDatesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="우리의 시작">
      {open ? <DatesForm onDone={onClose} /> : null}
    </Sheet>
  )
}

function DatesForm({ onDone }: { onDone: () => void }) {
  const { state, update, today } = useApp()
  const toast = useToast()
  const [met, setMet] = useState(state.couple.metDate ?? '')
  const [married, setMarried] = useState(state.couple.marriedDate ?? '')
  const [tried, setTried] = useState(false)

  const metCheck = checkPastDate(met, today)
  const marriedCheck = checkPastDate(married, today)
  const ok = (c: DateCheck) => c === 'ok' || c === 'empty'
  const valid = ok(metCheck) && ok(marriedCheck)
  const marriedFirst = metCheck === 'ok' && marriedCheck === 'ok' && married < met

  function save(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!valid) return
    update((s) => setCoupleDates(s, { metDate: met || null, marriedDate: married || null }))
    toast.show('저장했어요')
    onDone()
  }

  return (
    <form className="space-y-4" onSubmit={save} noValidate>
      <DateField
        label="처음 만난 날 (사귄 날)"
        value={met}
        onChange={setMet}
        max={today}
        error={tried || metCheck === 'future' ? ERROR[metCheck] : undefined}
      />
      <DateField
        label="결혼한 날"
        value={married}
        onChange={setMarried}
        max={today}
        error={tried || marriedCheck === 'future' ? ERROR[marriedCheck] : undefined}
        hint={marriedFirst ? '만난 날보다 앞선 날이에요. 맞는지 확인해 주세요.' : undefined}
      />
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button variant="secondary" onClick={onDone}>
          취소
        </Button>
        <Button type="submit" disabled={tried && !valid}>
          저장하기
        </Button>
      </div>
    </form>
  )
}

function DateField({
  label,
  value,
  onChange,
  max,
  error,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  max: string
  error?: string
  hint?: string
}) {
  const id = useId()
  const noteId = useId()
  const note = error ?? hint
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-ink-2">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="date"
          className={cx(inputClass, 'min-w-0 flex-1 px-2.5')}
          value={value}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
        />
        {value ? (
          <Button variant="ghost" onClick={() => onChange('')} ariaLabel={`${label} 비우기`}>
            비우기
          </Button>
        ) : null}
      </div>
      {note ? (
        <p id={noteId} className={cx('mt-1 text-xs', error ? 'font-medium text-period' : 'text-ink-3')}>
          {note}
        </p>
      ) : null}
    </div>
  )
}
