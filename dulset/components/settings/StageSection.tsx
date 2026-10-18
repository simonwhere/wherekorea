'use client'

import { useCallback, useEffect, useState } from 'react'
import ClinicSwitch from '@/components/cycle/ClinicSwitch'
import { Button, Card, Field, Sheet, inputClass, useToast } from '@/components/ui'
import { Icon, IconTile, type IconName } from '@/components/ui/icons'
import { DUE_DATE_NOTE } from '@/lib/content/pregnancy'
import { addDays, formatKo, isISODate } from '@/lib/dates'
import { PREGNANCY_DAYS, dueDate, recordBirth } from '@/lib/logic/pregnancy'
import { endPregnancy } from '@/lib/logic/today'
import { defaultLmp, dueDateBounds, lmpBounds, toBaby, validateBirth, validateDueDate, validateLmp } from '@/lib/logic/pregnancyView'
import { canLogCycle } from '@/lib/logic/prefs'
import { STAGE_INFO, markPregnant } from '@/lib/logic/settings'
import { stampOn } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import type { BabySex, Stage } from '@/lib/types'
import { ConfirmActions, Segmented, SettingsSection } from './bits'

type SheetKind = 'pregnant' | 'birth' | 'back' | null

/** Switch tabs after a stage change (AppShell follows the hash) and start at the top like its tab bar. */
function openTab(key: 'pregnancy' | 'baby') {
  window.location.hash = key
  window.scrollTo({ top: 0 })
}

/** The stage tile's line icon (STAGE_INFO's emoji stays for text surfaces). */
const STAGE_ICON: Record<Stage, IconName> = { preparing: 'sprout', pregnant: 'bump', parenting: 'baby' }

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
    <SettingsSection id="stage" title="단계">
      <Card>
        <div className="flex items-start gap-3">
          <IconTile name={STAGE_ICON[state.stage]} tone="bg-brand-soft" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-3">지금 단계</p>
            <p className="text-base font-bold text-ink">{info.label}</p>
            <StageDetail />
          </div>
        </div>

        {/* Celebration only after the clinic confirmed it: a positive home test
            stays "병원 확인 전" (+ 기록 › 임테기) until then. */}
        {state.stage === 'preparing' ? (
          <Button full className="mt-4" onClick={() => setSheet('pregnant')}>
            병원에서 임신을 확인했어요
          </Button>
        ) : null}

        {state.stage === 'pregnant' ? (
          <>
            <Button full className="mt-4" onClick={() => setSheet('birth')}>
              아기가 태어났어요 <Icon name="baby" className="h-5 w-5" strokeWidth={2} />
            </Button>
            <Button full variant="ghost" size="sm" className="mt-1 min-h-[44px] text-ink-3" onClick={() => setSheet('back')}>
              준비 단계로 돌아가기
            </Button>
          </>
        ) : null}

      </Card>

      {/* "병원과 함께 준비 중" (N13): the cycle owner's switch, also on the home's 더 보기 and the 주기 tab. */}
      {state.stage === 'preparing' && canLogCycle(state, viewer) ? <ClinicSwitch className="mt-2 py-2" /> : null}

      {/* Each sheet only while the stage still fits it: if the partner changes the
          stage on their phone, a sheet left open here closes instead of
          overwriting what they entered. */}
      <Sheet open={sheet === 'pregnant' && state.stage === 'preparing'} onClose={close} title="축하해요!">
        {sheet === 'pregnant' && state.stage === 'preparing' ? <PregnantForm onDone={close} /> : null}
      </Sheet>
      <Sheet open={sheet === 'birth' && state.stage === 'pregnant'} onClose={close} title="아기가 태어났어요">
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
      <p className="text-sm leading-relaxed text-ink-2">{partner.name}님에게도 소식이 전해져요.</p>
      <Field
        label="마지막 생리 시작일"
        hint={lmpError ?? (due && !dueError ? undefined : `예정일 (예상): ${formatKo(addDays(lmp, PREGNANCY_DAYS), { year: true })}`)}
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
      <Field label="병원에서 알려 준 예정일 (선택)" hint={dueError}>
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
    toast.show(`${baby.name}, 반가워요!`)
    onDone()
    openTab('baby')
  }

  return (
    <form onSubmit={submit} className="space-y-4">
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
  // endPregnancy also starts the 42-day 'loss' quiet (ttc.startLossRest): no
  // date estimates or cycle notices until its last day, whatever gets logged.
  const confirm = () => {
    update((s) => endPregnancy(s, today))
    toast.show('준비 단계로 돌아왔어요')
    onDone()
  }
  return (
    <div>
      <p className="text-sm leading-relaxed text-ink">기록은 그대로 남고, 당분간 날짜 예상과 알림은 쉬어요.</p>
      <ConfirmActions variant="secondary" confirmLabel="준비 단계로 돌아가기" onConfirm={confirm} onCancel={onDone} />
    </div>
  )
}
