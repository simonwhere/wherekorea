'use client'

import { useCallback, useState } from 'react'
import { Button, Card, Disclaimer, Field, SectionTitle, Sheet, cx, inputClass, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { MILESTONE_NOTE } from '@/lib/content/baby'
import { formatKo } from '@/lib/dates'
import { setMilestone } from '@/lib/logic/baby'
import { ageAt, milestoneRows, validateMilestoneDate, type MilestoneRow } from '@/lib/logic/babyView'
import { useApp } from '@/lib/store'
import type { Baby } from '@/lib/types'

export default function Milestones({ baby }: { baby: Baby }) {
  const { state, today } = useApp()
  const [editing, setEditing] = useState<MilestoneRow | null>(null)
  const close = useCallback(() => setEditing(null), [])
  const rows = milestoneRows(state, baby.birthDate)
  const done = rows.filter((r) => r.date).length
  const canEdit = baby.birthDate <= today

  return (
    <section>
      <SectionTitle sub="처음 해낸 날을 적어 두면 우리 둘의 추억이 돼요" action={<span className="text-xs text-ink-3">{done}/{rows.length}</span>}>
        발달 이정표
      </SectionTitle>
      <Card className="px-0 py-1">
        <ul>
          {rows.map((r) => (
            <li key={r.key} className="border-b border-line/60 last:border-b-0">
              <button
                type="button"
                onClick={() => setEditing(r)}
                disabled={!canEdit}
                className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface-2 disabled:opacity-50"
                aria-label={
                  r.date
                    ? `${r.label}: ${formatKo(r.date, { weekday: false })}, ${r.ageLabel} — 날짜 바꾸기`
                    : `${r.label}: 아직 기록 전 — 날짜 기록하기`
                }
              >
                <span
                  aria-hidden
                  className={cx(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg',
                    r.date ? 'bg-ok-soft' : 'bg-surface-2 grayscale-[40%]',
                  )}
                >
                  {r.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block text-sm font-semibold', r.date ? 'text-ink' : 'text-ink-2')}>{r.label}</span>
                  <span className="block text-[11px] text-ink-3">
                    {r.date ? `${formatKo(r.date, { weekday: false })} · ${r.ageLabel}` : `많은 아기가 ${r.typical}`}
                  </span>
                </span>
                {r.date ? (
                  <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ok text-white">
                    <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                ) : (
                  <span aria-hidden className="shrink-0 text-xs font-semibold text-brand-ink">
                    기록
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Disclaimer>{MILESTONE_NOTE}</Disclaimer>

      <Sheet open={!!editing} onClose={close} title={editing ? `${editing.emoji} ${editing.label}` : ''}>
        {editing ? <MilestoneForm row={editing} birth={baby.birthDate} onDone={close} /> : null}
      </Sheet>
    </section>
  )
}

function MilestoneForm({ row, birth, onDone }: { row: MilestoneRow; birth: string; onDone: () => void }) {
  const { update, today } = useApp()
  const toast = useToast()
  const [date, setDate] = useState(row.date ?? today)
  const error = validateMilestoneDate(date, birth, today)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (error) return
    update((s) => setMilestone(s, row.mkey, date))
    toast.show(row.date ? '날짜를 바꿨어요' : `${row.label}, 축하해요! 🎉`)
    onDone()
  }
  const clear = () => {
    update((s) => setMilestone(s, row.mkey, null))
    toast.show('기록을 지웠어요')
    onDone()
  }

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <p className="text-xs leading-relaxed text-ink-2">많은 아기가 {row.typical}에 해요. 처음 해낸 날을 우리 둘의 기록으로 남겨요.</p>
      <Field
        label="처음 한 날"
        hint={
          error ? (
            <span className="text-period">{error}</span>
          ) : date === birth ? (
            '태어난 날이에요'
          ) : (
            `${ageAt(birth, date)} 때예요`
          )
        }
      >
        <input
          type="date"
          className={inputClass}
          value={date}
          min={birth}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={!!error}
          required
        />
      </Field>
      <Button type="submit" full size="lg" disabled={!!error}>
        {row.date ? '날짜 저장' : '기록하기'}
      </Button>
      {row.date ? (
        <Button full variant="danger" onClick={clear}>
          기록 지우기
        </Button>
      ) : null}
      <Disclaimer>{MILESTONE_NOTE}</Disclaimer>
    </form>
  )
}
