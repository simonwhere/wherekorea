'use client'

import { useId, useState } from 'react'
import SettingsLink from '@/components/cycle/SettingsLink'
import { QuickDateChips } from '@/components/onboarding/parts'
import { Button, Card, inputClass, useToast } from '@/components/ui'
import { formatKo, isISODate } from '@/lib/dates'
import type { FertilityView } from '@/lib/logic/calendarView'
import { logPeriodStart } from '@/lib/logic/logs'
import { useApp } from '@/lib/store'

/**
 * Empty state for the cycle owner: nothing logged yet — one date is enough to
 * start predicting. The date comes first, with [오늘][어제][1주 전]… chips for
 * "it was around mid-September" (N15).
 */
export default function FirstPeriodCard({ view }: { view: FertilityView }) {
  const { state, update, today, viewer } = useApp()
  const toast = useToast()
  const inputId = useId()
  const errorId = useId()
  const [date, setDate] = useState('')
  const valid = isISODate(date) && date <= today
  const error = date && !valid ? (isISODate(date) ? '오늘 이후 날짜는 기록할 수 없어요.' : '날짜를 다시 골라 주세요.') : null

  const save = () => {
    if (!valid) return
    update((s) => logPeriodStart(s, date, viewer, today))
    toast.show(`${formatKo(date, { weekday: false })} 생리 시작으로 기록했어요`)
  }

  return (
    <Card tone="brand">
      <div className="text-3xl" aria-hidden>
        🌷
      </div>
      <h2 className="mt-2 text-lg font-bold text-ink">마지막 생리 시작일을 알려 주세요</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
        한 번만 기록해도 다음 생리 예정일
        {view === 'hidden' ? '을' : view === 'soft' ? '과 우리의 주간을' : '과 예상 가임기를'} 계산해 달력에 보여줘요.
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <label htmlFor={inputId} className="block text-xs font-semibold text-ink-2">
          생리 시작일
        </label>
        <input
          id={inputId}
          type="date"
          max={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={inputClass}
        />
        <QuickDateChips today={today} value={date} onPick={setDate} label="생리 시작일 빠른 선택" />
        {error ? (
          <p id={errorId} className="text-xs text-period">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" full disabled={!valid}>
          {valid ? `${formatKo(date, { weekday: false })} 시작으로 기록하기` : '마지막 생리 시작일 기록하기'}
        </Button>
      </form>
      <p className="mt-3 text-xs leading-relaxed text-ink-3">
        쓰던 앱의 시작일 몇 개를 더 옮기면 그 주기로 계산해요. 그 전까지는 설정한 주기 {state.cycle.cycleLength}일을 써요.{' '}
        <SettingsLink>주기 길이 바꾸기</SettingsLink>
      </p>
    </Card>
  )
}
