'use client'

import { Button, Disclaimer, Field, NumberStepper, inputClass } from '@/components/ui'
import { ESTIMATE_DISCLAIMER } from '@/lib/content/fertility'
import { addDays } from '@/lib/dates'
import {
  CYCLE_RANGE,
  PERIOD_MAX_AGE_DAYS,
  PERIOD_RANGE,
  draftNames,
  draftOwner,
  periodDateNote,
  type OnboardingDraft,
} from '@/lib/demo'
import type { ISODate, MemberId } from '@/lib/types'
import { ChoiceGroup, Group } from './parts'

export default function CycleStep({
  draft,
  patch,
  today,
}: {
  draft: OnboardingDraft
  patch: (p: Partial<OnboardingDraft>) => void
  today: ISODate
}) {
  const names = draftNames(draft)
  const owner = draftOwner(draft)
  const whose = owner === 'a' ? '' : `${names.b}님의 `
  const note = draft.periodUnknown ? null : periodDateNote(draft.lastPeriodStart, draft.cycleLength, today)

  return (
    <div className="space-y-5">
      <Group title="누구의 주기를 기록할까요?" hint="기록은 한 사람 기준이에요. 가임기 예상은 두 사람이 함께 봐요.">
        <ChoiceGroup<MemberId>
          label="주기를 기록할 사람"
          columns={2}
          value={owner}
          onChange={(cycleOwner) => patch({ cycleOwner })}
          options={[
            { value: 'a', label: `${names.a} (나)` },
            { value: 'b', label: names.b },
          ]}
        />
      </Group>

      <div className="rounded-xl2 border border-line bg-surface p-4 shadow-card">
        {draft.periodUnknown ? (
          <div>
            <p className="text-xs font-semibold text-ink-2">{whose}마지막 생리 시작일</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">
              괜찮아요. 다음 생리가 시작되면 달력에서 한 번만 기록해 주세요. 그때부터 예상을 보여 드릴게요.
            </p>
            <Button variant="secondary" className="mt-3" onClick={() => patch({ periodUnknown: false })}>
              날짜 입력하기
            </Button>
          </div>
        ) : (
          <>
            <Field label={`${whose}마지막 생리 시작일 (선택)`} hint="대략적인 날이어도 괜찮아요.">
              <input
                type="date"
                className={inputClass}
                value={draft.lastPeriodStart}
                max={today}
                min={addDays(today, -PERIOD_MAX_AGE_DAYS)}
                onChange={(e) => patch({ lastPeriodStart: e.target.value })}
              />
            </Field>
            <div aria-live="polite">
              {note ? (
                <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-xs leading-relaxed text-ink-2">{note}</p>
              ) : null}
            </div>
            <Button
              variant="ghost"
              className="-ml-2 mt-2"
              onClick={() => patch({ periodUnknown: true, lastPeriodStart: '' })}
            >
              잘 모르겠어요 · 나중에 할게요
            </Button>
          </>
        )}
      </div>

      <div className="space-y-4 rounded-xl2 border border-line bg-surface p-4 shadow-card">
        <Group title="평균 주기" hint={`잘 모르면 ${CYCLE_RANGE.fallback}일로 둘게요. 기록이 쌓이면 알아서 맞춰져요.`}>
          <NumberStepper
            label="평균 주기"
            unit="일"
            min={CYCLE_RANGE.min}
            max={CYCLE_RANGE.max}
            value={draft.cycleLength}
            onChange={(cycleLength) => patch({ cycleLength })}
          />
        </Group>
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

      <Disclaimer>{ESTIMATE_DISCLAIMER}</Disclaimer>
    </div>
  )
}
