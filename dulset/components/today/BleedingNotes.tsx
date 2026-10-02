'use client'

// Under the '출혈이 시작됐어요' card (owner only): the rest of the evidence
// lines (docs/research/early-pregnancy-bleeding.json via
// lib/logic/positiveBleeding), the 응급 signs she can tick — any of the NHS
// 999 signs turns the advice into the one 응급실·119 line, a fever into 'call
// the clinic now' — and the sources with their check date. Nothing here says
// what the bleeding means; the chips are local to this screen and never saved.

import { useState } from 'react'
import { Disclaimer, cx } from '@/components/ui'
import {
  BLEEDING_ADVICE_CHECKED_AT,
  BLEEDING_SIGNS,
  BLEEDING_SIGN_LABEL,
  BLEEDING_SOURCES,
  bleedingAdvice,
  type BleedingSign,
} from '@/lib/logic/positiveBleeding'
import type { Moment } from '@/lib/logic/ttcFlow'
import { useApp } from '@/lib/store'
import { ExternalLink } from './bits'

export default function BleedingNotes({ bleeding, className }: { bleeding: NonNullable<Moment['bleeding']>; className?: string }) {
  const { state, today } = useApp()
  const [signs, setSigns] = useState<BleedingSign[]>([])
  const toggle = (s: BleedingSign) => setSigns((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
  // With signs ticked the advice is re-read with them; without, the card's own lines.
  const advice = signs.length ? bleedingAdvice(state, today, signs) : undefined
  const urgent = advice?.kind === 'urgent'
  const lines = advice ? advice.lines : bleeding.lines

  return (
    <div className={className}>
      {advice ? (
        <div
          role="status"
          className={cx(
            'rounded-[14px] px-3.5 py-3 text-[13.5px] leading-[1.55]',
            urgent ? 'bg-warn-soft text-ink' : 'bg-brand-soft text-ink',
          )}
        >
          <p className={cx('text-[12.5px] font-bold', urgent ? 'text-warn' : 'text-brand-ink')}>
            {urgent ? '지금은 응급실이에요' : '지금 병원에 연락해요'}
          </p>
          <ul className="mt-1 space-y-1.5">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="space-y-1.5 text-[13px] leading-[1.55] text-ink-2">
          {lines.map((line) => (
            <li key={line} className="flex gap-1.5">
              <span aria-hidden className="shrink-0 text-ink-3">
                ·
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[12.5px] font-bold text-ink">지금 이런 게 있나요?</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {BLEEDING_SIGNS.map((s) => {
          const on = signs.includes(s)
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(s)}
              className={cx(
                'inline-flex min-h-[44px] items-center rounded-full border px-3 text-[12.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                on ? 'border-warn bg-warn-soft text-ink' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
              )}
            >
              {BLEEDING_SIGN_LABEL[s]}
            </button>
          )
        })}
      </div>

      <div className="mt-1 flex flex-wrap gap-x-3">
        {BLEEDING_SOURCES.map((src) => (
          <ExternalLink key={src.url} href={src.url}>
            {src.name}
          </ExternalLink>
        ))}
      </div>
      <Disclaimer>
        병원마다 안내가 달라요. 여기 적힌 건 일반 정보예요 (확인 {BLEEDING_ADVICE_CHECKED_AT}).
      </Disclaimer>
    </div>
  )
}
