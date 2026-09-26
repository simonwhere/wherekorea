'use client'

import { useCallback, useState } from 'react'
import { Avatar, Button, Card, cx, useToast } from '@/components/ui'
import { activeItems, coupleStreak, doneIds, streak } from '@/lib/logic/checks'
import { NUDGES_PER_DAY, nudgesSentToday, sendCheer, sendNudge } from '@/lib/logic/notifications'
import { firstUnchecked, rowProgress, stampOn, toggleWithCompletion } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import type { CheckItem } from '@/lib/types'
import { Badge, KIND_ICON, KIND_LABEL, ProgressBar } from './bits'
import CheckEditor from './CheckEditor'

// ── My checklist ────────────────────────────────────────────

export function MyChecks() {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const [editorOpen, setEditorOpen] = useState(false)
  // Stable, so the Sheet doesn't re-run its open effect (and steal focus) after each edit.
  const closeEditor = useCallback(() => setEditorOpen(false), [])
  const items = activeItems(state, me.id)
  const done = doneIds(state, me.id, today)
  const prog = rowProgress(state, me.id, today)
  const days = streak(state, me.id, today)
  const tone = me.tracksCycle ? 'her' : 'him'

  const onToggle = (id: string) => {
    const now = stampOn(today)
    const alreadyTold = state.notifications.some((n) => n.key === `complete:${me.id}:${today}`)
    const preview = toggleWithCompletion(state, me.id, partner.id, today, id, now)
    update((s) => toggleWithCompletion(s, me.id, partner.id, today, id, now).state)
    if (preview.completed) {
      toast.show(alreadyTold ? '오늘 체크 완료! 👏' : `오늘 체크 완료! ${partner.name}님에게 알렸어요`)
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Avatar member={me} size="sm" />
        <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
          나의 체크 <span className="font-medium text-ink-3">· {me.name}</span>
        </h3>
        {days > 0 ? <Badge tone="ok">연속 {days}일</Badge> : null}
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="-mr-2 flex min-h-[44px] items-center rounded-xl px-3 text-xs font-semibold text-ink-2 hover:bg-surface-2"
        >
          편집
        </button>
      </div>

      {items.length === 0 ? (
        <div className="mt-2 rounded-xl border border-dashed border-line px-4 py-5 text-center">
          <p className="text-sm font-semibold text-ink">아직 체크할 항목이 없어요</p>
          <p className="mt-1 text-xs text-ink-3">매일 챙길 영양제나 생활습관을 추가해 보세요.</p>
          <Button size="md" variant="secondary" className="mt-3" onClick={() => setEditorOpen(true)}>
            항목 추가하기
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-1 flex items-center gap-3">
            <ProgressBar value={prog.total ? prog.done / prog.total : 0} label="나의 오늘 체크 진행률" tone={prog.complete ? 'ok' : tone} />
            <span className="shrink-0 text-xs font-bold tabular-nums text-ink-2">
              {prog.done}/{prog.total}
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <CheckRow item={item} checked={done.includes(item.id)} onToggle={() => onToggle(item.id)} />
              </li>
            ))}
          </ul>
          {prog.complete ? (
            <p className="mt-3 text-center text-xs font-semibold text-ok" role="status">
              오늘 체크를 모두 마쳤어요. 멋져요! 🎉
            </p>
          ) : null}
        </>
      )}
      <CheckEditor open={editorOpen} onClose={closeEditor} />
    </Card>
  )
}

function CheckRow({ item, checked, onToggle }: { item: CheckItem; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cx(
        'flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        checked ? 'border-ok/30 bg-ok-soft' : 'border-line bg-surface hover:bg-surface-2',
      )}
    >
      <span
        aria-hidden
        className={cx(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold transition-colors',
          checked ? 'border-ok bg-ok text-white' : 'border-line bg-surface text-transparent',
        )}
      >
        ✓
      </span>
      <span aria-hidden className="text-lg">
        {KIND_ICON[item.kind]}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate text-[15px] font-semibold', checked ? 'text-ink-2' : 'text-ink')}>
          {item.label}
        </span>
        <span className="block truncate text-xs text-ink-3">
          {item.note ? (
            <>
              <span className="sr-only">{KIND_LABEL[item.kind]} · </span>
              {item.note}
            </>
          ) : (
            KIND_LABEL[item.kind]
          )}
        </span>
      </span>
    </button>
  )
}

// ── Partner's checklist (read-only) ─────────────────────────

export function PartnerChecks() {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const items = activeItems(state, partner.id)
  const done = doneIds(state, partner.id, today)
  const prog = rowProgress(state, partner.id, today)
  const sent = nudgesSentToday(state, me.id, today)
  const left = Math.max(0, NUDGES_PER_DAY - sent)
  const canNudge = items.length > 0 && !prog.complete && left > 0
  const tone = partner.tracksCycle ? 'her' : 'him'

  const nudge = () => {
    if (!canNudge) return
    const label = firstUnchecked(state, partner.id, today)?.label
    update((s) => sendNudge(s, me.id, partner.id, today, stampOn(today), label))
    toast.show(`${partner.name}님에게 콕! 보냈어요 (⇄로 ${partner.name}님 화면에서 확인)`)
  }
  const cheer = () => {
    update((s) => sendCheer(s, me.id, partner.id, stampOn(today)))
    toast.show(`${partner.name}님에게 응원을 보냈어요 👏`)
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Avatar member={partner} size="sm" />
        <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{partner.name}님의 체크</h3>
        {prog.complete ? (
          <Badge tone="ok">모두 완료 ✓</Badge>
        ) : prog.total > 0 ? (
          <span className="text-xs font-bold tabular-nums text-ink-2">
            {prog.done}/{prog.total}
          </span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="mt-2 text-xs text-ink-3">{partner.name}님은 아직 체크 항목이 없어요.</p>
      ) : (
        <>
          <ProgressBar
            className="mt-2"
            value={prog.total ? prog.done / prog.total : 0}
            label={`${partner.name}님의 오늘 체크 진행률`}
            tone={prog.complete ? 'ok' : tone}
          />
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label={`${partner.name}님의 항목`}>
            {items.map((item) => {
              const isDone = done.includes(item.id)
              return (
                <li
                  key={item.id}
                  className={cx(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs',
                    isDone ? 'border-ok/30 bg-ok-soft font-semibold text-ok' : 'border-line bg-surface text-ink-3',
                  )}
                >
                  <span aria-hidden>{isDone ? '✓' : KIND_ICON[item.kind]}</span>
                  {item.label}
                  <span className="sr-only">{isDone ? ' 완료' : ' 아직'}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={nudge} disabled={!canNudge}>
          👉 콕 찌르기
        </Button>
        <Button variant="secondary" className="flex-1" onClick={cheer}>
          👏 응원
        </Button>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-ink-3" aria-live="polite">
        {prog.complete
          ? `${partner.name}님은 오늘 체크를 모두 마쳤어요. 응원 한마디 어때요?`
          : items.length === 0
            ? '응원은 언제든 보낼 수 있어요.'
            : left === 0
              ? `콕은 하루 ${NUDGES_PER_DAY}번까지예요. 내일 다시 보낼 수 있어요.`
              : `콕은 오늘 ${left}번 더 보낼 수 있어요.`}
      </p>
    </Card>
  )
}

// ── Couple streak ───────────────────────────────────────────

export function CoupleStreak() {
  const { state, today } = useApp()
  const n = coupleStreak(state, today)
  if (n === 0) return null
  return (
    <p className="flex items-center justify-center gap-1.5 rounded-xl bg-ok-soft px-3 py-2.5 text-sm font-semibold text-ok">
      <span aria-hidden>💑</span> 둘 다 완료 연속 {n}일
    </p>
  )
}
