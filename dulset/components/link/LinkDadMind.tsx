'use client'

// 아빠 마음 on his link page (2026-11-01, '12개 전부' #12) — the card his
// parenting home shows (components/baby/DadMindCard), for a husband who uses
// only the link. The snapshot carries a flag (PartnerDay.dadMind, from
// dadMind.dadMindDue); the question, the lines and the numbers come from
// lib/logic/dadMind on his page. Either button sends 'dad-mind-asked' — only
// that he was asked, never which button. Never in her preview.

import { useCallback, useState } from 'react'
import { DadMindSheet } from '@/components/baby/DadMindSheet'
import { cx } from '@/components/ui'
import { DAD_MIND_QUESTION } from '@/lib/logic/dadMind'
import { Pill } from './bits'

export default function LinkDadMind({ due, onAsked, className }: { due: boolean; onAsked: () => void; className?: string }) {
  const [sheet, setSheet] = useState(false)
  const closeSheet = useCallback(() => setSheet(false), [])
  if (!due && !sheet) return null
  return (
    <>
      {due ? (
        <section
          aria-label={DAD_MIND_QUESTION}
          data-dad-mind
          className={cx('rounded-card bg-surface px-[18px] py-4 shadow-warm dark:border dark:border-line/70 dark:shadow-none', className)}
        >
          <p className="text-[17px] font-extrabold tracking-[-0.03em] text-ink">{DAD_MIND_QUESTION}</p>
          <div className="mt-3 flex gap-2">
            <Pill tone="soft" className="flex-1" onClick={onAsked}>
              괜찮아요
            </Pill>
            <Pill
              tone="soft"
              className="flex-1"
              onClick={() => {
                setSheet(true)
                onAsked()
              }}
            >
              이야기할 곳 보기
            </Pill>
          </div>
        </section>
      ) : null}
      <DadMindSheet open={sheet} onClose={closeSheet} />
    </>
  )
}
