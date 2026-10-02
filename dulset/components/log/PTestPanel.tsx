'use client'

import { useEffect, useRef, useState } from 'react'
import { ChoiceButton, LoggedList, hhmm, ro, type LineLevel, type SaveLog } from '@/components/log/parts'
import { Button } from '@/components/ui'
import { PTEST_CHOICES, PTEST_EARLY_NOTE, ptestAfterCopy } from '@/lib/content/fertility'
import { PTEST_LABEL, type FertilityView } from '@/lib/logic/calendarView'
import { addPregnancyTest, pregnancyTestsOn, removePregnancyTest } from '@/lib/logic/logs'
import { activePositivePending } from '@/lib/logic/ttc'
import { nowOn } from '@/lib/logic/today'
import { uid } from '@/lib/id'
import { useApp } from '@/lib/store'
import type { ISODate, PregnancyTestResult } from '@/lib/types'

const LEVEL: Record<PregnancyTestResult, LineLevel> = { negative: 'none', faint: 'faint', positive: 'full' }

/** 임테기: 음성 · 희미 · 양성. A positive one gets a calm "병원에서 확인해 봐요", no celebration. */
export default function PTestPanel({
  date,
  view,
  save,
  onClose,
}: {
  date: ISODate
  view: FertilityView
  save: SaveLog
  onClose: () => void
}) {
  const { state, today, viewer } = useApp()
  const [logged, setLogged] = useState<string | null>(null)
  const tests = pregnancyTestsOn(state.pregnancyTests, date)
  // Undo (or the other phone) may remove it — then go back to the choices.
  const last = logged ? state.pregnancyTests.find((t) => t.id === logged) : undefined

  const pick = (result: PregnancyTestResult) => {
    const id = uid()
    const time = date === today ? hhmm(nowOn(today)) : undefined
    save(
      (s) => addPregnancyTest(s, { id, date, time, result, by: viewer }, today).state,
      { kind: 'ptest', id },
      `임테기 ${ro(PTEST_LABEL[result])} 남겼어요`,
      { keepOpen: true },
    )
    setLogged(id)
  }

  if (last) {
    return <After result={last.result} view={view} waiting={!!activePositivePending(state)} onClose={onClose} />
  }

  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-ink-2">
        {PTEST_EARLY_NOTE}
      </p>
      <div className="grid gap-2" role="group" aria-label="임테기 결과">
        {PTEST_CHOICES.map((c) => (
          <ChoiceButton key={c.result} label={PTEST_LABEL[c.result]} hint={c.hint} level={LEVEL[c.result]} onClick={() => pick(c.result)} />
        ))}
      </div>
      <LoggedList
        title="이 날의 임테기 기록"
        items={tests.map((t) => ({
          key: t.id,
          text: `${t.time ?? '시각 없음'} · ${PTEST_LABEL[t.result]}`,
          removeLabel: `${t.time ? `${t.time} ` : ''}임테기 ${PTEST_LABEL[t.result]} 기록 지우기`,
          onRemove: () =>
            save((s) => removePregnancyTest(s, t.id), { kind: 'ptest', id: t.id }, '임테기 기록을 지웠어요', { keepOpen: true }),
        }))}
      />
    </div>
  )
}

function After({
  result,
  view,
  waiting,
  onClose,
}: {
  result: PregnancyTestResult
  view: FertilityView
  /** "병원 확인 전" is on (false for a past positive already followed by a period). */
  waiting: boolean
  onClose: () => void
}) {
  const copy = ptestAfterCopy(result, view === 'explicit', waiting)
  // The tapped choice is gone — move focus here so keyboard/screen-reader users keep their place.
  const titleRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => titleRef.current?.focus(), [])
  const toPlan = result === 'positive' && waiting
  return (
    <div className="space-y-3" role="status">
      <div className="rounded-xl2 border border-line bg-surface p-4">
        <p ref={titleRef} tabIndex={-1} className="text-lg font-bold text-ink outline-none">
          {copy.title}
        </p>
        {copy.body.map((b) => (
          <p key={b} className="mt-1 text-[13px] leading-relaxed text-ink-2">
            {b}
          </p>
        ))}
      </div>
      <div className={toPlan ? 'grid grid-cols-2 gap-2' : ''}>
        {toPlan ? (
          <Button
            variant="secondary"
            onClick={() => {
              onClose()
              window.location.hash = 'plan'
              window.scrollTo({ top: 0 })
            }}
          >
            병원 일정 넣기
          </Button>
        ) : null}
        <Button full={!toPlan} onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  )
}
