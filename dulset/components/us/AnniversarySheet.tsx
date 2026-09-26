'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Button, Sheet, Toggle, cx, inputClass, useToast } from '@/components/ui'
import { formatKo } from '@/lib/dates'
import { addAnniversary, removeAnniversary, updateAnniversary } from '@/lib/logic/anniversary'
import { ANNIVERSARY_EMOJIS, ANNIVERSARY_TITLE_MAX, anniversaryEmoji, checkAnyDate } from '@/lib/logic/usView'
import { useApp } from '@/lib/store'
import type { CustomAnniversary } from '@/lib/types'

export type AnniversaryTarget = { kind: 'new' } | { kind: 'edit'; id: string } | null

/** Add or edit one of our own days (첫 여행, 프러포즈 …). `onClose` must be stable. */
export default function AnniversarySheet({ target, onClose }: { target: AnniversaryTarget; onClose: () => void }) {
  const { state } = useApp()
  // An edited day deleted on the other phone closes the sheet.
  const editing = target?.kind === 'edit' ? state.anniversaries.find((a) => a.id === target.id) ?? null : null
  const open = target?.kind === 'new' || !!editing
  return (
    <Sheet open={open} onClose={onClose} title={editing ? '기념일 고치기' : '기념일 더하기'}>
      {open ? <AnniversaryForm key={editing?.id ?? 'new'} editing={editing} onDone={onClose} /> : null}
    </Sheet>
  )
}

function AnniversaryForm({ editing, onDone }: { editing: CustomAnniversary | null; onDone: () => void }) {
  const { update, today } = useApp()
  const toast = useToast()
  const [title, setTitle] = useState(editing?.title ?? '')
  const [date, setDate] = useState(editing?.date ?? today)
  const [yearly, setYearly] = useState(editing?.yearly ?? true)
  const [emoji, setEmoji] = useState(editing ? anniversaryEmoji(editing) : ANNIVERSARY_EMOJIS[0]!.emoji)
  const [tried, setTried] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const titleId = useId()
  const dateId = useId()
  const titleErrId = useId()
  const dateErrId = useId()

  const titleOk = title.trim().length > 0
  const dateOk = checkAnyDate(date) === 'ok'

  function save(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!titleOk || !dateOk) return
    const clean = title.trim().slice(0, ANNIVERSARY_TITLE_MAX)
    if (editing) {
      update((s) => updateAnniversary(s, editing.id, { title: clean, date, yearly, emoji }))
      toast.show('고쳤어요')
    } else {
      update((s) => addAnniversary(s, { title: clean, date, yearly, emoji }))
      toast.show(`${emoji} ${clean}, 함께 챙길게요`)
    }
    onDone()
  }

  function remove() {
    if (!editing) return
    update((s) => removeAnniversary(s, editing.id))
    toast.show('기념일을 지웠어요')
    onDone()
  }

  if (confirming && editing) {
    return <ConfirmRemove title={editing.title} onKeep={() => setConfirming(false)} onRemove={remove} />
  }

  return (
    <form className="space-y-4" onSubmit={save} noValidate>
      <div>
        <label htmlFor={titleId} className="mb-1.5 block text-xs font-semibold text-ink-2">
          이름
        </label>
        <input
          id={titleId}
          className={inputClass}
          value={title}
          maxLength={ANNIVERSARY_TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="첫 여행, 프러포즈한 날…"
          aria-invalid={tried && !titleOk ? true : undefined}
          aria-describedby={tried && !titleOk ? titleErrId : undefined}
        />
        {tried && !titleOk ? (
          <p id={titleErrId} className="mt-1 text-xs font-medium text-period">
            이름을 적어 주세요
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={dateId} className="mb-1.5 block text-xs font-semibold text-ink-2">
          날짜
        </label>
        <input
          id={dateId}
          type="date"
          className={cx(inputClass, 'px-2.5')}
          value={date}
          min="1900-01-01"
          max="2100-12-31"
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={tried && !dateOk ? true : undefined}
          aria-describedby={tried && !dateOk ? dateErrId : undefined}
        />
        {tried && !dateOk ? (
          <p id={dateErrId} className="mt-1 text-xs font-medium text-period">
            날짜를 한 번 더 확인해 주세요
          </p>
        ) : dateOk ? (
          <p className="mt-1 text-xs text-ink-3">{formatKo(date, { year: true })}</p>
        ) : null}
      </div>

      <Toggle
        checked={yearly}
        onChange={setYearly}
        label="매년 챙기기"
        description={yearly ? '해마다 이 날을 N주년으로 알려 드려요' : '이 날 한 번만 챙겨요'}
      />

      <div>
        <p className="mb-1.5 text-xs font-semibold text-ink-2">아이콘</p>
        <div role="group" aria-label="아이콘 고르기" className="grid grid-cols-4 gap-1.5">
          {ANNIVERSARY_EMOJIS.map((o) => {
            const on = emoji === o.emoji
            return (
              <button
                key={o.emoji}
                type="button"
                aria-pressed={on}
                aria-label={o.label}
                title={o.label}
                onClick={() => setEmoji(o.emoji)}
                className={cx(
                  'flex h-11 w-full items-center justify-center rounded-xl border text-xl transition',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                  on ? 'border-brand bg-brand-soft' : 'border-transparent bg-surface-2 hover:bg-line/60',
                )}
              >
                <span aria-hidden>{o.emoji}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button variant="secondary" onClick={onDone}>
          취소
        </Button>
        <Button type="submit">저장하기</Button>
      </div>
      {editing ? (
        <Button variant="danger" full onClick={() => setConfirming(true)}>
          이 기념일 지우기
        </Button>
      ) : null}
    </form>
  )
}

/** In-sheet confirm; takes focus so keyboard users land on the question. */
function ConfirmRemove({ title, onKeep, onRemove }: { title: string; onKeep: () => void; onRemove: () => void }) {
  const ref = useRef<HTMLParagraphElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <div>
      <p ref={ref} tabIndex={-1} className="text-sm leading-relaxed text-ink-2 outline-none">
        ‘{title}’ 기념일을 지울까요? 두 사람 화면에서 모두 사라지고, 이 날 알림도 더는 오지 않아요.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onKeep}>
          그대로 두기
        </Button>
        <Button variant="danger" onClick={onRemove}>
          지우기
        </Button>
      </div>
    </div>
  )
}
