'use client'

// ② 주기: the last period start (date first, then the quick chips), up to six
// earlier starts ("최근 시작일 더 넣기" — one tap per cycle, so a record kept in
// another app moves over in a minute), the average cycle with the "45일 이상·
// 들쭉날쭉" switch (N12 longCycles), and "배란테스트기 써요?" (N17 usesLH).
// The earlier starts and the LH answer live outside the draft (lib/onboardingDraft) and
// become periods / settings.usesLH through lib/logic/onboarding.

import { useId, useState } from 'react'
import { Button, Disclaimer, NumberStepper, Toggle, cx, inputClass } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { ESTIMATE_DISCLAIMER } from '@/lib/content/fertility'
import { addDays, formatKo, formatShort } from '@/lib/dates'
import { CYCLE_RANGE, PERIOD_MAX_AGE_DAYS, PERIOD_RANGE, draftNames, draftOwner, periodDateNote, type OnboardingDraft } from '@/lib/onboardingDraft'
import { cycleLengthRange } from '@/lib/initial'
import {
  PAST_STARTS_MAX,
  PAST_STARTS_MAX_AGE_DAYS,
  PAST_START_ERROR_TEXT,
  aboutWeeksAgo,
  addPastStart,
  cleanPastStarts,
  removePastStart,
  suggestPastStart,
  type PastStartError,
} from '@/lib/logic/onboarding'
import type { ISODate, Settings } from '@/lib/types'
import { ChoiceGroup, Group, QuickDateChips } from './parts'

export type UsesLHChoice = NonNullable<Settings['usesLH']>

const USES_LH_OPTIONS: Array<{ value: 'yes' | 'no' | 'later'; label: string }> = [
  { value: 'yes', label: '써요' },
  { value: 'no', label: '안 써요' },
  { value: 'later', label: '나중에' },
]

const toChoice = (v: UsesLHChoice | undefined): 'yes' | 'no' | 'later' | undefined =>
  v === true ? 'yes' : v === false ? 'no' : v === 'later' ? 'later' : undefined
const fromChoice = (v: 'yes' | 'no' | 'later'): UsesLHChoice => (v === 'yes' ? true : v === 'no' ? false : 'later')

export default function CycleStep({
  draft,
  patch,
  today,
  pastStarts,
  setPastStarts,
  usesLH,
  setUsesLH,
}: {
  draft: OnboardingDraft
  patch: (p: Partial<OnboardingDraft>) => void
  today: ISODate
  /** Earlier starts, newest first (lib/logic/onboarding). */
  pastStarts: ISODate[]
  setPastStarts: (next: ISODate[]) => void
  usesLH: UsesLHChoice | undefined
  setUsesLH: (next: UsesLHChoice) => void
}) {
  const names = draftNames(draft)
  const owner = draftOwner(draft)
  const whose = owner === 'a' ? '' : `${names.b}님의 `
  const note = draft.periodUnknown ? null : periodDateNote(draft.lastPeriodStart, draft.cycleLength, today)
  const range = cycleLengthRange(draft.longCycles)
  const dateId = useId()

  // Moving the last start drops the earlier starts that no longer sit before it.
  const setLast = (lastPeriodStart: string) => {
    patch({ lastPeriodStart, periodUnknown: false })
    setPastStarts(cleanPastStarts(pastStarts, lastPeriodStart, today))
  }
  const forget = () => {
    patch({ periodUnknown: true, lastPeriodStart: '' })
    setPastStarts([])
  }
  const setLong = (longCycles: boolean) => {
    const max = cycleLengthRange(longCycles).max
    patch({ longCycles, ...(draft.cycleLength > max ? { cycleLength: max } : {}) })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl2 border border-line bg-surface p-4 shadow-card">
        {draft.periodUnknown ? (
          <div>
            <p className="text-xs font-semibold text-ink-2">{whose}마지막 생리 시작일</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">
              괜찮아요. 다음 생리가 시작되면 ‘+ 기록’에서 한 번만 남겨 주세요. 그때부터 예상을 보여 드릴게요.
            </p>
            <Button variant="secondary" className="mt-3" onClick={() => patch({ periodUnknown: false })}>
              날짜 입력하기
            </Button>
          </div>
        ) : (
          <>
            <label htmlFor={dateId} className="mb-1.5 block text-xs font-semibold text-ink-2">
              {whose}마지막 생리 시작일
            </label>
            <input
              id={dateId}
              type="date"
              className={cx(inputClass, 'h-12 text-base')}
              value={draft.lastPeriodStart}
              max={today}
              min={addDays(today, -PERIOD_MAX_AGE_DAYS)}
              onChange={(e) => setLast(e.target.value)}
            />
            <div className="mt-2.5">
              <QuickDateChips today={today} value={draft.lastPeriodStart} onPick={setLast} label="마지막 생리 시작일 빠른 선택" />
            </div>
            <p className="mt-2 text-xs text-ink-3">대략적인 날이어도 괜찮아요.</p>
            <div aria-live="polite">
              {note ? (
                <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-xs leading-relaxed text-ink-2">{note}</p>
              ) : null}
            </div>
            {draft.lastPeriodStart ? (
              <PastStarts
                lastStart={draft.lastPeriodStart}
                pastStarts={pastStarts}
                setPastStarts={setPastStarts}
                cycleLength={draft.cycleLength}
                today={today}
              />
            ) : null}
            <Button variant="ghost" className="-ml-2 mt-2" onClick={forget}>
              잘 모르겠어요 · 나중에 할게요
            </Button>
          </>
        )}
      </div>

      <div className="space-y-3 rounded-xl2 border border-line bg-surface p-4 shadow-card">
        <Group title="평균 주기" hint={`잘 모르면 ${CYCLE_RANGE.fallback}일로 둘게요. 시작일이 쌓이면 알아서 맞춰져요.`}>
          <NumberStepper
            label="평균 주기"
            unit="일"
            min={range.min}
            max={range.max}
            value={draft.cycleLength}
            onChange={(cycleLength) => patch({ cycleLength })}
          />
        </Group>
        <div className="border-t border-line">
          <Toggle
            checked={draft.longCycles === true}
            onChange={setLong}
            label="주기가 45일 이상이거나 들쭉날쭉해요"
            description="날짜 대신 넓은 예상 범위로 보여 드리고, 주기 길이를 90일까지 받아요."
          />
        </div>
        <div className="border-t border-line pt-3">
          <Group title="생리 기간">
            <NumberStepper
              label="생리 기간"
              unit="일"
              min={PERIOD_RANGE.min}
              max={PERIOD_RANGE.max}
              value={draft.periodLength}
              onChange={(periodLength) => patch({ periodLength })}
            />
          </Group>
        </div>
      </div>

      <div className="rounded-xl2 border border-line bg-surface p-4 shadow-card">
        <Group title="배란테스트기(LH) 써요?" hint="양성을 기록하면 그 날짜에 맞춰 예상을 다시 계산해요. 안 써도 괜찮아요. 설정에서 바꿀 수 있어요.">
          <ChoiceGroup
            label="배란테스트기 사용"
            options={USES_LH_OPTIONS}
            value={toChoice(usesLH)}
            onChange={(v) => setUsesLH(fromChoice(v))}
          />
        </Group>
      </div>

      <Disclaimer>{ESTIMATE_DISCLAIMER}</Disclaimer>
    </div>
  )
}

/** "최근 시작일 더 넣기": chips for the earlier starts, one-tap "약 4주 전", or any other day. */
function PastStarts({
  lastStart,
  pastStarts,
  setPastStarts,
  cycleLength,
  today,
}: {
  lastStart: ISODate
  pastStarts: ISODate[]
  setPastStarts: (next: ISODate[]) => void
  cycleLength: number
  today: ISODate
}) {
  const [error, setError] = useState<PastStartError | null>(null)
  const [open, setOpen] = useState(pastStarts.length > 0)
  const ctx = { lastStart, pastStarts, today }
  const suggestion = suggestPastStart({ ...ctx, cycleLength })
  const full = pastStarts.length >= PAST_STARTS_MAX
  const otherId = useId()
  const errorId = useId()

  const add = (date: string) => {
    const r = addPastStart(date, ctx)
    setError(r.error)
    if (!r.error) setPastStarts(r.list)
  }
  const remove = (date: ISODate) => {
    setError(null)
    setPastStarts(removePastStart(pastStarts, date))
  }

  if (!open)
    return (
      <div className="mt-3 border-t border-line pt-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <span aria-hidden>＋</span> 최근 시작일 더 넣기 <span className="text-xs font-medium text-ink-3">(선택)</span>
        </button>
        <p className="text-xs leading-relaxed text-ink-3">쓰던 앱에 시작일이 있다면 몇 개만 옮겨도 첫 달부터 내 주기로 예상해요.</p>
      </div>
    )

  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-xs font-semibold text-ink-2">
        최근 시작일 더 넣기 <span className="font-medium text-ink-3">(선택 · 최대 {PAST_STARTS_MAX}개)</span>
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
        {pastStarts.length === 0
          ? '쓰던 앱에 시작일이 있다면 몇 개만 옮겨도 첫 달부터 내 주기로 예상해요. 최신 것부터 넣어요.'
          : `${pastStarts.length}개 넣었어요. 이전 시작일부터 차례로 넣으면 돼요.`}
      </p>
      {pastStarts.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="넣은 시작일">
          {pastStarts.map((d) => (
            <li key={d}>
              <button
                type="button"
                onClick={() => remove(d)}
                aria-label={`${formatKo(d, { weekday: false })} 지우기`}
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-3.5 text-sm font-semibold text-brand-ink hover:bg-brand/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {formatShort(d)}
                <Icon name="x" className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.4} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {full ? (
        <p className="mt-2 text-xs leading-relaxed text-ink-3">{PAST_START_ERROR_TEXT.full}</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {suggestion ? (
            <Button variant="secondary" onClick={() => add(suggestion)} className="shrink-0">
              <span aria-hidden>＋</span> {aboutWeeksAgo(cycleLength)} ({formatShort(suggestion)})
            </Button>
          ) : null}
          <label htmlFor={otherId} className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-ink-2">
            <span className="shrink-0">다른 날</span>
            <input
              id={otherId}
              type="date"
              value=""
              max={addDays(lastStart, -1)}
              min={addDays(today, -PAST_STARTS_MAX_AGE_DAYS)}
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                if (e.target.value) add(e.target.value)
              }}
              className={cx(inputClass, 'min-w-0 flex-1 px-2.5 text-xs')}
            />
          </label>
        </div>
      )}
      <p id={errorId} aria-live="polite" className="mt-1 text-xs text-period empty:hidden">
        {error ? PAST_START_ERROR_TEXT[error] : ''}
      </p>
    </div>
  )
}
