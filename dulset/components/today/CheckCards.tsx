'use client'

import { useCallback, useState } from 'react'
import { Icon } from '@/components/ui/icons'
import { Avatar, Button, Card, cx, useToast } from '@/components/ui'
import {
  activeItems,
  coupleWeekCount,
  doneIds,
  isWeekly,
  nudgeableItem,
  weekCount,
  weekCountLabel,
  WEEKLY_QUESTION,
  weeklyCheckInName,
  weeklyDone,
} from '@/lib/logic/checks'
import { NUDGES_PER_DAY, nudgesSentToday, sendCheer, sendNudge } from '@/lib/logic/notifications'
import { acceptNudgesFor } from '@/lib/logic/settings'
import { rowProgress, stampOn, toggleWithCompletion } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import type { AppState, CheckItem, ISODate, MemberId } from '@/lib/types'
import { Badge, KIND_LABEL, KindIcon, ProgressBar } from './bits'
import CheckEditor from './CheckEditor'
import { useWeeklyUndo } from './useWeeklyUndo'

/** Daily items: checked today. Weekly check-ins: checked any day this week. */
function checkedNow(state: Pick<AppState, 'checkLog'>, member: MemberId, item: CheckItem, today: ISODate, done: string[]): boolean {
  return isWeekly(item) ? weeklyDone(state, member, item.id, today) : done.includes(item.id)
}

// ── My checklist ────────────────────────────────────────────

export function MyChecks() {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const weeklyUndo = useWeeklyUndo()
  const [editorOpen, setEditorOpen] = useState(false)
  // Stable, so the Sheet doesn't re-run its open effect (and steal focus) after each edit.
  const closeEditor = useCallback(() => setEditorOpen(false), [])
  const items = activeItems(state, me.id)
  const done = doneIds(state, me.id, today)
  const prog = rowProgress(state, me.id, today)
  // "이번 주 N/7" — days this week with every daily item done (a missed day never resets it).
  const week = weekCount(state, me.id, today)
  const tone = me.tracksCycle ? 'her' : 'him'

  const onToggle = (id: string) => {
    const now = stampOn(today)
    const alreadyTold = state.notifications.some((n) => n.key === `complete:${me.id}:${today}`)
    const preview = toggleWithCompletion(state, me.id, partner.id, today, id, now)
    update((s) => toggleWithCompletion(s, me.id, partner.id, today, id, now).state)
    if (preview.completed) {
      toast.show(alreadyTold ? '오늘 체크 완료! 👏' : `오늘 체크 완료! ${partner.name}님에게 알렸어요`)
    } else if (preview.cleared?.length) {
      const item = items.find((i) => i.id === id)
      if (item) weeklyUndo.offer(item, preview.cleared)
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Avatar member={me} size="sm" />
        <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
          나의 체크 <span className="font-medium text-ink-3">· {me.name}</span>
        </h3>
        {week > 0 ? <Badge tone="ok">{weekCountLabel(week)}</Badge> : null}
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
                <CheckRow item={item} checked={checkedNow(state, me.id, item, today, done)} onToggle={() => onToggle(item.id)} />
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
      {weeklyUndo.toast}
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
        <Icon name="check" className="h-4 w-4" strokeWidth={3} />
      </span>
      <KindIcon kind={item.kind} className="text-ink-2" />
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate text-[15px] font-semibold', checked ? 'text-ink-2' : 'text-ink')}>
          {isWeekly(item) ? weeklyCheckInName(item) : item.label}
        </span>
        <span className="block truncate text-xs text-ink-3">
          {isWeekly(item) ? (
            <>
              <span className="sr-only">{KIND_LABEL[item.kind]} · </span>
              {WEEKLY_QUESTION} · 주 1회
            </>
          ) : item.note ? (
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
  const left = Math.max(0, NUDGES_PER_DAY - nudgesSentToday(state, me.id, today))
  // A 콕 only ever points at an unchecked daily item — never a weekly check-in —
  // and the button is not there at all for a partner who turned 콕 받기 off
  // (settings.acceptNudgesFor; sendNudge drops it too).
  const target = nudgeableItem(state, partner.id, today)
  const accepts = acceptNudgesFor(state.settings, partner.id)
  const canNudge = !!target && left > 0 && accepts
  const tone = partner.tracksCycle ? 'her' : 'him'

  const nudge = () => {
    if (!canNudge) return
    const label = target?.label
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
              const isDone = checkedNow(state, partner.id, item, today, done)
              return (
                <li
                  key={item.id}
                  className={cx(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs',
                    isDone ? 'border-ok/30 bg-ok-soft font-semibold text-ok' : 'border-line bg-surface text-ink-3',
                  )}
                >
                  {isDone ? <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.6} /> : <KindIcon kind={item.kind} className="h-3.5 w-3.5" />}
                  {isWeekly(item) ? weeklyCheckInName(item) : item.label}
                  {isWeekly(item) ? <span className="text-[11px] font-normal text-ink-3">· 주 1회</span> : null}
                  <span className="sr-only">{isDone ? ' 완료' : ' 아직'}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <div className="mt-3 flex gap-2">
        {accepts ? (
          <Button variant="secondary" className="flex-1" onClick={nudge} disabled={!canNudge}>
            👉 콕 찌르기
          </Button>
        ) : null}
        <Button variant="secondary" className="flex-1" onClick={cheer}>
          👏 응원
        </Button>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-ink-3" aria-live="polite">
        {prog.complete
          ? `${partner.name}님은 오늘 체크를 모두 마쳤어요. 응원 한마디 어때요?`
          : items.length === 0
            ? '응원은 언제든 보낼 수 있어요.'
            : !accepts
              ? `${partner.name}님은 콕을 받지 않기로 했어요. 응원은 언제든 보낼 수 있어요.`
              : left === 0
                ? `콕은 하루 ${NUDGES_PER_DAY}번까지예요. 내일 다시 보낼 수 있어요.`
                : `콕은 오늘 ${left}번 더 보낼 수 있어요.`}
      </p>
    </Card>
  )
}

// ── Couple week count ───────────────────────────────────────

/** "둘 다 마친 날 · 이번 주 N/7" — counts days this week, so one missed day never resets it. */
export function CoupleStreak() {
  const { state, today } = useApp()
  const n = coupleWeekCount(state, today)
  if (n === 0) return null
  return (
    <p className="flex items-center justify-center gap-1.5 rounded-xl bg-ok-soft px-3 py-2.5 text-sm font-semibold text-ok">
      <Icon name="users" className="h-4 w-4 shrink-0" strokeWidth={2} /> 둘 다 마친 날 · <span className="tabular-nums">{weekCountLabel(n)}</span>
    </p>
  )
}
