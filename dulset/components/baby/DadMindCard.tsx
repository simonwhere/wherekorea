'use client'

// 아빠 마음, 한 번 묻기 (2026-11-01, '12개 전부' #12) — on HIS parenting home
// only, from 출생일 + 90 until he taps either button (lib/logic/dadMind).
// [괜찮아요] closes it; [이야기할 곳 보기] opens the sheet with where to talk.
// Either way only 'asked' is kept (decisions 'dad-mind-asked:<birthDate>:<member>')
// — never which button, never an answer — and nothing shows on her side.

import { useCallback, useState } from 'react'
import { cx } from '@/components/ui'
import { PillButton } from '@/components/today/bits'
import { DAD_MIND_QUESTION, dadMindDue, markDadMindAsked } from '@/lib/logic/dadMind'
import { useApp } from '@/lib/store'
import { DadMindSheet } from './DadMindSheet'

export default function DadMindCard({ className }: { className?: string }) {
  const { state, update, today, me } = useApp()
  const [sheet, setSheet] = useState(false)
  const closeSheet = useCallback(() => setSheet(false), [])
  const due = dadMindDue(state, today, me.id)
  if (!due && !sheet) return null
  const asked = () => update((s) => markDadMindAsked(s, today, me.id))
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
            <PillButton size="split" variant="soft" className="flex-1" onClick={asked}>
              괜찮아요
            </PillButton>
            <PillButton
              size="split"
              variant="soft"
              className="flex-1"
              onClick={() => {
                setSheet(true)
                asked()
              }}
            >
              이야기할 곳 보기
            </PillButton>
          </div>
        </section>
      ) : null}
      <DadMindSheet open={sheet} onClose={closeSheet} />
    </>
  )
}
