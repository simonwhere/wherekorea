'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Field, Sheet, inputClass, useToast } from '@/components/ui'
import { DUE_DATE_NOTE } from '@/lib/content/pregnancy'
import { addDays, formatKo, isISODate } from '@/lib/dates'
import { PREGNANCY_DAYS, backToPreparing, dueDate, recordBirth } from '@/lib/logic/pregnancy'
import {
  defaultLmp,
  dueDateBounds,
  lmpBounds,
  toBaby,
  validateBirth,
  validateDueDate,
  validateLmp,
} from '@/lib/logic/pregnancyView'
import { canLogCycle } from '@/lib/logic/prefs'
import { STAGE_INFO, markPregnant } from '@/lib/logic/settings'
import { stampOn } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import type { BabySex } from '@/lib/types'
import { ConfirmActions, Segmented, SettingsSection } from './bits'

type SheetKind = 'pregnant' | 'birth' | 'back' | null

/** Switch tabs after a stage change (AppShell follows the hash) and start at the top like its tab bar. */
function openTab(key: 'pregnancy' | 'baby') {
  window.location.hash = key
  window.scrollTo({ top: 0 })
}

const SEX_OPTIONS: ReadonlyArray<{ value: BabySex; label: string }> = [
  { value: 'girl', label: '여아' },
  { value: 'boy', label: '남아' },
  { value: 'unknown', label: '선택 안 함' },
]

export default function StageSection() {
  const { state, viewer } = useApp()
  const [sheet, setSheet] = useState<SheetKind>(null)
  const close = useCallback(() => setSheet(null), [])
  // The stage changed (here or on the partner's phone): whatever was open no longer applies.
  useEffect(() => setSheet(null), [state.stage])
  const info = STAGE_INFO[state.stage]

  return (
    <SettingsSection title="단계" sub="단계에 맞춰 탭과 알림이 바뀌어요">
      <Card>
        <div className="flex items-start gap-3">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-2xl">
            {info.icon}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-3">지금 단계</p>
            <p className="text-base font-bold text-ink">{info.label}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{info.body}</p>
            <StageDetail />
          </div>
        </div>

        {/* Celebration only after the clinic confirmed it: a positive home test
            stays "병원 확인 전" (+ 기록 › 임테기) until then. */}
        {state.stage === 'preparing' ? (
          <>
            <Button full className="mt-4" onClick={() => setSheet('pregnant')}>
              병원에서 임신을 확인했어요
            </Button>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
              {canLogCycle(state, viewer)
                ? '테스트기 결과만 나왔다면 ‘+ 기록’의 임테기에 먼저 남겨 두고, 병원에서 확인한 뒤에 바꿔요.'
                : '병원에서 확인한 뒤에 바꿔요.'}
            </p>
          </>
        ) : null}

        {state.stage === 'pregnant' ? (
          <>
            <Button full className="mt-4" onClick={() => setSheet('birth')}>
              아기가 태어났어요 <span aria-hidden>👶</span>
            </Button>
            <Button full variant="ghost" size="sm" className="mt-1 min-h-[44px] text-ink-3" onClick={() => setSheet('back')}>
              준비 단계로 돌아가기
            </Button>
          </>
        ) : null}

        {state.stage === 'parenting' ? (
          <p className="mt-3 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-ink-2">
            준비 기록과 태교일기도 모두 그대로 남아 있어요. 우리 탭 이야기에서 육아일기로 함께 이어 가요.
          </p>
        ) : null}
      </Card>

      {/* Each sheet only while the stage still fits it: if the partner changes the
          stage on their phone, a sheet left open here closes instead of
          overwriting what they entered. */}
      <Sheet open={sheet === 'pregnant' && state.stage === 'preparing'} onClose={close} title="축하해요! 🎉">
        {sheet === 'pregnant' && state.stage === 'preparing' ? <PregnantForm onDone={close} /> : null}
      </Sheet>
      <Sheet open={sheet === 'birth' && state.stage === 'pregnant'} onClose={close} title="아기가 태어났어요 👶">
        {sheet === 'birth' && state.stage === 'pregnant' ? <BirthForm onDone={close} /> : null}
      </Sheet>
      <Sheet open={sheet === 'back' && state.stage === 'pregnant'} onClose={close} title="준비 단계로 돌아가기">
        {sheet === 'back' && state.stage === 'pregnant' ? <BackConfirm onDone={close} /> : null}
      </Sheet>
    </SettingsSection>
  )
}

function StageDetail() {
  const { state } = useApp()
  const p = state.pregnancy
  if (state.stage === 'pregnant' && p && isISODate(p.lmp) && (!p.dueDateOverride || isISODate(p.dueDateOverride))) {
    return <p className="mt-1 text-xs font-medium text-ink">출산 예정일 {formatKo(dueDate(p), { year: true })} (예상)</p>
  }
  if (state.stage === 'parenting' && state.baby && isISODate(state.baby.birthDate)) {
    return (
      <p className="mt-1 text-xs font-medium text-ink">
        {state.baby.name} · {formatKo(state.baby.birthDate, { year: true })} 출생
      </p>
    )
  }
  return null
}

export function PregnantForm({ onDone }: { onDone: () => void }) {
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
    update((s) => markPregnant(s, { lmp, dueDate: due || undefined }, today, me.id, stampOn(today)))
    toast.show('축하해요! 임신 기록을 시작했어요')
    onDone()
    openTab('pregnancy')
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-2">
        이제 둘셋이 임신 주수와 검사 일정을 함께 챙길게요. {partner.name}님에게도 소식이 전해져요. 지금까지의 기록은 그대로
        남아요.
      </p>
      <Field
        label="마지막 생리 시작일"
        hint={
          lmpError ??
          (due && !dueError
            ? '주수는 병원에서 알려 준 예정일을 기준으로 계산해요.'
            : `예정일 (예상): ${formatKo(addDays(lmp, PREGNANCY_DAYS), { year: true })}`)
        }
      >
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
        임신 기록 시작하기
      </Button>
    </form>
  )
}

export function BirthForm({ onDone }: { onDone: () => void }) {
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
    toast.show(`${baby.name}, 반가워요! 축하해요 🎉`)
    onDone()
    openTab('baby')
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-2">
        정말 축하해요! 이제 육아 기록으로 이어 가요. 태교일기와 지금까지의 기록은 그대로 남아 있어요.
      </p>
      <Field label="이름 또는 태명" hint="나중에 바꿔도 괜찮아요. 비워 두면 ‘아기’로 불러요.">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 튼튼이"
          maxLength={20}
          autoComplete="off"
        />
      </Field>
      <Field label="태어난 날" hint={error ?? formatKo(birthDate, { year: true })}>
        <input
          type="date"
          className={inputClass}
          value={birthDate}
          min={lmp}
          max={today}
          onChange={(e) => setBirthDate(e.target.value)}
          aria-invalid={!!error}
          required
        />
      </Field>
      <Segmented legend="성별" options={SEX_OPTIONS} value={sex} onChange={setSex} />
      <Button type="submit" full size="lg" disabled={!!error}>
        육아 기록 시작하기
      </Button>
    </form>
  )
}

export function BackConfirm({ onDone }: { onDone: () => void }) {
  const { update, today } = useApp()
  const toast = useToast()
  const confirm = () => {
    update((s) => backToPreparing(s, today))
    toast.show('준비 단계로 돌아왔어요')
    onDone()
  }
  return (
    <div>
      <p className="text-sm leading-relaxed text-ink">어떤 이유든 괜찮아요. 기록은 그대로 남아 있어요.</p>
      <p className="mt-2 text-xs leading-relaxed text-ink-3">
        준비 단계로 돌아가면 오늘 체크와 달력이 다시 보여요. 서두르지 않아도 괜찮고, 언제든 다시 임신 기록을 시작할 수 있어요.
      </p>
      <ConfirmActions variant="secondary" confirmLabel="준비 단계로 돌아가기" onConfirm={confirm} onCancel={onDone} />
    </div>
  )
}
