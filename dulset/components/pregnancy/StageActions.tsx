'use client'

import { useCallback, useState } from 'react'
import { Button, Card, Field, Sheet, cx, inputClass, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { formatKo } from '@/lib/dates'
import { recordBirth } from '@/lib/logic/pregnancy'
import { endPregnancy } from '@/lib/logic/today'
import { toBaby, validateBirth } from '@/lib/logic/pregnancyView'
import { useApp } from '@/lib/store'
import type { BabySex } from '@/lib/types'
import { goToTab } from './nav'

const SEX_OPTIONS: { value: BabySex; label: string }[] = [
  { value: 'girl', label: '여아' },
  { value: 'boy', label: '남아' },
  { value: 'unknown', label: '선택 안 함' },
]

export default function StageActions() {
  const [birthOpen, setBirthOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  // Stable closers, so an open sheet does not re-focus its panel on re-render.
  const closeBirth = useCallback(() => setBirthOpen(false), [])
  const closeEnd = useCallback(() => setEndOpen(false), [])

  return (
    <section className="mt-6" aria-label="단계 바꾸기">
      <Card tone="brand" className="text-center">
        <Button size="lg" full onClick={() => setBirthOpen(true)}>
          아기가 태어났어요 <Icon name="baby" className="h-5 w-5" strokeWidth={2} />
        </Button>
      </Card>
      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={() => setEndOpen(true)}
          className="min-h-[44px] px-3 text-xs text-ink-3 underline underline-offset-2 hover:text-ink-2"
        >
          임신 기록을 끝내고 준비 단계로
        </button>
      </div>

      <Sheet open={birthOpen} onClose={closeBirth} title="아기가 태어났어요">
        {birthOpen ? <BirthForm onDone={closeBirth} /> : null}
      </Sheet>
      <Sheet open={endOpen} onClose={closeEnd} title="임신 기록 종료">
        <EndConfirm onDone={closeEnd} />
      </Sheet>
    </section>
  )
}

function BirthForm({ onDone }: { onDone: () => void }) {
  const { state, update, today } = useApp()
  const toast = useToast()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState(today)
  const [sex, setSex] = useState<BabySex>('unknown')
  const lmp = state.pregnancy?.lmp
  const error = validateBirth({ name, birthDate, sex }, today, lmp)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (error) return
    const baby = toBaby({ name, birthDate, sex })
    update((s) => recordBirth(s, baby))
    toast.show(`${baby.name}, 반가워요!`)
    onDone()
    goToTab('baby')
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-2">축하해요!</p>
      <Field label="이름 또는 태명" hint="비워 두면 ‘아기’로 불러요.">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 튼튼이"
          maxLength={20}
          autoComplete="off"
        />
      </Field>
      <Field label="태어난 날" hint={error ?? formatKo(birthDate)}>
        <input
          type="date"
          className={inputClass}
          value={birthDate}
          min={lmp}
          max={today}
          onChange={(e) => setBirthDate(e.target.value)}
          aria-invalid={!!error}
        />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold text-ink-2">성별</legend>
        <div className="grid grid-cols-3 gap-2">
          {SEX_OPTIONS.map((o) => {
            const on = sex === o.value
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => setSex(o.value)}
                className={cx(
                  'h-11 rounded-xl border text-sm font-medium transition-colors',
                  on ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
                )}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </fieldset>
      <Button type="submit" full size="lg" disabled={!!error}>
        육아 기록 시작하기
      </Button>
    </form>
  )
}

function EndConfirm({ onDone }: { onDone: () => void }) {
  const { update, today } = useApp()
  const toast = useToast()
  // endPregnancy also starts the 42-day 'loss' quiet (ttc.startLossRest).
  const confirm = () => {
    update((s) => endPregnancy(s, today))
    toast.show('준비 단계로 돌아왔어요. 당분간 날짜 예상과 알림은 쉬어요')
    onDone()
    goToTab('today')
  }
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-ink">지금까지의 기록은 그대로 남아요.</p>
      <div className="grid gap-2">
        <Button full variant="secondary" onClick={confirm}>
          준비 단계로 돌아가기
        </Button>
        <Button full variant="ghost" onClick={onDone}>
          그대로 둘게요
        </Button>
      </div>
    </div>
  )
}
