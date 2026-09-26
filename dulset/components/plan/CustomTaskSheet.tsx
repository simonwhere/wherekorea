'use client'

import { useId, useState } from 'react'
import { Button, Field, Sheet, inputClass, useToast } from '@/components/ui'
import { isISODate } from '@/lib/dates'
import { PHASES, addCustomTask } from '@/lib/logic/roadmap'
import { useApp } from '@/lib/store'
import type { RoadmapPhase } from '@/lib/types'
import { ChoiceChips, FieldError } from './bits'
import { CUSTOM_PLACEHOLDER, CUSTOM_TITLE_MAX, PHASE_SHORT, type Who } from './model'

/** "+ 직접 추가": the couple's own item (e.g. 태명 짓기, 회사에 알리기). */
export default function CustomTaskSheet({ defaultPhase, onClose }: { defaultPhase: RoadmapPhase; onClose: () => void }) {
  const { state, update, me, partner } = useApp()
  const toast = useToast()
  const errorId = useId()
  const [title, setTitle] = useState('')
  const [phase, setPhase] = useState<RoadmapPhase>(defaultPhase)
  const [who, setWho] = useState<Who>('both')
  const [due, setDue] = useState('')
  const [error, setError] = useState<'title' | 'due' | null>(null)
  const [a, b] = state.couple.members

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return setError('title')
    if (due && !isISODate(due)) return setError('due')
    update((s) => addCustomTask(s, { title, phase, who, due: due || undefined }, me.id))
    toast.show(`챙길 것에 담았어요 · ${partner.name}님 화면에도 보여요`)
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title="직접 추가">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="무엇을 챙길까요">
          <input
            className={inputClass}
            value={title}
            maxLength={CUSTOM_TITLE_MAX}
            placeholder={CUSTOM_PLACEHOLDER[phase]}
            required
            aria-invalid={error === 'title'}
            aria-describedby={error === 'title' ? `${errorId}-title` : undefined}
            onChange={(e) => {
              setTitle(e.target.value)
              if (error === 'title') setError(null)
            }}
          />
        </Field>
        {error === 'title' ? <FieldError id={`${errorId}-title`}>한 줄로 적어 주세요.</FieldError> : null}

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-ink-2">단계</span>
          <ChoiceChips<RoadmapPhase>
            label="단계"
            value={phase}
            onChange={setPhase}
            options={PHASES.map((p) => ({ value: p, label: PHASE_SHORT[p] }))}
          />
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-ink-2">누가</span>
          <ChoiceChips<Who>
            label="누가"
            value={who}
            onChange={setWho}
            options={[
              { value: 'both', label: '둘 다' },
              { value: a.id, label: a.name },
              { value: b.id, label: b.name },
            ]}
          />
        </div>

        <Field label="언제까지 (선택)" hint="날짜를 정하면 가까워질 때 ‘이번 주 챙길 것’에도 보여요">
          <input
            type="date"
            className={inputClass}
            value={due}
            aria-invalid={error === 'due'}
            aria-describedby={error === 'due' ? `${errorId}-due` : undefined}
            onChange={(e) => {
              setDue(e.target.value)
              if (error === 'due') setError(null)
            }}
          />
        </Field>
        {error === 'due' ? <FieldError id={`${errorId}-due`}>날짜를 다시 확인해 주세요.</FieldError> : null}

        <Button type="submit" full size="lg">
          추가하기
        </Button>
      </form>
    </Sheet>
  )
}
