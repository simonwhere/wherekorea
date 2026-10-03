'use client'

// The link's first 30 seconds (Now 3 N22): the first time this device opens
// the page, three lines say what this is — 이게 뭐예요 · {owner}님이 고른 것만
// 보여요 · 내 할 일 하나 — and a short setup lets him choose his own two habit
// questions and how he hears about things, the same questions and words the
// app's first-run sheet asks (components/onboarding/PartnerFirstRunSheet,
// HabitQuestions — reused through their pure parts, ChoiceGroup / Group, and
// the shared option lists in components/onboarding/partnerChoices).
// [이대로 시작하기] sends one 'setup' event with only what he answered (fixed
// values: lib/logic/partnerEvents.cleanPartnerEvent drops anything else);
// [나중에 할게요] keeps everything as it is. Either way this device remembers
// it (components/link/model LINK_INTRO_KEY) and the card does not come back.

import { useState } from 'react'
import { DRINK_OPTIONS, SMOKE_OPTIONS, STYLE_OPTIONS } from '@/components/onboarding/partnerChoices'
import { ChoiceGroup, Group, type Option } from '@/components/onboarding/parts'
import { cx } from '@/components/ui'
import type { SetupDrinks } from '@/lib/logic/partnerEvents'
import type { AlertStyle } from '@/lib/types'
import { Pill } from './bits'
import { setupFields, type SetupDraft } from './model'

/** The app's words (components/onboarding/partnerChoices); the link's drink event says 'no' where the app says 'rarely'. */
const DRINK_SETUP_OPTIONS: Option<SetupDrinks>[] = DRINK_OPTIONS.map((o) => ({ ...o, value: o.value === 'rarely' ? 'no' : o.value }))

export default function LinkIntro({
  myName,
  ownerName,
  onSetup,
  onLater,
  className,
}: {
  myName: string
  ownerName: string
  /** Send the answers (only what he answered) — the page turns them into a 'setup' event. */
  onSetup: (fields: NonNullable<ReturnType<typeof setupFields>>) => void
  /** Keep everything as it is. */
  onLater: () => void
  className?: string
}) {
  const [draft, setDraft] = useState<SetupDraft>({})
  const fields = setupFields(draft)

  const lines: Array<[string, string]> = [
    ['이게 뭐예요', `${ownerName}님이 보낸 둘셋 화면이에요. 설치 없이 이 링크로 열려요.`],
    [`${ownerName}님이 고른 것만 보여요`, `기록은 ${ownerName}님 폰에 있고, 여기에는 ${ownerName}님이 보여 주기로 한 것만 와요.`],
    ['내 할 일 하나', '한 달에 큰 일 하나, 매주 작은 일 하나예요. 아래에서 골라요.'],
  ]

  return (
    <section
      aria-label="처음 왔어요"
      className={cx('rounded-card border border-line bg-surface px-[18px] pb-4 pt-4 shadow-warm dark:shadow-none', className)}
    >
      {/* The card fills the first screen of a phone: a way past it sits right by its title, not only under the form. */}
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 text-[19px] font-extrabold leading-[1.35] tracking-[-0.035em] text-ink">{myName}님, 처음이죠?</h2>
        <button
          type="button"
          onClick={onLater}
          className="-mr-2 -mt-2.5 inline-flex min-h-[44px] shrink-0 items-center rounded-full px-2.5 text-[13px] font-bold text-ink-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          건너뛰기
        </button>
      </div>
      <ol className="mt-2.5 space-y-2">
        {lines.map(([head, body], i) => (
          <li key={head} className="flex gap-2.5">
            <span
              aria-hidden
              className="mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-[12px] font-extrabold text-brand-ink"
            >
              {i + 1}
            </span>
            <p className="min-w-0 text-[13.5px] leading-[1.5] text-ink-2">
              <b className="font-bold text-ink">{head}</b> · {body}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-4 space-y-4 border-t border-line/75 pt-4">
        <p className="text-[13px] font-bold text-ink">
          내 화면은 내가 정해요 <span className="font-medium text-ink-3">· 30초면 돼요</span>
        </p>
        <Group title="담배를 피우나요?">
          <ChoiceGroup<'no' | 'yes'>
            label="담배를 피우나요?"
            columns={2}
            value={draft.smokes === undefined ? undefined : draft.smokes ? 'yes' : 'no'}
            onChange={(v) => setDraft({ ...draft, smokes: v === 'yes' })}
            options={SMOKE_OPTIONS}
          />
        </Group>
        <Group title="술은 얼마나 마시나요?">
          <ChoiceGroup<SetupDrinks>
            label="술은 얼마나 마시나요?"
            columns={1}
            value={draft.drinks}
            onChange={(drinks) => setDraft({ ...draft, drinks })}
            options={DRINK_SETUP_OPTIONS}
          />
        </Group>
        <Group title="소식은 어떻게 받을까요?">
          <ChoiceGroup<AlertStyle>
            label="소식 받는 방식"
            columns={1}
            value={draft.alertStyle}
            onChange={(alertStyle) => setDraft({ ...draft, alertStyle })}
            options={STYLE_OPTIONS}
          />
        </Group>
        <p className="text-[12px] leading-[1.5] text-ink-3">
          체크 항목과 이 화면의 말투를 정하는 데만 써요. 고르지 않은 건 그대로 둬요. {ownerName}님의 자세한 기록은 {ownerName}님이
          허용할 때만 보여요.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="primary" onClick={() => (fields ? onSetup(fields) : onLater())}>
            이대로 시작하기
          </Pill>
          <Pill tone="outline" onClick={onLater}>
            나중에 할게요
          </Pill>
        </div>
      </div>
    </section>
  )
}
