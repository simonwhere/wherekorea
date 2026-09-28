'use client'

import type { TabKey } from '@/components/AppShell'
import { Button, Card, cx } from '@/components/ui'
import { dLabel, formatKo } from '@/lib/dates'
import { babyAge, nextKoreanDay } from '@/lib/logic/baby'
import { ageAt } from '@/lib/logic/babyView'
import { dueDate, formatGA, gestationalAge } from '@/lib/logic/pregnancy'
import { TRIMESTER_LABEL } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import { Badge, ProgressBar } from './bits'

type Nav = (tab: TabKey) => void

/**
 * The pregnant / parenting hero. The preparing home is built around the
 * cycle moment instead (components/today/CycleBlock, lib/logic/ttcFlow).
 */
export default function StageHero({ onNavigate }: { onNavigate: Nav }) {
  const { state } = useApp()
  if (state.stage === 'pregnant') return <PregnantHero onNavigate={onNavigate} />
  if (state.stage === 'parenting') return <ParentingHero onNavigate={onNavigate} />
  return null
}

// ── Shared layout ───────────────────────────────────────────

function HeroCard({
  tone = 'default',
  eyebrow,
  title,
  badge,
  body,
  children,
}: {
  tone?: 'default' | 'brand' | 'fert' | 'ok' | 'muted'
  eyebrow?: React.ReactNode
  title: React.ReactNode
  badge?: React.ReactNode
  body?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <Card tone={tone} className="relative">
      {eyebrow ? <p className="text-xs font-semibold text-ink-2">{eyebrow}</p> : null}
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-[22px] font-extrabold leading-tight tracking-tight text-ink">{title}</h2>
        {badge}
      </div>
      {body ? <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{body}</p> : null}
      {children}
    </Card>
  )
}

// ── Pregnant ────────────────────────────────────────────────

function PregnantHero({ onNavigate }: { onNavigate: Nav }) {
  const { state, today } = useApp()
  const p = state.pregnancy
  if (!p) {
    return (
      <HeroCard tone="brand" eyebrow="임신 중" title="임신 정보를 입력해 주세요">
        <Button full className="mt-3" onClick={() => onNavigate('pregnancy')}>
          임신 탭으로
        </Button>
      </HeroCard>
    )
  }
  const ga = gestationalAge(p, today)
  const due = dueDate(p)
  return (
    <HeroCard tone="brand" eyebrow={TRIMESTER_LABEL[ga.trimester]} title={`임신 ${formatGA(ga)}`} badge={<Badge tone="surface">{dLabel(due, today)}</Badge>}>
      <div className="mt-3">
        <ProgressBar value={ga.progress} label="40주 중 진행" track="surface" />
        <div className="mt-1.5 flex justify-between text-[11px] font-medium text-ink-3">
          <span>{ga.weeks}주 / 40주</span>
          <span>예정일 {formatKo(due)}</span>
        </div>
      </div>
      <Button full className="mt-3" onClick={() => onNavigate('pregnancy')}>
        이번 주 정보 보기
      </Button>
    </HeroCard>
  )
}

// ── Parenting ───────────────────────────────────────────────

function ParentingHero({ onNavigate }: { onNavigate: Nav }) {
  const { state, today } = useApp()
  const b = state.baby
  if (!b) {
    return (
      <HeroCard tone="brand" eyebrow="육아 중" title="아기 정보를 입력해 주세요">
        <Button full className="mt-3" onClick={() => onNavigate('baby')}>
          아기 탭으로
        </Button>
      </HeroCard>
    )
  }
  const age = babyAge(b.birthDate, today)
  if (age.days < 0) {
    // Birth date typed ahead of `today` (e.g. a pinned demo date) — don't show "0일째".
    return (
      <HeroCard tone="brand" eyebrow="곧 만나요" title={`${b.name} ${formatKo(b.birthDate)} 태어날 예정`}>
        <Button full className="mt-3" onClick={() => onNavigate('baby')}>
          아기 정보 보기
        </Button>
      </HeroCard>
    )
  }
  const next = nextKoreanDay(b.birthDate, today)
  const isToday = next?.date === today
  return (
    <HeroCard
      tone="brand"
      eyebrow={ageAt(b.birthDate, today)}
      title={
        <>
          {b.name} <span className="whitespace-nowrap">태어난 지 {age.dayOfLife}일째</span>
        </>
      }
    >
      {next ? (
        <div
          className={cx(
            'mt-3 flex items-center justify-between rounded-xl px-3 py-2.5 text-sm',
            isToday ? 'bg-brand text-white' : 'bg-surface text-ink',
          )}
        >
          <span className="font-semibold">{isToday ? `오늘은 ${next.label}이에요 🎉` : `${next.label}까지`}</span>
          {isToday ? null : <span className="font-bold tabular-nums text-brand-ink">{dLabel(next.date, today)}</span>}
        </div>
      ) : null}
      <Button full className="mt-3" onClick={() => onNavigate('baby')}>
        아기 기록 보기
      </Button>
    </HeroCard>
  )
}
