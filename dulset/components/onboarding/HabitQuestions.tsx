'use client'

// 남편 트랙 (N7 · N15): the two quick questions (담배 · 술) plus "already doing"
// that decide a person's starter checklist — asked of that person, on their own
// first run (PartnerFirstRunSheet), never of their partner.

import { cx } from '@/components/ui'
import { Icon, type IconName } from '@/components/ui/icons'
import type { HabitAnswers } from '@/lib/initial'
import { ChoiceGroup, Group } from './parts'

/** What the form holds while the user answers (both questions start unanswered). */
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

export default function HabitQuestions({ habits, setHabits }: { habits: HabitDraft; setHabits: (next: HabitDraft) => void }) {
  const set = (p: Partial<HabitDraft>) => setHabits({ ...habits, ...p })
  return (
    <div className="space-y-4">
      <Group title="담배를 피우나요?">
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

      <Group title="술은 얼마나 마시나요?">
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
          <PickToggle on={habits.exercises} onClick={() => set({ exercises: !habits.exercises })} icon="run" label="운동" />
          <PickToggle
            on={habits.takesSupplements}
            onClick={() => set({ takesSupplements: !habits.takesSupplements })}
            icon="pill"
            label="영양제"
          />
        </div>
      </Group>
    </div>
  )
}

function PickToggle({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: IconName; label: string }) {
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
      <Icon name={icon} className="h-[18px] w-[18px]" />
      {label}
    </button>
  )
}
