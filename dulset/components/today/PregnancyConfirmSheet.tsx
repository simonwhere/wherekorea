'use client'

import { useEffect, useState } from 'react'
import { Button, Disclaimer, Field, Sheet, inputClass, useToast } from '@/components/ui'
import { addDays, formatKo } from '@/lib/dates'
import { dueDate, formatGA, gestationalAge } from '@/lib/logic/pregnancy'
import { LMP_MAX_DAYS, confirmPregnancy, isValidLmp, lastPeriodStart, stampOn } from '@/lib/logic/today'
import { clearPositivePending } from '@/lib/logic/ttc'
import { useApp } from '@/lib/store'

/**
 * "병원에서 확인했어요" — after the clinic confirmed it: check the LMP, then
 * switch the space to the pregnancy stage (and settle the positive-test
 * waiting state). Celebration only from here on.
 */
export default function PregnancyConfirmSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const fallback = lastPeriodStart(state) ?? today
  const [lmp, setLmp] = useState(fallback)

  useEffect(() => {
    if (open) setLmp(lastPeriodStart(state) ?? today)
    // Only reset when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const valid = isValidLmp(lmp, today)
  const preview = valid ? { due: dueDate({ lmp, confirmedAt: today }), ga: gestationalAge({ lmp, confirmedAt: today }, today) } : null

  const confirm = () => {
    if (!valid) return
    update((s) => clearPositivePending(confirmPregnancy(s, lmp, today, me.id, partner.id, stampOn(today))))
    toast.show(`축하해요! 🎉 ${partner.name}님에게도 알렸어요`)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="축하해요! 🎉">
      <p className="text-sm leading-relaxed text-ink-2">
        마지막 생리 시작일로 임신 주수와 출산 예정일을 계산해요. 기록하면 둘셋이 임신 모드로 바뀌고, {partner.name}님
        화면에도 함께 보여요.
      </p>
      <div className="mt-4">
        <Field label="마지막 생리 시작일" hint="달력에 마지막으로 기록한 날이에요. 다르면 고쳐 주세요.">
          <input
            type="date"
            className={inputClass}
            value={lmp}
            min={addDays(today, -LMP_MAX_DAYS)}
            max={today}
            onChange={(e) => setLmp(e.target.value)}
          />
        </Field>
      </div>
      {preview ? (
        <div className="mt-4 rounded-xl bg-brand-soft p-3 text-sm text-brand-ink">
          <div>
            오늘 기준 <b>임신 {formatGA(preview.ga)}</b>
          </div>
          <div className="mt-0.5">
            출산 예정일 <b>{formatKo(preview.due, { year: true })}</b> (예상)
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-period" role="alert">
          오늘 이전, 최근 10개월 안의 날짜를 골라 주세요.
        </p>
      )}
      <Disclaimer>
        병원 초음파로 받은 예정일이 있다면 임신 탭에서 바꿀 수 있어요. 아직 확실하지 않다면 병원에서 확인한 뒤 기록해도
        괜찮아요.
      </Disclaimer>
      <div className="mt-5 flex gap-2">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          나중에
        </Button>
        <Button onClick={confirm} disabled={!valid} className="flex-[2]">
          임신 기록 시작하기
        </Button>
      </div>
    </Sheet>
  )
}
