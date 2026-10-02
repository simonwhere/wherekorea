'use client'

// 난임치료휴가 (Next B — B2): note the days each person took. Every person has
// their own 6 a year (연 6일 · 유급 2일, 4일 from 2026-11-27 — lib/logic/
// treatments paidDaysFor, evidence in docs/research/kr-programs.json). Either
// phone may write a day for either person: a work-leave day holds no health
// data, and the person who keeps the app often keeps this too.

import { useState } from 'react'
import { ChoiceChips, ExternalLink, FieldError, btnGhost } from '@/components/plan/bits'
import { Button, Field, Sheet, inputClass, useToast } from '@/components/ui'
import { programById } from '@/lib/content/programs'
import { formatKo, isISODate, parts } from '@/lib/dates'
import { LEAVE_DAYS_PER_YEAR, addLeaveDay, leaveDaysOf, leaveLine, leaveSummary, removeLeaveDay } from '@/lib/logic/treatments'
import { useApp } from '@/lib/store'
import type { MemberId } from '@/lib/types'

export default function LeaveSheet({ onClose }: { onClose: () => void }) {
  const { state, update, today, me } = useApp()
  const toast = useToast()
  const [member, setMember] = useState<MemberId>(me.id)
  const [date, setDate] = useState(today)
  const [error, setError] = useState(false)
  const members = state.couple.members
  const name = members.find((m) => m.id === member)?.name ?? ''
  const summary = leaveSummary(state, member, today)
  const days = [...leaveDaysOf(state, member)].reverse()
  const program = programById('infertility-leave')

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isISODate(date)) return setError(true)
    setError(false)
    if (leaveDaysOf(state, member).some((d) => d.date === date)) {
      toast.show('이미 적은 날이에요')
      return
    }
    update((s) => addLeaveDay(s, member, date))
    toast.show(`${name}님 ${formatKo(date)} 휴가로 적었어요`)
  }

  const remove = (d: string) => {
    update((s) => removeLeaveDay(s, member, d))
    toast.show('지웠어요')
  }

  return (
    <Sheet open onClose={onClose} title="난임치료휴가">
      <form onSubmit={add} className="space-y-4" noValidate>
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-ink-2">누구 휴가</span>
          <ChoiceChips<MemberId> label="누구 휴가" value={member} onChange={setMember} options={members.map((m) => ({ value: m.id, label: m.name }))} />
        </div>

        <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-ink-2">
          <b className="font-semibold text-ink">{name}</b> · {summary.year}년 {leaveLine(summary)}
          {summary.used > LEAVE_DAYS_PER_YEAR ? ' · 연 6일을 넘었어요. 회사에 확인해요' : ''}
        </p>

        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Field label="쉰 날">
            <input
              type="date"
              className={inputClass}
              value={date}
              aria-invalid={error}
              aria-describedby={error ? 'leave-date-error' : undefined}
              onChange={(e) => {
                setDate(e.target.value)
                setError(false)
              }}
            />
          </Field>
          <Button type="submit">적기</Button>
        </div>
        {error ? <FieldError id="leave-date-error">날짜를 다시 확인해 주세요.</FieldError> : null}

        {days.length ? (
          <ul className="divide-y divide-line/60" aria-label={`${name}님이 쓴 날`}>
            {days.map((d) => (
              <li key={d.date} className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-sm text-ink">
                  {formatKo(d.date, { year: parts(d.date).year !== summary.year })}
                  {parts(d.date).year !== summary.year ? <span className="ml-1 text-[11px] text-ink-3">· {parts(d.date).year}년</span> : null}
                </span>
                <button type="button" className={btnGhost} onClick={() => remove(d.date)} aria-label={`${formatKo(d.date)} 휴가 지우기`}>
                  지우기
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-3">아직 적은 날이 없어요.</p>
        )}

        <p className="text-[11px] leading-relaxed text-ink-3">
          사람마다 연 {LEAVE_DAYS_PER_YEAR}일, 하루 단위로 써요. 남성도 쓸 수 있어요. 신청 절차와 서류는 회사마다 달라요.
        </p>
        {program ? (
          <div className="-mt-3">
            <ExternalLink href={program.url}>{program.urlLabel}에서 보기</ExternalLink>
          </div>
        ) : null}
      </form>
    </Sheet>
  )
}
