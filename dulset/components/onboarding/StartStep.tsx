'use client'

import { Field, inputClass } from '@/components/ui'
import { SOURCES } from '@/lib/content/fertility'
import { addMonths, formatKo } from '@/lib/dates'
import {
  TTC_MAX_AGE_MONTHS,
  doctorPlan,
  draftNames,
  draftOwner,
  draftOwnerBirthYear,
  draftTtcStart,
  type DoctorPlan,
  type OnboardingDraft,
} from '@/lib/demo'
import type { ISODate } from '@/lib/types'
import { ChoiceGroup, SourceLink } from './parts'

/** Mirrors the notification engine (lib/logic/notifications) so we only promise what it does. */
function doctorCopy(plan: DoctorPlan, name: string): string[] {
  if (plan.age === undefined) {
    return [
      '주기를 기록하는 사람이 35세 미만이면 1년, 35세 이상이면 6개월이 지나도록 소식이 없을 때 두 사람 모두 검사를 받아 보길 권해요.',
      '출생연도를 넣으면 나이에 맞춰 그때 알려 드려요. 넣지 않으면 1년을 기준으로 알려 드릴게요.',
    ]
  }
  if (plan.months === 0) {
    return [
      `40세 이상이면(${name}님 ${plan.age}세) 오래 기다리지 말고, 준비를 시작하면서 두 사람이 함께 전문의와 상담해 보는 게 좋아요.`,
      '시작하면 보건소 임신 사전건강관리 지원도 함께 알려 드릴게요.',
    ]
  }
  const span = plan.months === 12 ? '1년' : `${plan.months}개월`
  const lines = [
    `${name}님(${plan.age}세) 기준으로, 함께 준비한 지 ${span}이 지나도록 소식이 없으면 두 사람 모두 검사를 받아 보도록 알려 드릴게요.`,
  ]
  if (plan.due) {
    lines.push(
      `준비한 지 ${plan.elapsed}개월이 지났으니, 지금 두 사람이 같이 상담을 받아 봐도 좋아요. 시작하면 보건소 지원 정보도 알려 드릴게요.`,
    )
  }
  return lines
}

export default function StartStep({
  draft,
  patch,
  today,
}: {
  draft: OnboardingDraft
  patch: (p: Partial<OnboardingDraft>) => void
  today: ISODate
}) {
  const ownerName = draftNames(draft)[draftOwner(draft)]
  const plan = doctorPlan(draftOwnerBirthYear(draft), draftTtcStart(draft, today), today)

  return (
    <div className="space-y-5">
      <ChoiceGroup<'now' | 'date'>
        label="준비를 시작한 때"
        columns={2}
        value={draft.ttcMode}
        onChange={(ttcMode) => patch({ ttcMode })}
        options={[
          { value: 'now', label: '이번 달부터', emoji: '🌱' },
          { value: 'date', label: '날짜 선택', emoji: '🗓️' },
        ]}
      />

      {draft.ttcMode === 'date' ? (
        <Field label="준비를 시작한 날" hint="대략적인 날이어도 괜찮아요.">
          <input
            type="date"
            className={inputClass}
            value={draft.ttcDate}
            max={today}
            min={addMonths(today, -TTC_MAX_AGE_MONTHS)}
            onChange={(e) => patch({ ttcDate: e.target.value })}
          />
        </Field>
      ) : (
        <p className="px-1 text-sm text-ink-2">이번 달부터, 오늘({formatKo(today)}) 날짜로 기록할게요.</p>
      )}

      <div className="rounded-xl2 border border-transparent bg-surface-2 p-4">
        <p className="text-sm font-bold text-ink">
          <span aria-hidden>🩺 </span>왜 물어보나요?
        </p>
        {doctorCopy(plan, ownerName).map((line) => (
          <p key={line} className="mt-1 text-xs leading-relaxed text-ink-2">
            {line}
          </p>
        ))}
        {/* The 40+ "don't wait" rule is from ASRM's evaluation opinion (2021), not the 2023 definition. */}
        {plan.months === 0 ? (
          <SourceLink href={SOURCES.asrmEval2021.url}>출처: 미국생식의학회(ASRM) 2021</SourceLink>
        ) : (
          <SourceLink href={SOURCES.asrm2023.url}>출처: 미국생식의학회(ASRM) 2023</SourceLink>
        )}
      </div>
    </div>
  )
}
