'use client'

import { useId, useState } from 'react'
import { Button, Field, Sheet, cx, inputClass, textareaClass, useToast } from '@/components/ui'
import { updateEntry } from '@/lib/logic/diary'
import { DIARY_MAX_TEXT, clampDiaryDate } from '@/lib/logic/diaryExport'
import { useApp } from '@/lib/store'
import type { DiaryEntry } from '@/lib/types'
import MoodPicker from './MoodPicker'

/** Edit text, mood and date of one of my own entries. `onClose` must be stable. */
export default function EditEntrySheet({ entry, onClose }: { entry: DiaryEntry | null; onClose: () => void }) {
  return (
    <Sheet open={!!entry} onClose={onClose} title="기록 고치기">
      {entry ? <EditForm key={entry.id} entry={entry} onDone={onClose} /> : null}
    </Sheet>
  )
}

function EditForm({ entry, onDone }: { entry: DiaryEntry; onDone: () => void }) {
  const { update, today } = useApp()
  const toast = useToast()
  const [text, setText] = useState(entry.text)
  const [mood, setMood] = useState(entry.mood)
  const [date, setDate] = useState(entry.date)
  const textId = useId()
  const countId = useId()

  const canSave = text.trim().length > 0 || !!entry.photoId
  const maxDate = entry.date > today ? entry.date : today

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    const nextDate = clampDiaryDate(date, maxDate)
    const nextText = text.trim()
    if (nextText !== entry.text || mood !== entry.mood || nextDate !== entry.date) {
      update((s) => updateEntry(s, entry.id, { text: nextText, mood, date: nextDate }))
      toast.show('고쳤어요')
    }
    onDone()
  }

  return (
    <form className="space-y-4" onSubmit={save}>
      <div>
        <label htmlFor={textId} className="mb-1.5 block text-xs font-semibold text-ink-2">
          내용
        </label>
        <textarea
          id={textId}
          rows={6}
          maxLength={DIARY_MAX_TEXT}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-describedby={countId}
          className={cx(textareaClass, 'resize-none text-[15px] leading-relaxed')}
        />
        <p id={countId} className="mt-1 text-right text-[11px] tabular-nums text-ink-3">
          {text.length.toLocaleString('ko-KR')} / {DIARY_MAX_TEXT.toLocaleString('ko-KR')}
        </p>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-ink-2">
          기분 <span className="font-normal text-ink-3">(선택)</span>
        </p>
        <MoodPicker value={mood} onChange={setMood} label="그날의 기분 (선택)" />
      </div>
      <Field label="날짜">
        <input
          type="date"
          className={inputClass}
          value={date}
          max={maxDate}
          onChange={(e) => setDate(e.target.value)}
          onBlur={() => setDate((d) => clampDiaryDate(d, maxDate))}
        />
      </Field>
      {!canSave ? <p className="text-xs font-medium text-brand-ink">내용을 한 줄 이상 적어 주세요.</p> : null}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button variant="secondary" onClick={onDone}>
          취소
        </Button>
        <Button type="submit" disabled={!canSave}>
          저장하기
        </Button>
      </div>
    </form>
  )
}
