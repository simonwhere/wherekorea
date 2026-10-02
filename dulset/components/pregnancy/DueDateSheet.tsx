'use client'

import { useState } from 'react'
import { Button, Field, Sheet, cx, inputClass, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { DUE_DATE_NOTE } from '@/lib/content/pregnancy'
import { addDays, formatKo } from '@/lib/dates'
import { PREGNANCY_DAYS, updatePregnancy } from '@/lib/logic/pregnancy'
import { dueDateBounds, lmpBounds, overrideShiftDays, validateDueDate, validateLmp } from '@/lib/logic/pregnancyView'
import { useApp } from '@/lib/store'
import type { Pregnancy } from '@/lib/types'

export default function DueDateSheet({
  open,
  onClose,
  pregnancy,
}: {
  open: boolean
  onClose: () => void
  pregnancy: Pregnancy
}) {
  return (
    <Sheet open={open} onClose={onClose} title="예정일 수정">
      {/* Remount on open so the fields start from the saved values. */}
      {open ? <DueDateForm pregnancy={pregnancy} onDone={onClose} /> : null}
    </Sheet>
  )
}

function DueDateForm({ pregnancy, onDone }: { pregnancy: Pregnancy; onDone: () => void }) {
  const { update, today } = useApp()
  const toast = useToast()
  const lmpDue = addDays(pregnancy.lmp, PREGNANCY_DAYS)
  const savedDue = pregnancy.dueDateOverride ?? lmpDue
  const [due, setDue] = useState(savedDue)
  const [lmp, setLmp] = useState(pregnancy.lmp)
  const [showLmp, setShowLmp] = useState(false)
  const dueError = validateDueDate(due, today)
  const lmpError = validateLmp(lmp, today)
  const dueB = dueDateBounds(today)
  const lmpB = lmpBounds(today)
  const shift = pregnancy.dueDateOverride ? overrideShiftDays(pregnancy.lmp, pregnancy.dueDateOverride) : 0

  const saveDue = () => {
    if (dueError || due === savedDue) return
    update((s) => updatePregnancy(s, { dueDateOverride: due === lmpDue ? undefined : due }))
    toast.show('예정일을 바꿨어요')
    onDone()
  }
  const clearDue = () => {
    update((s) => updatePregnancy(s, { dueDateOverride: undefined }))
    toast.show('마지막 생리일 기준으로 되돌렸어요')
    onDone()
  }
  const saveLmp = () => {
    if (lmpError) return
    update((s) => updatePregnancy(s, { lmp }))
    toast.show('마지막 생리 시작일을 고쳤어요')
    onDone()
  }

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-ink-2">{DUE_DATE_NOTE}</p>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-line bg-surface p-3">
          <dt className="text-ink-3">생리일 기준 예상</dt>
          <dd className="mt-0.5 font-semibold text-ink">{formatKo(lmpDue)}</dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <dt className="text-ink-3">병원 예정일</dt>
          <dd className="mt-0.5 font-semibold text-ink">
            {pregnancy.dueDateOverride ? formatKo(pregnancy.dueDateOverride) : '아직 없어요'}
          </dd>
          {shift !== 0 ? (
            <dd className="mt-0.5 text-[11px] text-ink-3">
              생리일 기준보다 {Math.abs(shift)}일 {shift > 0 ? '늦어요' : '빨라요'}
            </dd>
          ) : null}
        </div>
      </dl>

      <Field label="병원에서 알려 준 예정일" hint={dueError ?? '주수도 이 날짜에 맞춰 다시 계산돼요.'}>
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
      <Button full onClick={saveDue} disabled={!!dueError || due === savedDue}>
        병원 예정일로 저장
      </Button>
      {pregnancy.dueDateOverride ? (
        <Button full variant="secondary" onClick={clearDue}>
          마지막 생리일 기준으로 되돌리기
        </Button>
      ) : null}

      <div className="border-t border-line pt-3">
        <button
          type="button"
          onClick={() => setShowLmp((v) => !v)}
          aria-expanded={showLmp}
          className="flex min-h-[44px] w-full items-center justify-between text-left text-sm font-medium text-ink-2"
        >
          마지막 생리 시작일 고치기
          <Icon name="chev" className={cx('h-4 w-4 text-ink-3 transition-transform', showLmp && 'rotate-180')} strokeWidth={2.2} />
        </button>
        {showLmp ? (
          <div className="mt-2 space-y-3">
            <Field
              label="마지막 생리 시작일"
              hint={
                lmpError ??
                (pregnancy.dueDateOverride
                  ? '병원 예정일이 있으면 주수는 병원 예정일을 기준으로 계산해요.'
                  : `지금: ${formatKo(pregnancy.lmp)}`)
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
              />
            </Field>
            <Button full variant="secondary" onClick={saveLmp} disabled={!!lmpError || lmp === pregnancy.lmp}>
              생리 시작일 저장
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
