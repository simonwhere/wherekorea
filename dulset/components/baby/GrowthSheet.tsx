'use client'

import { useId, useState } from 'react'
import { Button, Field, Sheet, cx, inputClass, useToast } from '@/components/ui'
import { GROWTH_LIMITS, type GrowthField } from '@/lib/content/baby'
import { addGrowth } from '@/lib/logic/baby'
import { ageAt, growthDateBounds, validateGrowth, type GrowthInput } from '@/lib/logic/babyView'
import { useApp } from '@/lib/store'

const fieldClass = cx(inputClass, 'aria-[invalid=true]:border-period')

const FIELD_ORDER: { field: GrowthField; placeholder: string; hint: string }[] = [
  { field: 'weightKg', placeholder: '7.25', hint: '1~30kg, 소수점 둘째 자리까지' },
  { field: 'heightCm', placeholder: '68.5', hint: '30~130cm' },
  { field: 'headCm', placeholder: '43', hint: '25~60cm' },
]

export default function GrowthSheet({ open, onClose, birth }: { open: boolean; onClose: () => void; birth: string }) {
  return (
    <Sheet open={open} onClose={onClose} title="성장 기록 추가">
      {open ? <GrowthForm birth={birth} onDone={onClose} /> : null}
    </Sheet>
  )
}

function GrowthForm({ birth, onDone }: { birth: string; onDone: () => void }) {
  const { update, today } = useApp()
  const toast = useToast()
  const [input, setInput] = useState<GrowthInput>({ date: today, heightCm: '', weightKg: '', headCm: '' })
  const [tried, setTried] = useState(false)
  const hintId = useId()
  const { errors, record } = validateGrowth(input, birth, today)
  const bounds = growthDateBounds(birth, today)
  const show = (msg: string | undefined) => (tried && msg ? <span className="text-period">{msg}</span> : null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!record) return
    update((s) => addGrowth(s, record))
    toast.show('성장 기록을 남겼어요')
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field
        label="잰 날"
        hint={show(errors.date) ?? (input.date >= birth && input.date <= today ? ageAt(birth, input.date) : undefined)}
      >
        <input
          type="date"
          className={fieldClass}
          value={input.date}
          min={bounds.min}
          max={bounds.max}
          onChange={(e) => setInput({ ...input, date: e.target.value })}
          aria-invalid={tried && !!errors.date}
          required
        />
      </Field>

      <div className="grid grid-cols-3 items-end gap-2">
        {FIELD_ORDER.map(({ field, placeholder }) => {
          const lim = GROWTH_LIMITS[field]
          return (
            <Field key={field} label={`${lim.label} (${lim.unit})`}>
              <input
                type="text"
                inputMode="decimal"
                className={fieldClass}
                value={input[field]}
                placeholder={placeholder}
                onChange={(e) => setInput({ ...input, [field]: e.target.value })}
                aria-invalid={tried && !!errors[field]}
                aria-describedby={`${hintId}-${field}`}
                autoComplete="off"
              />
            </Field>
          )
        })}
      </div>
      <ul className="-mt-2 space-y-0.5 text-xs text-ink-3">
        {FIELD_ORDER.map(({ field, hint }) => (
          <li key={field} id={`${hintId}-${field}`}>
            {show(errors[field]) ?? (
              <>
                {GROWTH_LIMITS[field].label}: {hint}
              </>
            )}
          </li>
        ))}
      </ul>
      {tried && errors.form ? (
        <p role="alert" className="rounded-xl bg-period-soft px-3 py-2 text-xs text-ink">
          {errors.form}
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-ink-3">
          재지 않은 칸은 비워 두세요. 병원이나 검진에서 잰 값을 옮겨 적으면 좋아요.
        </p>
      )}

      <Button type="submit" full size="lg">
        저장하기
      </Button>
    </form>
  )
}
