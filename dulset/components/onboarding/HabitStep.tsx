'use client'

// 남편 트랙 (N7): three quick questions about the partner who doesn't track the
// cycle — they decide the starter checklist, so nobody taps "담배 안 피우기"
// every day without ever having smoked.

import { cx } from '@/components/ui'
import { draftNames, draftOwner, draftRoles, type OnboardingDraft } from '@/lib/demo'
import { ROLE_EMOJI, defaultCheckItems, type HabitAnswers } from '@/lib/initial'
import type { CheckItem, ISODate, Member, MemberId } from '@/lib/types'
import { ChoiceGroup, Group } from './parts'

/** What the step holds while the user answers (both questions start unanswered). */
export interface HabitDraft {
  smokes?: boolean
  drinks?: HabitAnswers['drinks']
  exercises: boolean
  takesSupplements: boolean
}

export const EMPTY_HABITS: HabitDraft = { exercises: false, takesSupplements: false }

export function habitAnswers(d: HabitDraft): HabitAnswers | undefined {
  if (d.smokes === undefined || d.drinks === undefined) return undefined
  return { smokes: d.smokes, drinks: d.drinks, exercises: d.exercises, takesSupplements: d.takesSupplements }
}

export function habitProblem(d: HabitDraft): string | null {
  if (d.smokes === undefined) return '담배 질문에 답해 주세요.'
  if (d.drinks === undefined) return '술 질문에 답해 주세요.'
  return null
}

/** The member the questions are about: whoever doesn't track the cycle. */
export function habitSubject(draft: OnboardingDraft): MemberId {
  return draftOwner(draft) === 'a' ? 'b' : 'a'
}

/** The two members as they'll be created, for previewing the starter list. */
function draftMembers(draft: OnboardingDraft): [Member, Member] {
  const names = draftNames(draft)
  const roles = draftRoles(draft)
  const owner = draftOwner(draft)
  const m = (id: MemberId): Member => {
    const role = roles[id] ?? 'partner'
    return { id, name: names[id], role, tracksCycle: owner === id, emoji: ROLE_EMOJI[role] }
  }
  return [m('a'), m('b')]
}

export default function HabitStep({
  draft,
  habits,
  setHabits,
  today,
}: {
  draft: OnboardingDraft
  habits: HabitDraft
  setHabits: (next: HabitDraft) => void
  today: ISODate
}) {
  const names = draftNames(draft)
  const who = habitSubject(draft)
  const isMe = who === 'a'
  const subject = isMe ? '' : `${names[who]}님은 `
  const owner = draftOwner(draft)
  const answers = habitAnswers(habits)
  const preview = answers ? defaultCheckItems(draftMembers(draft), today, answers) : null
  const theirs = preview?.filter((i) => i.owner === who) ?? []
  const ownerItems = preview?.filter((i) => i.owner === owner) ?? []
  const set = (p: Partial<HabitDraft>) => setHabits({ ...habits, ...p })

  return (
    <div className="space-y-5">
      <Group title={`${subject}담배를 피우나요?`}>
        <ChoiceGroup<'no' | 'yes'>
          label="담배를 피우나요?"
          columns={2}
          value={habits.smokes === undefined ? undefined : habits.smokes ? 'yes' : 'no'}
          onChange={(v) => set({ smokes: v === 'yes' })}
          options={[
            { value: 'no', label: '안 피워요' },
            { value: 'yes', label: '피워요' },
          ]}
        />
      </Group>

      <Group title={`${subject}술은 얼마나 마시나요?`}>
        <ChoiceGroup<HabitAnswers['drinks']>
          label="술은 얼마나 마시나요?"
          columns={1}
          value={habits.drinks}
          onChange={(drinks) => set({ drinks })}
          options={[
            { value: 'rarely', label: '거의 안 마셔요' },
            { value: 'sometimes', label: '가끔 (주 1~2번)' },
            { value: 'often', label: '자주 (주 3번 이상)' },
          ]}
        />
      </Group>

      <Group title="이미 하고 있는 게 있나요? (선택, 여러 개 골라도 돼요)">
        <div className="grid grid-cols-2 gap-2">
          <PickToggle on={habits.exercises} onClick={() => set({ exercises: !habits.exercises })} emoji="🏃" label="운동" />
          <PickToggle
            on={habits.takesSupplements}
            onClick={() => set({ takesSupplements: !habits.takesSupplements })}
            emoji="💊"
            label="영양제"
          />
        </div>
      </Group>

      <section aria-live="polite" aria-label="이렇게 시작할게요" className="rounded-xl2 border border-line bg-surface p-4 shadow-card">
        <p className="text-sm font-bold text-ink">이렇게 시작할게요</p>
        {preview ? (
          <div className="mt-2 space-y-2 text-sm">
            <PreviewLine who={isMe ? '나' : `${names[who]}님`} items={theirs} />
            <PreviewLine who={owner === 'a' ? '나' : `${names[owner]}님`} items={ownerItems} />
          </div>
        ) : (
          <p className="mt-1 text-xs text-ink-3">두 질문에 답하면 체크 항목을 골라 드려요.</p>
        )}
        <ul className="mt-3 list-disc space-y-1 pl-4 text-xs leading-relaxed text-ink-2">
          <li>매일 할 일은 1~2개만 두고, 참는 습관은 주 1회만 체크해요. 참는 습관에는 콕 찌르기가 가지 않아요.</li>
          <li>남성용 아연·엽산 영양제는 기본으로 넣지 않아요. 큰 임상시험(FAZST, 2020)에서 효과가 없었어요.</li>
          <li>
            {isMe ? '' : `${names[who]}님이 연결한 뒤 직접 바꿀 수 있어요. `}나중에 오늘 탭의 ‘편집’에서 언제든 바꿔요.
          </li>
        </ul>
      </section>
    </div>
  )
}

function PickToggle({ on, onClick, emoji, label }: { on: boolean; onClick: () => void; emoji: string; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        'flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-semibold transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        on ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
      )}
    >
      <span aria-hidden>{emoji}</span>
      {label}
    </button>
  )
}

function PreviewLine({ who, items }: { who: string; items: CheckItem[] }) {
  const daily = items.filter((i) => i.cadence !== 'weekly').map((i) => (i.note === '선택' ? `${i.label}(선택)` : i.label))
  const weekly = items.filter((i) => i.cadence === 'weekly').map((i) => i.label)
  return (
    <div className="flex gap-2">
      <span className="w-14 shrink-0 text-xs font-semibold leading-5 text-ink-3">{who}</span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-ink">
          <span className="mr-1 text-xs font-semibold text-ink-3">매일</span>
          {daily.join(' · ') || '없음'}
        </p>
        {weekly.length ? (
          <p className="text-ink">
            <span className="mr-1 text-xs font-semibold text-him">주 1회</span>
            {weekly.join(' · ')}
          </p>
        ) : null}
      </div>
    </div>
  )
}
