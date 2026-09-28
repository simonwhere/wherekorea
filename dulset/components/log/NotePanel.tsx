'use client'

import { useId, useState } from 'react'
import type { SaveLog } from '@/components/log/parts'
import { Button, inputClass } from '@/components/ui'
import { uid } from '@/lib/id'
import { NOTE_MAX_LENGTH, addNote } from '@/lib/logic/logs'
import { stampOn } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import type { ISODate } from '@/lib/types'

/** 메모: one line, saved to 우리의 기록 (the diary) for that day. */
export default function NotePanel({ date, save }: { date: ISODate; save: SaveLog }) {
  const { today, viewer, partner } = useApp()
  const inputId = useId()
  const [text, setText] = useState('')
  const ready = text.trim().length > 0

  const submit = () => {
    if (!ready) return
    const id = uid()
    const at = stampOn(today)
    save((s) => addNote(s, { date, author: viewer, text, id }, at), { kind: 'note', id }, '메모를 남겼어요 · 우리 탭에서 볼 수 있어요')
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <label htmlFor={inputId} className="block text-xs font-semibold text-ink-2">
        한 줄 메모
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={NOTE_MAX_LENGTH}
          placeholder="오늘 컨디션이나 마음을 한 줄로"
          enterKeyHint="done"
          className={inputClass}
        />
        <Button type="submit" disabled={!ready} className="shrink-0">
          남기기
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-ink-3">우리 탭의 기록에 들어가요. {partner.name}님도 볼 수 있어요.</p>
    </form>
  )
}
