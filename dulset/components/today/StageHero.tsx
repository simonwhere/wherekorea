'use client'

import { useCallback, useState } from 'react'
import type { TabKey } from '@/components/AppShell'
import { Button, Card, cx, useToast } from '@/components/ui'
import { dLabel, formatKo } from '@/lib/dates'
import { babyAge, nextKoreanDay } from '@/lib/logic/baby'
import { ageAt } from '@/lib/logic/babyView'
import { LONG_LATE_DAYS, addPeriod, fertilityStatus, type FertilityStatus } from '@/lib/logic/cycle'
import { QUIET_DAYS_AFTER_END, dueDate, formatGA, gestationalAge } from '@/lib/logic/pregnancy'
import { TRIMESTER_LABEL, fertilityVoice, type FertilityVoice } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import { Badge, LinkButton, ProgressBar } from './bits'
import PregnancyConfirmSheet from './PregnancyConfirmSheet'
import { lowPressureFor } from '@/lib/logic/prefs'
import { settingsFor } from '@/lib/logic/prefs'

type Nav = (tab: TabKey) => void

export default function StageHero({ onNavigate }: { onNavigate: Nav }) {
  const { state } = useApp()
  if (state.stage === 'pregnant') return <PregnantHero onNavigate={onNavigate} />
  if (state.stage === 'parenting') return <ParentingHero onNavigate={onNavigate} />
  return <PreparingHero onNavigate={onNavigate} />
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

/** "It's an estimate" line under any predicted date. Calm mode drops the LH tip (no timing talk). */
function CycleDisclaimer({ onNavigate, calm = false }: { onNavigate: Nav; calm?: boolean }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2 border-t border-line/70 pt-1">
      <p className="text-[11px] leading-snug text-ink-3">
        {calm ? '달력 예측은 예상치예요' : '달력 예측은 예상치예요 · LH 테스트로 더 정확하게'}
      </p>
      <LinkButton onClick={() => onNavigate('cycle')} className="shrink-0">
        달력 →
      </LinkButton>
    </div>
  )
}

// ── Preparing ───────────────────────────────────────────────

function PreparingHero({ onNavigate }: { onNavigate: Nav }) {
  const { state, update, today, me, cycleOwner } = useApp()
  const toast = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Stable, so the Sheet's open effect doesn't re-run (and refocus) on every state change.
  const closeConfirm = useCallback(() => setConfirmOpen(false), [])
  const isOwner = me.id === cycleOwner.id
  const voice = fertilityVoice(settingsFor(state.settings, me.id), me.id, isOwner)
  const status = fertilityStatus(state, today)
  const owner = cycleOwner.name

  const logPeriodToday = () => {
    update((s) => addPeriod(s, today))
    toast.show('오늘을 생리 시작일로 기록했어요. 다음 예측에 반영할게요')
  }
  const pregnantButton = (variant: 'primary' | 'secondary' | 'ghost' = 'primary') => (
    <Button variant={variant} onClick={() => setConfirmOpen(true)} className="flex-1">
      임신했어요! 🎉
    </Button>
  )

  const content = (() => {
    // After a pregnancy ended (and before a new period is logged) everyone gets the
    // same gentle card: no late-period / pregnancy-test talk, no "임신했어요 🎉".
    if (status.kind === 'after-pregnancy') {
      const quiet = status.daysSince < QUIET_DAYS_AFTER_END
      return isOwner ? (
        <HeroCard
          tone="brand"
          eyebrow={quiet ? '천천히 괜찮아요' : '기록 확인'}
          title={quiet ? '몸과 마음을 먼저 챙겨요' : '최근 생리 기록이 없어요'}
          body="생리가 다시 시작되면 달력에 기록해 주세요. 그때부터 다시 예상해 드릴게요."
        >
          <div className="mt-3 flex gap-2">
            <Button variant={quiet ? 'secondary' : 'primary'} onClick={() => onNavigate('cycle')} className="flex-1">
              달력에 기록하기
            </Button>
            {quiet ? null : pregnantButton('ghost')}
          </div>
        </HeroCard>
      ) : (
        <HeroCard
          tone="brand"
          eyebrow="함께예요"
          title="서로를 천천히 챙겨요"
          body={`${owner}님이 생리 시작일을 기록하면 다시 알려 드릴게요.`}
        />
      )
    }

    // Calm mode: no fertile wording. The cycle owner still sees her own period/late/no-data.
    const ownerOnlyKinds: FertilityStatus['kind'][] = ['no-data', 'period', 'late']
    if (voice === 'calm' && !(isOwner && ownerOnlyKinds.includes(status.kind))) {
      return <CalmCard lowPressure={lowPressureFor(state.settings, me.id)} isOwner={isOwner} onNavigate={onNavigate} />
    }

    switch (status.kind) {
      case 'no-data':
        return isOwner ? (
          <HeroCard
            tone="brand"
            eyebrow="시작해 볼까요"
            title="마지막 생리 시작일을 알려 주세요"
            body={
              voice === 'calm'
                ? '기록해 두면 생리 예정일과 임신 주수 계산에 도움이 돼요.'
                : '하나만 기록해도 예정일과 우리의 주간을 예상해 드려요.'
            }
          >
            <Button full className="mt-3" onClick={() => onNavigate('cycle')}>
              달력에 기록하기
            </Button>
          </HeroCard>
        ) : (
          <HeroCard
            tone="brand"
            eyebrow="함께 준비해요"
            title={`${owner}님이 주기를 기록하면 함께 알려 드릴게요`}
            body="알림을 어떻게 받을지는 설정에서 각자 고를 수 있어요."
          />
        )

      case 'period':
        return (
          <HeroCard
            eyebrow={isOwner ? '나를 돌보는 날' : `${owner}님의 하루`}
            title={
              isOwner
                ? `생리 ${status.cycleDay}일째`
                : voice === 'explicit'
                  ? `${owner}님 생리 ${status.cycleDay}일째예요`
                  : `${owner}님 컨디션을 챙겨 주세요`
            }
            badge={<Badge tone="period">생리 중</Badge>}
            body={
              isOwner
                ? voice === 'explicit' && status.nextFertileStart
                  ? `따뜻하게 쉬어요. 다음 예상 가임기는 ${formatKo(status.nextFertileStart)}부터예요.`
                  : voice === 'explicit' && status.fertileEnd
                    ? `따뜻하게 쉬어요. 주기가 짧은 편이라 예상 가임기(${formatKo(status.fertileEnd, { weekday: false })}까지)와 겹쳐요.`
                    : '따뜻하게 쉬어요. 무리하지 않아도 괜찮아요.'
                : voice === 'explicit'
                  ? '따뜻한 차 한 잔, 컨디션을 챙겨 주세요.'
                  : '요즘 몸이 무거울 수 있어요. 따뜻한 말 한마디가 힘이 돼요.'
            }
          >
            {voice !== 'calm' ? <CycleDisclaimer onNavigate={onNavigate} /> : null}
          </HeroCard>
        )

      case 'before-fertile':
        return voice === 'explicit' ? (
          <HeroCard
            eyebrow={isOwner ? `주기 ${status.cycleDay}일째` : `${owner}님의 예상 가임기`}
            title={`가임기 D-${status.daysUntil}`}
            body={`${formatKo(status.fertileStart)}부터 예상돼요.`}
          >
            <CycleDisclaimer onNavigate={onNavigate} />
          </HeroCard>
        ) : (
          // Soft wording: no countdown number, just "soon" or roughly when.
          <HeroCard
            tone="brand"
            eyebrow="다가오는 우리의 주간"
            title={
              status.daysUntil <= 3 ? '곧 우리의 주간이에요' : `${formatKo(status.fertileStart, { weekday: false })} 무렵부터예요`
            }
            body="둘만의 시간을 미리 계획해 볼까요?"
          >
            <CycleDisclaimer onNavigate={onNavigate} />
          </HeroCard>
        )

      case 'fertile':
        return voice === 'explicit' ? (
          <HeroCard
            tone="fert"
            eyebrow={`${isOwner ? '' : `${owner}님 · `}${formatKo(status.fertileEnd, { weekday: false })}까지 (예상)`}
            title="가임기 (예상)"
            badge={status.peak ? <Badge tone="fert">가능성 높은 날</Badge> : null}
            body={
              status.isOvulation
                ? '오늘이 예상 배란일이에요. 이 기간엔 하루나 이틀에 한 번이면 충분해요.'
                : '이 기간엔 하루나 이틀에 한 번이면 충분해요. 부담은 내려놓아요.'
            }
          >
            <CycleDisclaimer onNavigate={onNavigate} />
          </HeroCard>
        ) : (
          <HeroCard
            tone="fert"
            eyebrow="둘만의 시간"
            title="이번 주는 우리의 주간 💞"
            body="둘만의 시간을 편하게 즐겨요."
          >
            <CycleDisclaimer onNavigate={onNavigate} />
          </HeroCard>
        )

      case 'after-fertile':
        // The owner's own next period isn't fertile-day wording, so soft owners see it too.
        if (isOwner) {
          return (
            <HeroCard
              eyebrow={`주기 ${status.cycleDay}일째`}
              title={status.daysUntilPeriod <= 0 ? '오늘이 생리 예정일이에요' : `생리 예정일 D-${status.daysUntilPeriod}`}
              body={
                status.daysUntilPeriod <= 0
                  ? '예상일이라 하루이틀 달라질 수 있어요. 시작하면 달력에 기록해 주세요.'
                  : `${formatKo(status.nextPeriod)} 예정 (예상). 시작하면 달력에 기록해 주세요.`
              }
            >
              <CycleDisclaimer onNavigate={onNavigate} />
            </HeroCard>
          )
        }
        return (
          <HeroCard
            eyebrow="이번 주의 우리"
            title={voice === 'explicit' ? '편안한 한 주예요' : '평온한 한 주예요'}
            body={
              voice === 'explicit'
                ? `${owner}님 생리 예정일은 ${formatKo(status.nextPeriod)} 무렵이에요 (예상).`
                : '서로의 하루를 챙겨 주세요. 다음 우리의 주간이 오면 알려 드릴게요.'
            }
          >
            <CycleDisclaimer onNavigate={onNavigate} />
          </HeroCard>
        )

      case 'late':
        // Same threshold as the 달력 headline and the late-period notice.
        if (status.daysLate > LONG_LATE_DAYS) {
          return isOwner ? (
            <HeroCard
              tone="brand"
              eyebrow="기록 확인"
              title="최근 기록이 없어요"
              body="생리 시작일을 기록해 주세요. 예측이 다시 정확해져요."
            >
              <div className="mt-3 flex gap-2">
                <Button onClick={() => onNavigate('cycle')} className="flex-1">
                  달력에 기록하기
                </Button>
                {pregnantButton('ghost')}
              </div>
            </HeroCard>
          ) : (
            <HeroCard
              tone="brand"
              eyebrow="함께 준비해요"
              title={`${owner}님이 최근 주기를 기록하면 다시 알려 드릴게요`}
            />
          )
        }
        return isOwner ? (
          <HeroCard
            tone="brand"
            eyebrow={`예정일 ${formatKo(status.expected)} (예상)`}
            title={`예정일이 ${status.daysLate}일 지났어요`}
            body="임신 테스트를 해 볼까요? 생리가 시작됐다면 기록해 주세요."
          >
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={logPeriodToday} className="flex-1">
                생리 시작 기록
              </Button>
              {pregnantButton()}
            </div>
            <CycleDisclaimer onNavigate={onNavigate} calm={voice === 'calm'} />
          </HeroCard>
        ) : (
          <HeroCard
            tone="brand"
            eyebrow="함께예요"
            title={
              voice === 'explicit'
                ? `${owner}님 생리 예정일이 ${status.daysLate}일 지났어요`
                : `요즘 ${owner}님 컨디션은 어때요?`
            }
            body={
              voice === 'explicit'
                ? '결과가 어떻든 두 사람은 한 팀이에요. 테스트는 편할 때 함께 해 봐요.'
                : '생리 예정일이 조금 지났어요 (예상). 편하게 이야기 나눠 봐요.'
            }
          >
            {/* Soft wording means no big "pregnant?" prompt; the explicit partner gets a quiet one. */}
            {voice === 'explicit' ? <div className="mt-3 flex">{pregnantButton('secondary')}</div> : null}
            <CycleDisclaimer onNavigate={onNavigate} />
          </HeroCard>
        )
    }
  })()

  return (
    <>
      {content}
      <PregnancyConfirmSheet open={confirmOpen} onClose={closeConfirm} />
    </>
  )
}

function CalmCard({ lowPressure, isOwner, onNavigate }: { lowPressure: boolean; isOwner: boolean; onNavigate: Nav }) {
  return lowPressure ? (
    <HeroCard
      tone="brand"
      eyebrow="우리의 속도로"
      title="날짜는 신경 쓰지 않아도 괜찮아요"
      body="주기 내내 2~3일에 한 번이면 충분해요."
    >
      <p className="mt-2 text-[11px] text-ink-3">영국 NICE 지침(NG257, 2026)의 권고예요.</p>
    </HeroCard>
  ) : (
    <HeroCard
      tone="brand"
      eyebrow="오늘의 우리"
      title="오늘도 둘이 함께해요 💞"
      body={
        // 'off' only silences the owner's alerts — her calendar still shows the estimates.
        isOwner
          ? '알림 방식을 ‘받지 않을래요’로 골라서 가임기 알림만 쉬고 있어요. 달력에서 예상은 볼 수 있어요.'
          : '알림 방식을 ‘받지 않을래요’로 골라서 날짜 예측은 쉬고 있어요.'
      }
    >
      <LinkButton onClick={() => onNavigate('settings')}>설정에서 바꾸기 →</LinkButton>
    </HeroCard>
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
