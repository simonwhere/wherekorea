'use client'

import { useId, useState } from 'react'
import FeelPanel from '@/components/log/FeelPanel'
import type { SaveLog } from '@/components/log/parts'
import { Button, Toggle, inputClass, useToast } from '@/components/ui'
import { formatKo } from '@/lib/dates'
import { uid } from '@/lib/id'
import { NOTE_MAX_LENGTH, addNote } from '@/lib/logic/logs'
import { PERSONAL_NOTE_MAX, personalDay, setPrivateNote } from '@/lib/logic/personalLog'
import { canLogCycle } from '@/lib/logic/prefs'
import { stampOn } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import type { ISODate } from '@/lib/types'

/**
 * 메모: one line, saved to 우리의 기록 (the diary) for that day — or, with
 * '나만 보기' on, as the cycle owner's private line in her own log
 * (personalLog, N11: never the partner's screen, never anything shared with
 * him — the 주기 tab's cycle row lists it). While preparing, the cycle owner
 * also gets the 오늘 컨디션 chips on top.
 */
export default function NotePanel({ date, save }: { date: ISODate; save: SaveLog }) {
  const { state, update, today, viewer, partner } = useApp()
  const toast = useToast()
  const inputId = useId()
  const [text, setText] = useState('')
  const [privateOnly, setPrivateOnly] = useState(false)
  const ready = text.trim().length > 0
  // Her own log (chips + a private line) is for the cycle owner while preparing.
  const own = canLogCycle(state, viewer) && state.stage === 'preparing'
  const privateLine = own ? personalDay(state, viewer, date)?.note : undefined

  const submit = () => {
    if (!ready) return
    if (own && privateOnly) {
      // Straight into her own log: no 되돌리기 toast (the line can be cleared right here), the sheet stays open.
      update((s) => setPrivateNote(s, viewer, date, text))
      setText('')
      toast.show('나만 보는 메모를 남겼어요 · 주기 탭의 주기 기록에서 볼 수 있어요')
      return
    }
    const id = uid()
    const at = stampOn(today)
    save((s) => addNote(s, { date, author: viewer, text, id }, at), { kind: 'note', id }, '메모를 남겼어요 · 우리 탭에서 볼 수 있어요')
  }

  const clearPrivate = () => {
    update((s) => setPrivateNote(s, viewer, date, undefined))
    toast.show('나만 보는 메모를 지웠어요')
  }

  const isPrivate = own && privateOnly

  return (
    <div className="space-y-3">
      {own ? <FeelPanel date={date} /> : null}
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
            maxLength={isPrivate ? PERSONAL_NOTE_MAX : NOTE_MAX_LENGTH}
            placeholder="오늘 컨디션이나 마음을 한 줄로"
            enterKeyHint="done"
            className={inputClass}
          />
          <Button type="submit" disabled={!ready} className="shrink-0">
            남기기
          </Button>
        </div>
        {own ? (
          <Toggle
            checked={privateOnly}
            onChange={setPrivateOnly}
            label="나만 보기"
            description={
              privateOnly
                ? `나에게만 보여요. ${partner.name}님 화면에는 어디에도 나오지 않아요. 주기 탭의 주기 기록에서 다시 볼 수 있어요.`
                : `우리 탭의 기록에 들어가요. ${partner.name}님도 볼 수 있어요.`
            }
          />
        ) : (
          <p className="text-[11px] leading-relaxed text-ink-3">우리 탭의 기록에 들어가요. {partner.name}님도 볼 수 있어요.</p>
        )}
      </form>
      {privateLine ? (
        <div className="flex items-start justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
          <p className="min-w-0 text-xs leading-relaxed text-ink-2">
            <b className="font-semibold text-ink">{formatKo(date, { weekday: false })} · 나만 보는 메모</b>
            <br />
            {privateLine}
          </p>
          <button
            type="button"
            onClick={clearPrivate}
            className="h-11 shrink-0 rounded-lg px-3 text-xs font-semibold text-ink-2 hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            지우기
          </button>
        </div>
      ) : null}
    </div>
  )
}
