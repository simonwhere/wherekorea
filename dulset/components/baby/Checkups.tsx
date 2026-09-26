'use client'

import { useState } from 'react'
import { Button, Card, Disclaimer, SectionTitle, cx, useToast } from '@/components/ui'
import { CHECKUP_KIND_LABEL, CHECKUP_LINK, CHECKUP_NOTE } from '@/lib/content/baby'
import { dLabel } from '@/lib/dates'
import { checkupFocus, checkupTimeline, formatSpan, shortDate, toggleCheckup, type CheckupRow } from '@/lib/logic/babyView'
import { useApp } from '@/lib/store'
import type { Baby } from '@/lib/types'
import { ExternalLink, Pill, TickButton } from './bits'

function title(r: CheckupRow): string {
  return `${r.round}차 ${CHECKUP_KIND_LABEL[r.kind]}`
}

export default function Checkups({ baby }: { baby: Baby }) {
  const { state, today, update } = useApp()
  const toast = useToast()
  const [showAll, setShowAll] = useState(false)
  const birth = baby.birthDate
  const rows = checkupTimeline(state, birth, today)
  const focus = checkupFocus(rows)
  const doneCount = rows.filter((r) => r.status === 'done').length

  const toggle = (r: CheckupRow) => {
    update((s) => toggleCheckup(s, r.id, birth, today))
    if (r.status !== 'done') toast.show(`${title(r)} 받았어요 ✓`)
  }

  return (
    <section>
      <SectionTitle
        sub="건강검진 8회 + 구강검진 4회 · 본인부담 없음"
        action={<span className="text-xs text-ink-3">{doneCount}/{rows.length}</span>}
      >
        영유아 건강검진
      </SectionTitle>

      {focus.length > 0 ? (
        <div className="grid gap-2">
          {focus.map((r) => (
            <Card key={r.id} tone={r.status === 'now' ? 'ok' : 'default'} className="py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold text-ink-2">
                  {r.status === 'now' ? '지금 받을 수 있어요' : '다음 검진'}
                </p>
                <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink">
                  {r.status === 'now' ? `마감 ${dLabel(r.end, today)}` : `시작 ${dLabel(r.start, today)}`}
                </span>
              </div>
              <p className="mt-0.5 text-base font-bold text-ink">{title(r)}</p>
              <p className="text-xs text-ink-2">
                {r.label} · <span className="tabular-nums">{formatSpan(r.start, r.end, today)}</span>
              </p>
              {r.status === 'now' ? (
                <Button size="md" variant="secondary" className="mt-2.5" onClick={() => toggle(r)} ariaLabel={`${title(r)} 받았어요`}>
                  <span aria-hidden>✓</span> 받았어요
                </Button>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <Card tone="muted" className="py-3 text-sm text-ink-2">
          {rows.every((r) => r.status === 'done' || r.status === 'past')
            ? '영유아 건강검진 기간이 모두 지났어요. 그동안 고생 많았어요!'
            : '지금 열려 있는 검진이 없어요.'}
        </Card>
      )}

      <button
        type="button"
        onClick={() => setShowAll((v) => !v)}
        aria-expanded={showAll}
        className="mt-1 flex min-h-[44px] w-full items-center justify-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink"
      >
        {showAll ? '전체 일정 접기' : `전체 일정 보기 (${rows.length}회)`}
        <span aria-hidden className={cx('transition-transform', showAll && 'rotate-180')}>
          ▾
        </span>
      </button>

      {showAll ? (
        <Card className="px-0 py-1">
          <ol>
            {rows.map((r) => (
              <li
                key={r.id}
                className={cx(
                  'flex min-h-[52px] items-center gap-1 border-b border-line/60 pl-4 pr-1 last:border-b-0',
                  (r.status === 'now' || r.status === 'next') && 'bg-surface-2',
                )}
              >
                <div className="min-w-0 flex-1 py-1.5">
                  <p className={cx('text-sm font-semibold', r.status === 'done' || r.status === 'past' ? 'text-ink-2' : 'text-ink')}>
                    {title(r)}
                    <span className="ml-1 text-xs font-normal text-ink-3">{r.label}</span>
                  </p>
                  <p className="text-[11px] tabular-nums text-ink-3">
                    {formatSpan(r.start, r.end, today)}
                    {r.status === 'done' && r.doneAt ? ` · ${shortDate(r.doneAt, today)} 체크` : ''}
                    {r.status === 'past' ? ' · 기간 지남 (받았다면 체크해 주세요)' : ''}
                  </p>
                </div>
                {r.status === 'now' ? <Pill tone="ok">지금</Pill> : r.status === 'next' ? <Pill>다음</Pill> : null}
                <TickButton
                  checked={r.status === 'done'}
                  onClick={() => toggle(r)}
                  label={`${title(r)} 받았어요`}
                />
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <Disclaimer>
        {CHECKUP_NOTE}{' '}
        <ExternalLink href={CHECKUP_LINK.url} className="font-semibold text-brand-ink underline underline-offset-2">
          {CHECKUP_LINK.label}
        </ExternalLink>
      </Disclaimer>
    </section>
  )
}
