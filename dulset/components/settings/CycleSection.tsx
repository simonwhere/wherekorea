'use client'

import { useEffect, useState } from 'react'
import { Card, Field, NumberStepper, cx, inputClass } from '@/components/ui'
import { formatKo, isISODate } from '@/lib/dates'
import { cycleStats } from '@/lib/logic/cycle'
import {
  CYCLE_LENGTH_RANGE,
  PERIOD_LENGTH_RANGE,
  cycleSourceNote,
  setCycle,
  setTtcStart,
  ttcBounds,
  validateTtcStart,
} from '@/lib/logic/settings'
import { canLogCycle, canSeeCycleDetails } from '@/lib/logic/prefs'
import { useApp } from '@/lib/store'
import { SettingsSection } from './bits'

/**
 * 주기 설정. The cycle numbers are the cycle owner's record: only they change
 * them (prefs.canLogCycle), and a partner sees the averages only when the owner
 * shared the details (prefs.canSeeCycleDetails) — averages come from the
 * period days. "함께 준비를 시작한 날" belongs to both.
 */
export default function CycleSection() {
  const { state, cycleOwner, viewer } = useApp()
  const owner = canLogCycle(state, viewer)
  const details = canSeeCycleDetails(state, viewer)

  return (
    <SettingsSection
      title="주기 설정"
      sub={owner ? `${cycleOwner.name}님 주기 기준 · 모든 값은 예상에 쓰는 참고값이에요` : `${cycleOwner.name}님이 관리해요`}
    >
      <Card>
        {owner ? (
          <CycleNumbers />
        ) : details ? (
          <>
            <CycleStatsNote />
            <p className="mt-2 text-xs leading-relaxed text-ink-3">주기 길이와 생리 기간은 {cycleOwner.name}님이 바꿔요.</p>
          </>
        ) : (
          <p className="text-xs leading-relaxed text-ink-2">
            주기 기록과 설정은 {cycleOwner.name}님만 보고 바꿔요. 함께 준비를 시작한 날은 둘이 같이 정해요.
          </p>
        )}

        <div className="mt-3 border-t border-line pt-3">
          <TtcStartField />
        </div>
      </Card>
    </SettingsSection>
  )
}

/** Where the estimates come from: the logged average, or the numbers below. */
function CycleStatsNote() {
  const { state } = useApp()
  const stats = cycleStats(state.periods, state.cycle)
  const fromLogs = stats.source === 'logs'
  const note = cycleSourceNote(stats, state.periods.length)
  return (
    <div className={cx('rounded-xl p-3', fromLogs ? 'bg-ok-soft' : 'bg-surface-2')} role="status">
      {fromLogs ? (
        <p className="text-sm text-ink">
          기록으로 계산한 평균 주기 <strong className="font-bold tabular-nums">{stats.average}일</strong>
          {stats.min !== undefined && stats.max !== undefined && stats.min !== stats.max ? (
            <span className="text-xs text-ink-2">
              {' '}
              (최근 {stats.min}~{stats.max}일)
            </span>
          ) : null}
        </p>
      ) : null}
      <p className={cx('text-xs leading-relaxed text-ink-2', fromLogs && 'mt-1')}>{note}</p>
    </div>
  )
}

/** The owner's own numbers (read by the estimates until enough periods are logged). */
function CycleNumbers() {
  const { state, update } = useApp()
  const fromLogs = cycleStats(state.periods, state.cycle).source === 'logs'
  return (
    <>
      <CycleStatsNote />
      <div className="mt-2 divide-y divide-line">
        <StepperRow
          label="평균 주기 길이"
          hint={fromLogs ? '지금은 기록 평균을 쓰고 있어요' : '생리 시작일부터 다음 시작일 전날까지'}
          muted={fromLogs}
        >
          <NumberStepper
            label="평균 주기 길이"
            value={state.cycle.cycleLength}
            min={CYCLE_LENGTH_RANGE.min}
            max={CYCLE_LENGTH_RANGE.max}
            unit="일"
            onChange={(n) => update((s) => setCycle(s, { cycleLength: n }))}
          />
        </StepperRow>
        <StepperRow label="생리 기간" hint="끝나는 날을 기록하지 않았을 때 써요">
          <NumberStepper
            label="생리 기간"
            value={state.cycle.periodLength}
            min={PERIOD_LENGTH_RANGE.min}
            max={PERIOD_LENGTH_RANGE.max}
            unit="일"
            onChange={(n) => update((s) => setCycle(s, { periodLength: n }))}
          />
        </StepperRow>
      </div>
    </>
  )
}

/**
 * "함께 준비를 시작한 날". The typed value lives in a draft and is saved only
 * once it is a plausible date: a desktop date field reports half-typed years
 * ('0002-…', '0202-…') while typing, and saving those would fire the
 * "see a doctor" notice (the notification engine reacts to ttcStart).
 */
function TtcStartField() {
  const { state, update, today } = useApp()
  const stored = isISODate(state.settings.ttcStart) ? state.settings.ttcStart : ''
  const [draft, setDraft] = useState(stored)
  const [showError, setShowError] = useState(false)
  const bounds = ttcBounds(today)

  // Follow changes saved elsewhere (the other tab, or our own save).
  useEffect(() => {
    setDraft(stored)
    setShowError(false)
  }, [stored])

  const error = showError && draft ? validateTtcStart(draft, today) : null

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setDraft(v)
    setShowError(false)
    if (v && !validateTtcStart(v, today)) update((s) => setTtcStart(s, v, today))
  }

  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Left half-typed: keep what was saved.
    if (e.currentTarget.validity.badInput) {
      setDraft(stored)
      return
    }
    if (!draft) {
      if (stored) update((s) => setTtcStart(s, '', today))
      return
    }
    if (validateTtcStart(draft, today)) setShowError(true)
  }

  return (
    <Field
      label="함께 준비를 시작한 날 (선택)"
      hint={
        error ??
        (stored
          ? `${formatKo(stored, { year: true })}부터 · 준비 기간에 맞춰 전문의 상담 시기를 부드럽게 알려 드려요.`
          : '입력하면 준비 기간에 맞춰 전문의 상담 시기를 부드럽게 알려 드려요.')
      }
    >
      <input
        type="date"
        className={inputClass}
        value={draft}
        min={bounds.min}
        max={bounds.max}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={!!error}
      />
    </Field>
  )
}

function StepperRow({
  label,
  hint,
  muted,
  children,
}: {
  label: string
  hint: string
  muted?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
      <div className="min-w-0 flex-1">
        <p className={cx('text-sm font-medium', muted ? 'text-ink-2' : 'text-ink')}>{label}</p>
        <p className="text-[11px] leading-relaxed text-ink-3">{hint}</p>
      </div>
      {children}
    </div>
  )
}
