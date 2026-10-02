'use client'

import { Button, Card, SectionTitle, cx, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { HAPPY_BIRTH } from '@/lib/content/baby'
import { PROGRAMS_CHECKED_AT, programsFor } from '@/lib/content/programs'
import { formatKo, parts } from '@/lib/dates'
import { claimAppliedAt, claimDeadline, programDeadline, toggleClaimApplied } from '@/lib/logic/babyView'
import { useApp } from '@/lib/store'
import type { Baby } from '@/lib/types'
import { ExternalLink, TickButton, primaryLinkClass } from './bits'

// 검진·예방접종 have their own sections above.
const OWN_SECTION = new Set(['infant-checkup', 'vaccination'])

/**
 * Warning-tone card while the "apply within 60 days of birth" window is open.
 * Either partner can mark it as applied, which hides it on both phones.
 */
export function ClaimDeadlineCard({ baby }: { baby: Baby }) {
  const { state, update, today, partner } = useApp()
  const toast = useToast()
  const birth = baby.birthDate
  const claim = claimDeadline(birth, today)
  if (!claim || claimAppliedAt(state, birth)) return null

  const markApplied = () => {
    update((s) => (claimAppliedAt(s, birth) ? s : toggleClaimApplied(s, birth, today)))
    toast.show(`신청 완료로 표시했어요 · ${partner.name}님도 볼 수 있어요`)
  }

  return (
    <Card tone="warn">
      <p className="flex items-start justify-between gap-2">
        <span className="text-sm font-bold text-ink">
          <span aria-hidden className="mr-1">
            ⏰
          </span>
          출생 후 60일 안에 신청해야 출생월부터 받아요
        </span>
        <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-xs font-bold tabular-nums text-ink">
          {claim.d}
        </span>
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
        부모급여·아동수당이 해당돼요. {formatKo(claim.deadline)}까지 {HAPPY_BIRTH.title}로 출생신고와 함께 한 번에
        신청할 수 있어요. 이미 신청했다면 괜찮아요.
      </p>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <ExternalLink href={HAPPY_BIRTH.url} className={primaryLinkClass} ariaLabel="정부24 행복출산에서 신청하기 (새 창)">
          신청하러 가기
        </ExternalLink>
        <Button variant="secondary" onClick={markApplied}>
          신청했어요
        </Button>
      </div>
    </Card>
  )
}

export default function SupportCards({ baby }: { baby: Baby }) {
  const { state, update, today } = useApp()
  const birth = baby.birthDate
  const appliedAt = claimAppliedAt(state, birth)
  const programs = programsFor('parenting').filter((p) => !OWN_SECTION.has(p.id))
  const checked = parts(PROGRAMS_CHECKED_AT)

  return (
    <section>
      <SectionTitle sub={`${checked.year}년 ${checked.month}월 기준 · 금액과 기준은 바뀔 수 있어요`}>지원 제도</SectionTitle>

      <Card tone="muted" className="py-3">
        <p className="text-sm font-bold text-ink">{HAPPY_BIRTH.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{HAPPY_BIRTH.body}</p>
        <div className="flex items-center justify-between gap-2">
          <ExternalLink href={HAPPY_BIRTH.url}>정부24에서 보기</ExternalLink>
          <div className="-mr-2 flex items-center">
            <span className="text-xs text-ink-2">
              {appliedAt ? `${formatKo(appliedAt, { weekday: false })} 신청 완료` : '우리 신청했어요'}
            </span>
            <TickButton
              checked={!!appliedAt}
              onClick={() => update((s) => toggleClaimApplied(s, birth, today))}
              label="행복출산으로 신청했어요"
            />
          </div>
        </div>
      </Card>

      <ul className="mt-2 grid gap-2">
        {programs.map((p) => (
          <Card as="li" key={p.id} className="py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 pt-0.5 text-sm font-bold text-ink">{p.title}</p>
              <ExternalLink
                href={p.url}
                ariaLabel={`${p.title} — ${p.urlLabel}에서 보기 (새 창)`}
                className="-mr-2 -mt-2.5 inline-flex h-11 shrink-0 items-center px-2 text-xs font-semibold text-brand-ink underline-offset-2 hover:underline"
              >
                {p.urlLabel}
              </ExternalLink>
            </div>
            <p className="text-sm leading-relaxed text-ink-2">{p.benefit}</p>
            {p.deadline ? <DeadlineChip text={p.deadline} {...programDeadline(p.id, birth, today, !!appliedAt)} /> : null}
            <details className="group">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center text-xs font-medium text-ink-3 [&::-webkit-details-marker]:hidden">
                누가, 어떻게 신청해요?
                <Icon name="chev" className="ml-1 h-4 w-4 transition-transform group-open:rotate-180" strokeWidth={2.2} />
              </summary>
              <dl className="space-y-1 pb-1 text-xs leading-relaxed text-ink-2">
                <div>
                  <dt className="inline font-semibold text-ink">대상 </dt>
                  <dd className="inline">{p.who}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-ink">신청 </dt>
                  <dd className="inline">{p.how}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-ink">시행 </dt>
                  <dd className="inline">{p.effective}</dd>
                </div>
              </dl>
            </details>
          </Card>
        ))}
      </ul>
      <p className="mt-2 px-1 text-[11px] leading-relaxed text-ink-3">
        지역마다 추가 지원이 있을 수 있어요. 주소지 주민센터나 시·군·구 누리집도 확인해 보세요.
      </p>
    </section>
  )
}

/** Deadline emphasized while it applies to this baby; muted once it has passed or is done. */
function DeadlineChip({ text, active, d, done }: { text: string; active: boolean; d?: string; done?: boolean }) {
  return (
    <p
      className={cx(
        'mt-1.5 inline-flex flex-wrap items-center gap-x-1.5 rounded-lg px-2 py-1 text-[11px]',
        active ? 'bg-warn-soft font-semibold text-ink' : done ? 'bg-ok-soft text-ink-2' : 'bg-surface-2 text-ink-3',
      )}
    >
      <span>
        {active ? (
          <span aria-hidden className="mr-1">
            ⏰
          </span>
        ) : null}
        {text}
        {!active && !done ? <span className="sr-only"> (기간이 지났어요)</span> : null}
      </span>
      {d ? <span className="rounded-full bg-surface px-1.5 font-bold tabular-nums">{d}</span> : null}
      {done ? (
        <span className="inline-flex items-center gap-0.5 font-semibold">
          <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.6} />
          신청했어요
        </span>
      ) : null}
    </p>
  )
}
