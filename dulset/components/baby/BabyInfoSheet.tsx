'use client'

import { useState } from 'react'
import { Button, Field, Sheet, cx, inputClass, useToast } from '@/components/ui'
import { SEX_EMOJI, SEX_LABEL, SEX_OPTIONS } from '@/lib/content/baby'
import { formatKo } from '@/lib/dates'
import { birthBounds, saveBabyInfo, toBabyInfo, validateBabyInfo, type BabyInput } from '@/lib/logic/babyView'
import { recordBirth } from '@/lib/logic/pregnancy'
import { useApp } from '@/lib/store'

/** Enter (mode 'create' → recordBirth) or edit the baby's name, birth date and sex. */
export default function BabyInfoSheet({
  open,
  onClose,
  mode,
}: {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit'
}) {
  return (
    <Sheet open={open} onClose={onClose} title={mode === 'create' ? '아기 정보 입력 👶' : '아기 정보 수정'}>
      {/* Remount on open so the fields start from the saved values. */}
      {open ? <BabyInfoForm mode={mode} onDone={onClose} /> : null}
    </Sheet>
  )
}

function BabyInfoForm({ mode, onDone }: { mode: 'create' | 'edit'; onDone: () => void }) {
  const { state, update, today } = useApp()
  const toast = useToast()
  const saved = state.baby
  const [input, setInput] = useState<BabyInput>({
    name: saved?.name ?? '',
    birthDate: saved?.birthDate ?? today,
    sex: saved?.sex ?? 'unknown',
  })
  const error = validateBabyInfo(input, today)
  const bounds = birthBounds(today)
  const birthChanged = mode === 'edit' && saved && saved.birthDate !== input.birthDate

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (error) return
    if (mode === 'create') {
      const baby = toBabyInfo(input)
      update((s) => recordBirth(s, baby))
      toast.show(`${baby.name}, 반가워요! 🎉`)
    } else {
      update((s) => saveBabyInfo(s, input))
      toast.show('아기 정보를 고쳤어요')
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {mode === 'create' ? (
        <p className="text-sm leading-relaxed text-ink-2">
          태어난 날을 알려 주면 기념일, 영유아 건강검진 시기, 성장 기록을 우리 둘이 함께 볼 수 있어요.
        </p>
      ) : null}
      <Field label="이름 또는 태명" hint="비워 두면 ‘아기’로 불러요.">
        <input
          className={inputClass}
          value={input.name}
          onChange={(e) => setInput({ ...input, name: e.target.value })}
          placeholder="예: 튼튼이"
          maxLength={20}
          autoComplete="off"
        />
      </Field>
      <Field
        label="태어난 날"
        hint={
          error ? (
            <span className="text-period">{error}</span>
          ) : birthChanged ? (
            '기념일과 검진 날짜가 새 날짜로 다시 계산돼요.'
          ) : (
            formatKo(input.birthDate, { year: true })
          )
        }
      >
        <input
          type="date"
          className={inputClass}
          value={input.birthDate}
          min={bounds.min}
          max={bounds.max}
          onChange={(e) => setInput({ ...input, birthDate: e.target.value })}
          aria-invalid={!!error}
          required
        />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold text-ink-2">성별</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="성별">
          {SEX_OPTIONS.map((value) => {
            const on = input.sex === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setInput({ ...input, sex: value })}
                className={cx(
                  'h-11 rounded-xl border text-sm font-medium transition-colors',
                  on ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
                )}
              >
                <span aria-hidden className="mr-1">
                  {SEX_EMOJI[value]}
                </span>
                {SEX_LABEL[value]}
              </button>
            )
          })}
        </div>
      </fieldset>
      <Button type="submit" full size="lg" disabled={!!error}>
        {mode === 'create' ? '육아 기록 시작하기' : '저장하기'}
      </Button>
    </form>
  )
}
