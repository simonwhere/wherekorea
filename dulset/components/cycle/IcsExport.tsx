'use client'

import { Button, Card, useToast } from '@/components/ui'
import { buildIcs, downloadText, fertileWindowEvents } from '@/lib/logic/ics'
import { windowRangeShort, type FertilityView, type IcsAvailability } from '@/lib/logic/calendarView'

export default function IcsExport({
  availability,
  view,
  discreet,
  coupleId,
}: {
  availability: IcsAvailability
  view: FertilityView
  discreet: boolean
  coupleId?: string
}) {
  const toast = useToast()
  const { enabled, reason, windows } = availability
  // A "soft" viewer gets the discreet title (우리의 주간) and only the window event.
  const useDiscreet = discreet || view === 'soft'

  const download = () => {
    if (!enabled) return
    downloadText(
      'dulset-fertile.ics',
      buildIcs(fertileWindowEvents(windows, { discreet: useDiscreet, peak: view === 'explicit', id: coupleId })),
    )
    toast.show('캘린더 파일을 저장했어요 · 열어서 추가해 주세요')
  }

  // Tucked away: fertile-window alarms on the phone calendar are the owner's
  // explicit choice, not something the screen pushes.
  return (
    <Card className="px-0 py-0">
      <details className="group">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="text-lg">
            🗓️
          </span>
          <span className="min-w-0 flex-1 text-sm font-semibold text-ink">휴대폰 캘린더에 추가</span>
          <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-180">
            ⌄
          </span>
        </summary>
        <div className="px-4 pb-4">
          <p className="text-[13px] leading-relaxed text-ink-2">
            휴대폰 캘린더에 추가하면 하루 전 오전 9시에 알람이 울려요.
          </p>
          {enabled ? (
            <p className="mt-1 text-xs text-ink-3">
              앞으로 {windows.length}번의 {view === 'explicit' ? '예상 가임기' : '우리의 주간 (예상)'}: {windows.map(windowRangeShort).join(', ')}
              {useDiscreet ? ' · 캘린더에는 건강 용어 없이 표시돼요' : ''}
            </p>
          ) : null}
          <Button full variant="secondary" className="mt-3" disabled={!enabled} onClick={download}>
            캘린더에 추가 (.ics)
          </Button>
          {!enabled && reason ? <p className="mt-2 text-xs text-ink-3">{reason}</p> : null}
        </div>
      </details>
    </Card>
  )
}
