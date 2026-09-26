'use client'

import type { TabKey } from '@/components/AppShell'
import { Button, Card, Disclaimer, cx } from '@/components/ui'
import { PROGRAMS_CHECKED_AT, programById, type Program } from '@/lib/content/programs'
import { DIARY_NAME, promptFor } from '@/lib/logic/diary'
import { DATE_CARD_COPY, doctorAdvice } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import { ExternalLink } from './bits'

type Nav = (tab: TabKey) => void

// ── Date idea teaser ────────────────────────────────────────

/** Prominent near "우리의 주간", otherwise a quiet link. */
export function DateCard({ onNavigate, prominent }: { onNavigate: Nav; prominent: boolean }) {
  const { state } = useApp()
  if (prominent) {
    return (
      <button
        type="button"
        onClick={() => onNavigate('date')}
        className="flex min-h-[64px] w-full items-center gap-3 rounded-xl2 border border-fert/20 bg-fert-soft p-4 text-left shadow-card transition-colors hover:border-fert/40"
      >
        <span aria-hidden className="text-2xl">
          💞
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">이번 주 데이트 아이디어 골라 뒀어요</span>
          <span className="mt-0.5 block text-xs text-ink-2">둘만의 시간, 부담 없이 즐겨요</span>
        </span>
        <span aria-hidden className="text-lg text-fert">
          →
        </span>
      </button>
    )
  }
  const copy = DATE_CARD_COPY[state.stage]
  return (
    <button
      type="button"
      onClick={() => onNavigate('date')}
      className="flex min-h-[52px] w-full items-center gap-3 rounded-xl bg-surface-2 px-4 py-2.5 text-left transition-colors hover:bg-line/50"
    >
      <span aria-hidden>💞</span>
      <span className="min-w-0 flex-1 text-xs text-ink-2">
        <b className="font-semibold text-ink">{copy.title}</b> · {copy.body}
      </span>
      <span aria-hidden className="text-ink-3">
        →
      </span>
    </button>
  )
}

// ── Diary prompt ────────────────────────────────────────────

export function DiaryPromptCard({ onNavigate }: { onNavigate: Nav }) {
  const { state, today } = useApp()
  return (
    <Card>
      <p className="text-xs font-semibold text-ink-3">
        <span aria-hidden>📔 </span>
        {DIARY_NAME[state.stage]} · 오늘의 질문
      </p>
      <p className="mt-1.5 text-[15px] font-semibold leading-snug text-ink">“{promptFor(state.stage, today)}”</p>
      <Button variant="secondary" full className="mt-3" onClick={() => onNavigate('diary')}>
        기록하기
      </Button>
    </Card>
  )
}

// ── See a doctor (supportive) ───────────────────────────────

export function DoctorCard() {
  const { state, today } = useApp()
  const advice = doctorAdvice(state, today)
  const program = programById('fertility-check')
  if (!advice) return null
  const lines: string[] = []
  if (advice.reasons.includes('age')) lines.push('40세 이상이라면 준비를 시작하면서 바로 상담받아 보길 권해요.')
  if (advice.reasons.includes('months')) {
    lines.push(
      `함께 준비한 지 ${advice.months}개월이 지났어요. ${advice.threshold === 6 ? '35세 이상은 6개월' : '12개월'}이 지나면 두 사람 모두 검사를 권해요.`,
    )
  }
  if (advice.reasons.includes('irregular')) {
    lines.push(
      advice.irregularBy === 'variation'
        ? '최근 주기 길이 차이가 큰 편이에요. 주기가 불규칙하면 조금 일찍 상담받는 게 좋아요.'
        : '주기가 짧거나 긴 편이에요. 이럴 땐 조금 일찍 상담받는 게 좋아요.',
    )
  }
  return (
    <Card>
      <p className="text-xs font-semibold text-brand-ink">
        <span aria-hidden>🩺 </span>함께 확인해 봐요
      </p>
      <h3 className="mt-1 text-base font-bold leading-snug text-ink">혼자 고민하지 말고 두 사람 모두 검사를 받아 보세요</h3>
      <ul className="mt-2 space-y-1 text-sm leading-relaxed text-ink-2">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-ink-2">누구의 탓도 아니에요. 함께 확인하면 마음이 한결 가벼워져요.</p>
      {program ? (
        <div className="mt-3 rounded-xl bg-surface-2 p-3">
          <p className="text-sm font-semibold text-ink">{program.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{program.benefit}</p>
          <ExternalLink href={program.url}>{program.urlLabel}에서 신청하기</ExternalLink>
        </div>
      ) : null}
      <Disclaimer>기준: 미국생식의학회(ASRM 2023) · 영국 NICE(2026). 진단이 아닌 안내예요.</Disclaimer>
    </Card>
  )
}

// ── Public support tips (collapsible) ───────────────────────

export function SupportTips() {
  const programs = [programById('folic-acid'), programById('fertility-check')].filter((p): p is Program => !!p)
  if (programs.length === 0) return null
  return (
    <details className="group rounded-xl2 border border-line bg-surface shadow-card">
      <summary
        className={cx(
          'flex min-h-[52px] cursor-pointer list-none items-center gap-2 rounded-xl2 px-4 text-sm font-semibold text-ink',
          '[&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand',
        )}
      >
        <span aria-hidden>💡</span>
        <span className="flex-1">보건소 무료 엽산제·가임력 검사 지원</span>
        <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4">
        {programs.map((p) => (
          <div key={p.id} className="rounded-xl bg-surface-2 p-3">
            <p className="text-sm font-semibold text-ink">{p.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-2">{p.benefit}</p>
            <dl className="mt-1.5 space-y-0.5 text-[11px] leading-relaxed text-ink-3">
              <div>
                <dt className="inline font-semibold">대상 </dt>
                <dd className="inline">{p.who}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">신청 </dt>
                <dd className="inline">{p.how}</dd>
              </div>
              {p.deadline ? (
                <div>
                  <dt className="inline font-semibold">기한 </dt>
                  <dd className="inline">{p.deadline}</dd>
                </div>
              ) : null}
            </dl>
            <ExternalLink href={p.url}>{p.urlLabel}</ExternalLink>
          </div>
        ))}
        <p className="text-[11px] leading-relaxed text-ink-3">
          지원 내용은 지역·연도마다 달라요. {PROGRAMS_CHECKED_AT} 기준이니 신청 전에 공식 페이지에서 확인해 주세요.
        </p>
      </div>
    </details>
  )
}
