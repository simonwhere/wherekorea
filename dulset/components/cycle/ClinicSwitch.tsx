'use client'

// "병원과 함께 준비 중" (N13) — the cycle owner's switch, shared by the home's
// 더 보기 and 설정 › 단계. Unlike the rest switch, a logged period does not
// turn it off: the clinic sets the timing (lib/logic/clinic).

import { Card, Toggle, useToast } from '@/components/ui'
import { CLINIC_LABEL } from '@/lib/logic/calendarView'
import { isClinicMode, setClinicMode } from '@/lib/logic/clinic'
import { useApp } from '@/lib/store'

export default function ClinicSwitch({ className }: { className?: string }) {
  const { state, update, today } = useApp()
  const toast = useToast()
  const on = isClinicMode(state)
  const onChange = (next: boolean) => {
    update((s) => setClinicMode(s, next, today))
    toast.show(next ? '병원과 함께 준비해요. 날짜 예상과 알림은 쉬어요' : '병원 준비를 마쳤어요. 예상과 알림이 돌아와요')
  }
  return (
    <Card className={className ?? 'py-2'}>
      <Toggle
        checked={on}
        onChange={onChange}
        label={CLINIC_LABEL}
        description={
          on
            ? '날짜 예상과 알림은 쉬고, 홈은 다음 병원 일정부터 보여 줘요. 생리를 기록해도 꺼지지 않아요.'
            : '병원에서 시기를 정하는 주기라면 켜 두세요. 예상과 알림이 쉬고, 홈은 다음 병원 일정부터 보여 줘요.'
        }
      />
    </Card>
  )
}
