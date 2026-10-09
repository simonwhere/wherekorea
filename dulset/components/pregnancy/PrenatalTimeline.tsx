'use client'

import { useId, useMemo, useState } from 'react'
import SupportButton from '@/components/plan/SupportButton'
import { Card, SectionTitle, cx, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { programById } from '@/lib/content/programs'
import { ROADMAP } from '@/lib/content/roadmap'
import { formatShort } from '@/lib/dates'
import { planItems } from '@/lib/logic/plan'
import { stampOn } from '@/lib/logic/today'
import { togetherRow, type TogetherItem } from '@/lib/logic/together'
import {
  prenatalTimeline,
  shareCheckWithPartner,
  splitTimeline,
  toggleMilestone,
  type CheckStatus,
  type TimelineRow,
} from '@/lib/logic/pregnancyView'
import { useApp } from '@/lib/store'
import type { ISODate } from '@/lib/types'
import { CheckBox } from './CheckBox'

const BADGE: Partial<Record<CheckStatus, { label: string; className: string }>> = {
  now: { label: '지금', className: 'bg-brand text-white' },
  next: { label: '다음', className: 'bg-brand-soft text-brand-ink' },
}

const linkClass =
  'inline-flex min-h-[44px] items-center text-xs font-semibold underline-offset-2 hover:underline'

/** 검사 일정 row → its 챙길 것 item (the roadmap template whose tick is the same milestone). */
const ITEM_BY_KEY: ReadonlyMap<string, string> = new Map(ROADMAP.filter((t) => t.milestoneKey).map((t) => [t.milestoneKey!, t.id]))

export default function PrenatalTimeline({ weeks, since }: { weeks: number; since: ISODate }) {
  const { state, update, today, me, partner } = useApp()
  // Together (2026-10-09): her checks carry what the 함께하는 사람 can do + [같이 할게요],
  // and on her screen '민수님이 같이 챙긴대요' — the same rows as 챙길 것 (lib/logic/together).
  const plan = useMemo(() => new Map(planItems(state, today).map((i) => [i.id, i])), [state, today])
  const togetherFor = (key: string): TogetherItem | undefined => {
    const item = plan.get(ITEM_BY_KEY.get(key) ?? '')
    return item ? togetherRow(state, today, me.id, item) : undefined
  }
  const toast = useToast()
  const [showEarlier, setShowEarlier] = useState(false)
  const earlierId = useId()
  const rows = prenatalTimeline(state, weeks, since)
  const { earlier, rest } = splitTimeline(rows)
  const doneCount = rows.filter((r) => r.status === 'done').length
  const earlierDone = earlier.filter((r) => r.status === 'done').length

  const toggle = (row: TimelineRow) => {
    update((s) => toggleMilestone(s, row.key, today, since))
    if (row.status !== 'done') toast.show('완료로 표시했어요 ✓')
  }

  const share = (row: TimelineRow) => {
    const now = stampOn(today)
    // Message from the state we render with; the updater re-checks (deduped per check per day).
    const { sent } = shareCheckWithPartner(state, me, partner.id, row, today, now)
    update((s) => shareCheckWithPartner(s, me, partner.id, row, today, now).state)
    toast.show(sent ? `${partner.name}님에게 일정을 알렸어요` : '오늘은 이미 알렸어요')
  }

  const renderRow = (row: TimelineRow) => (
    <Row
      key={row.id}
      row={row}
      together={togetherFor(row.key)}
      partnerName={partner.name}
      onToggle={() => toggle(row)}
      onShare={() => share(row)}
    />
  )

  return (
    <section className="mt-6">
      <SectionTitle
        sub="병원마다 달라요 — 담당 의료진 안내를 따르세요"
        action={
          <span className="text-xs font-semibold tabular-nums text-ink-3">
            <span aria-hidden>
              {doneCount}/{rows.length}
            </span>
            <span className="sr-only">
              {rows.length}개 중 {doneCount}개 완료
            </span>
          </span>
        }
      >
        검사 일정
      </SectionTitle>
      <Card className="px-3 py-2">
        {earlier.length > 0 ? (
          <>
            <button
              type="button"
              onClick={() => setShowEarlier((v) => !v)}
              aria-expanded={showEarlier}
              aria-controls={earlierId}
              className="flex min-h-[44px] w-full items-center justify-between gap-2 px-2 text-left text-xs font-medium text-ink-3"
            >
              <span>
                {showEarlier ? '지난 일정 접기' : `지난 일정 ${earlier.length}개 보기`}
                {earlierDone > 0 ? (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-ok">
                    <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.6} />
                    {earlierDone}
                  </span>
                ) : null}
              </span>
              <Icon name="chev" className={cx('h-4 w-4 transition-transform', showEarlier && 'rotate-180')} strokeWidth={2.2} />
            </button>
            <ol id={earlierId} hidden={!showEarlier} aria-label="지난 검사 일정" className="border-b border-line/70 pb-1">
              {earlier.map(renderRow)}
            </ol>
          </>
        ) : null}
        <ol aria-label="다가오는 검사 일정">{rest.map(renderRow)}</ol>
      </Card>
    </section>
  )
}

function Row({
  row,
  together,
  partnerName,
  onToggle,
  onShare,
}: {
  row: TimelineRow
  together?: TogetherItem
  partnerName: string
  onToggle: () => void
  onShare: () => void
}) {
  const done = row.status === 'done'
  const highlight = row.status === 'now' || row.status === 'next'
  const badge = BADGE[row.status]
  const program = row.programId ? programById(row.programId) : undefined
  return (
    <li
      aria-current={row.status === 'now' ? 'step' : undefined}
      className={cx('flex gap-3 rounded-xl px-2 py-2.5', row.status === 'now' && 'my-1 bg-brand-soft')}
    >
      <div className="pt-0.5">
        <CheckBox checked={done} onToggle={onToggle} label={`${row.title} 완료`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cx('text-[11px] font-semibold tabular-nums', highlight ? 'text-brand-ink' : 'text-ink-3')}>
            {row.weekLabel}
          </span>
          {badge ? (
            <span className={cx('rounded-full px-1.5 py-0.5 text-[10px] font-bold', badge.className)}>{badge.label}</span>
          ) : null}
          {done && row.doneAt ? (
            <span className="text-[10px] font-medium text-ok">{formatShort(row.doneAt)} 완료</span>
          ) : null}
        </div>
        <p className={cx('mt-0.5 text-sm font-semibold', done ? 'text-ink-3' : 'text-ink')}>{row.title}</p>
        {!done ? <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{row.why}</p> : null}
        {!done && row.status !== 'past' && together?.support ? (
          <div className="mt-1 flex items-center gap-2" data-support-line>
            <p className="flex min-w-0 flex-1 items-start gap-1.5 text-xs leading-relaxed text-ink-2">
              <Icon name="users" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-him" />
              <span className="min-w-0">
                <span className="sr-only">내가 할 수 있는 것: </span>
                {together.support}
              </span>
            </p>
            <SupportButton itemId={together.id} title={row.title} supported={together.supported} canSupport={together.canSupport} />
          </div>
        ) : null}
        {!done && together?.supportedBy ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-ink" data-supported-by>
            <Icon name="users" className="h-3.5 w-3.5 shrink-0 text-him" />
            {together.supportedBy}
          </p>
        ) : null}
        {!done && (program || highlight) ? (
          <div className="-mb-2 flex flex-wrap gap-x-4">
            {program ? (
              <a href={program.url} target="_blank" rel="noopener noreferrer" className={cx(linkClass, 'text-brand-ink')}>
                {program.urlLabel}에서 신청
                <Icon name="ext" className="ml-0.5 h-3.5 w-3.5" strokeWidth={2.2} />
                <span className="sr-only"> (새 창)</span>
              </a>
            ) : (
              <button type="button" onClick={onShare} className={cx(linkClass, 'gap-1 text-ink-2')}>
                <Icon name="users" className="h-4 w-4" />
                {partnerName}님에게 일정 알리기
              </button>
            )}
          </div>
        ) : null}
      </div>
    </li>
  )
}
