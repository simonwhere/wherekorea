'use client'

import { useId, useState } from 'react'
import { ChoiceButton, LoggedList, hhmm, ro, type LineLevel, type SaveLog } from '@/components/log/parts'
import { inputClass } from '@/components/ui'
import { LH_CHOICES } from '@/lib/content/fertility'
import { LH_LABEL, type FertilityView } from '@/lib/logic/calendarView'
import { MAX_LH_PER_DAY, addLHTest, isTime, lhChangesEstimate, lhTestsOn, removeLHTest } from '@/lib/logic/logs'
import { nowOn } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import type { ISODate, LHResult } from '@/lib/types'

const LEVEL: Record<LHResult, LineLevel> = { negative: 'none', faint: 'faint', positive: 'full', peak: 'dark' }

/** LH (배테기): 음성 · 희미 · 양성 · 가장 진함, up to two a day with a time. */
export default function LHPanel({
  date,
  view,
  paused,
  save,
}: {
  date: ISODate
  view: FertilityView
  /** Rest cycle / positive test waiting: dates aren't shown, so don't talk about recalculating them. */
  paused: boolean
  save: SaveLog
}) {
  const { state, today, viewer } = useApp()
  const timeId = useId()
  const [time, setTime] = useState(() => hhmm(nowOn(today)))
  const tests = lhTestsOn(state.lhTests, date)
  const at = isTime(time) ? time : undefined
  const sameTime = tests.find((t) => (t.time ?? '') === (at ?? ''))
  const full = tests.length >= MAX_LH_PER_DAY && !sameTime

  const pick = (result: LHResult) => {
    const label = LH_LABEL[result]
    const input = { date, time: at, result, by: viewer }
    // Only when the estimate really moved (the cycle's first surge), and only where dates are shown.
    const moved = !paused && lhChangesEstimate(state, input)
    const again = moved ? (view === 'explicit' ? ' · 배란 예상일을 다시 계산했어요' : ' · 예상 날짜를 다시 계산했어요') : ''
    save((s) => addLHTest(s, input, today), { kind: 'lh', date }, `LH ${ro(label)} 남겼어요${again}`)
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-ink-2">
        검사선(T)을 대조선(C)과 비교해 골라 주세요.
        {paused ? '' : view === 'explicit' ? ' 첫 양성이 나오면 배란 예상일을 다시 계산해요.' : ' 첫 양성이 나오면 예상 날짜를 다시 계산해요.'}
      </p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="LH 테스트 결과">
        {LH_CHOICES.map((c) => (
          <ChoiceButton
            key={c.result}
            label={LH_LABEL[c.result]}
            hint={c.hint}
            level={LEVEL[c.result]}
            current={sameTime?.result === c.result}
            onClick={() => pick(c.result)}
          />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor={timeId} className="shrink-0 text-xs font-semibold text-ink-2">
          검사 시각
        </label>
        <input id={timeId} type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${inputClass} w-32`} />
      </div>
      {full ? (
        <p className="text-xs leading-relaxed text-ink-3">
          하루 {MAX_LH_PER_DAY}번까지 남겨요. 지금 고르면 시각이 가까운 기록을 바꿔요.
        </p>
      ) : null}
      <LoggedList
        title="이 날의 LH 기록"
        items={tests.map((t) => ({
          key: `${t.time ?? ''}-${t.result}`,
          text: `${t.time ?? '시각 없음'} · ${LH_LABEL[t.result]}`,
          removeLabel: `${t.time ? `${t.time} ` : ''}LH ${LH_LABEL[t.result]} 기록 지우기`,
          onRemove: () => save((s) => removeLHTest(s, date, t.time), { kind: 'lh', date }, 'LH 기록을 지웠어요', { keepOpen: true }),
        }))}
      />
    </div>
  )
}
