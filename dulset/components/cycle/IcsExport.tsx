'use client'

import { Button, Card, useToast } from '@/components/ui'
import { buildIcs, downloadText, fertileWindowEvents } from '@/lib/logic/ics'
import { windowRangeShort, type FertilityView, type IcsAvailability } from '@/lib/logic/calendarView'

export default function IcsExport({
  availability,
  view,
  discreet,
}: {
  availability: IcsAvailability
  view: FertilityView
  discreet: boolean
}) {
  const toast = useToast()
  const { enabled, reason, windows } = availability
  // A "soft" viewer gets the discreet titles (우리의 주간 / 둘만의 저녁) in their calendar too.
  const useDiscreet = discreet || view === 'soft'

  const download = () => {
    if (!enabled) return
    downloadText('dulset-fertile.ics', buildIcs(fertileWindowEvents(windows, useDiscreet)))
    toast.show('캘린더 파일을 저장했어요 · 열어서 추가해 주세요')
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-2xl">
          🗓️
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-ink">휴대폰 캘린더에 추가</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            두 사람 모두 휴대폰 캘린더에 추가하면 하루 전 오전 9시에 알람이 울려요.
          </p>
          {enabled ? (
            <p className="mt-1 text-xs text-ink-3">
              앞으로 {windows.length}번의 {view === 'explicit' ? '예상 가임기' : '우리의 주간 (예상)'}: {windows.map(windowRangeShort).join(', ')}
              {useDiscreet ? ' · 캘린더에는 건강 용어 없이 표시돼요' : ''}
            </p>
          ) : null}
        </div>
      </div>
      <Button full variant="secondary" className="mt-3" disabled={!enabled} onClick={download}>
        캘린더에 추가 (.ics)
      </Button>
      {!enabled && reason ? <p className="mt-2 text-xs text-ink-3">{reason}</p> : null}
    </Card>
  )
}
