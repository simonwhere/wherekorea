'use client'

// His own checks on the partner page (components/today/CheckCards.MyChecks
// read from the snapshot): a tap sends a 'check' event for today and shows
// as done right away (components/link/model local marks). Editing the items
// stays in the app.

import { Badge, KIND_LABEL, KindIcon, ProgressBar } from '@/components/today/bits'
import { Card, cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { weekCountLabel } from '@/lib/logic/checks'
import type { SnapshotCheck, SnapshotChecks, SnapshotMember } from '@/lib/logic/partnerSnapshot'
import { Bubble } from './bits'

function Row({ item, onToggle }: { item: SnapshotCheck; onToggle: () => void }) {
  const checked = item.done
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      data-check={item.id}
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
        <span className={cx('block truncate text-[15px] font-semibold', checked ? 'text-ink-2' : 'text-ink')}>{item.label}</span>
        <span className="block truncate text-xs text-ink-3">
          {item.weekly ? (
            <>
              <span className="sr-only">{KIND_LABEL[item.kind]} · </span>주 1회 체크인
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

export default function LinkChecks({
  me,
  her,
  checks,
  onToggle,
}: {
  me: SnapshotMember
  /** The viewer is the cycle owner's partner, so normally false (the bar takes his colour). */
  her: boolean
  checks: SnapshotChecks
  onToggle: (item: SnapshotCheck) => void
}) {
  const prog = checks
  return (
    <Card aria-label="오늘 체크">
      <div className="flex items-center gap-2">
        <Bubble member={me} her={her} />
        <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
          나의 체크 <span className="font-medium text-ink-3">· {me.name}</span>
        </h3>
        {checks.week > 0 ? <Badge tone="ok">{weekCountLabel(checks.week)}</Badge> : null}
      </div>
      {checks.items.length === 0 ? (
        <p className="mt-2 text-xs text-ink-3">아직 체크할 항목이 없어요. 항목은 앱에서 정해요.</p>
      ) : (
        <>
          <div className="mt-1 flex items-center gap-3">
            <ProgressBar
              value={prog.total ? prog.done / prog.total : 0}
              label="나의 오늘 체크 진행률"
              tone={prog.complete ? 'ok' : her ? 'her' : 'him'}
            />
            <span className="shrink-0 text-xs font-bold tabular-nums text-ink-2">
              {prog.done}/{prog.total}
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {checks.items.map((item) => (
              <li key={item.id}>
                <Row item={item} onToggle={() => onToggle(item)} />
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
    </Card>
  )
}
