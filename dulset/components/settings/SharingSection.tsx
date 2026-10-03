'use client'

// 설정 › 공유 범위 — what the partner sees of the cycle, in three levels (N23:
// 날짜 없음 / 우리의 주간 / 자세히 — settings.shareLevel). Only the person whose
// cycle it is can change it; the partner sees the current choice, read-only.

import { useEffect, useId, useRef, useState } from 'react'
import { Button, Card, cx, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { SHARE_OPTIONS, ShareConsentNotice, shareOption, widens, type ShareChoice } from '@/components/onboarding/consentCopy'
import { formatKo } from '@/lib/dates'
import { giveIntimacyConsent, hasIntimacyConsent, intimacyDays, intimacyHolder, revokeIntimacy } from '@/lib/logic/intimacy'
import { canLogCycle, setShareLevel, shareLevelOf } from '@/lib/logic/prefs'
import { openLog } from '@/lib/logLauncher'
import { useApp } from '@/lib/store'
import { ConfirmActions, Pill, RadioCard, SettingsSection } from './bits'

export default function SharingSection() {
  const { state, viewer, cycleOwner, partner } = useApp()
  const isOwner = canLogCycle(state, viewer)
  return (
    <SettingsSection
      id="share"
      title="공유 범위"
      sub={isOwner ? `${partner.name}님에게 보여 줄 것 · ${cycleOwner.name}님만 바꿀 수 있어요` : `${cycleOwner.name}님이 정해요`}
    >
      {isOwner ? (
        <div className="grid gap-2">
          <OwnerChoice />
          {/* The partner's screen never mentions this record exists (PartnerView says nothing). */}
          <IntimacyCard />
        </div>
      ) : (
        <PartnerView />
      )}
    </SettingsSection>
  )
}

// ── 관계한 날 기록 (나만 보기) — a separate consent, owner only (Next B) ──

/** What the record promises; shown before the consent and again while it is on. */
const INTIMACY_PROMISES: ReadonlyArray<string> = [
  '이 폰에만 저장돼요 (연결 뒤에도 서버에 올라가지 않아요)',
  '주기를 기록하는 사람만 남기고, 그 사람만 봐요',
  '상대 화면·알림·우리 탭 어디에도 나오지 않아요',
  '병원 요약, 내보내기, 공유 상태에 들어가지 않아요',
  '아무것도 예상하거나 권하지 않아요 — 그냥 기록이에요',
  '한 번에 모두 지울 수 있어요',
]

/**
 * '관계한 날 기록 (나만 보기)': a consent-first card. The record exists only
 * after the cycle owner says yes here (lib/logic/intimacy.ts giveIntimacyConsent);
 * then the "+ 기록" sheet gets a 관계 chip for them alone, and one tap here
 * deletes the consent and every day with it (revokeIntimacy).
 */
function IntimacyCard() {
  const { state, update, today, viewer, partner } = useApp()
  const toast = useToast()
  const on = hasIntimacyConsent(state)
  const mine = intimacyHolder(state) === viewer
  const days = mine ? intimacyDays(state, viewer) : []
  const listId = useId()

  const consent = () => {
    update((s) => giveIntimacyConsent(s, viewer, today))
    toast.show('관계한 날 기록을 켰어요 · ‘+ 기록’에 관계 칩이 생겼어요')
  }
  const revoke = () => {
    update(revokeIntimacy)
    toast.show('관계한 날 기록을 모두 지우고 껐어요')
  }

  // A consent that belongs to a previous cycle owner: nothing to add, only to delete.
  if (on && !mine) {
    return (
      <Card>
        <h3 className="text-sm font-bold text-ink">관계한 날 기록 (나만 보기)</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-2">
          예전에 주기를 기록하던 사람의 기록이 남아 있어요. 그 사람만 볼 수 있고, 여기서 한 번에 지울 수 있어요.
        </p>
        <Button full variant="danger" className="mt-3" onClick={revoke}>
          기록 모두 지우고 끄기
        </Button>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <Icon name="lock" className="h-[18px] w-[18px] text-ink-2" />
            <span>
              관계한 날 기록 <span className="font-medium text-ink-3">(나만 보기)</span>
            </span>
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
            {on
              ? `켜 둔 날 ${formatKo(state.intimacy!.consentAt, { year: true, weekday: false })} · 기록 ${days.length}일`
              : '원하면 따로 동의한 뒤에만 켜져요. 기본은 꺼짐이에요.'}
          </p>
        </div>
        <Pill tone={on ? 'brand' : 'muted'}>{on ? '켜짐' : '꺼짐'}</Pill>
      </div>

      <ul id={listId} aria-label="이 기록이 지키는 것" className="mt-3 space-y-1.5">
        {INTIMACY_PROMISES.map((line) => (
          <li key={line} className="flex gap-2 text-xs leading-relaxed text-ink-2">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-ok" strokeWidth={2.4} />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {on ? (
        <>
          <p className="mt-3 text-xs leading-relaxed text-ink-2">
            ‘+ 기록’의 <b className="font-semibold text-ink">관계</b> 칩에서 날짜를 표시해요. {partner.name}님 화면에는 이 설정도, 칩도
            보이지 않아요.
          </p>
          <div className="mt-3 grid gap-2">
            <Button full variant="secondary" onClick={() => openLog({ kind: 'intimacy' })}>
              오늘 기록하기
            </Button>
            <Button full variant="danger" onClick={revoke}>
              기록 모두 지우고 끄기
            </Button>
          </div>
        </>
      ) : (
        <Button full className="mt-3" onClick={consent} ariaLabel="관계한 날 기록에 동의하고 켜기">
          동의하고 켜기
        </Button>
      )}
    </Card>
  )
}

function OwnerChoice() {
  const { state, update, viewer, partner } = useApp()
  const toast = useToast()
  const headingId = useId()
  const group = useId()
  const current: ShareChoice = shareLevelOf(state)
  // Widening is a separate consent (who gets what, for how long): the notice
  // for the level asked for is shown and confirmed here first. Narrowing
  // (towards 날짜 없음) applies at once.
  const [asking, setAsking] = useState<Exclude<ShareChoice, 'none'> | null>(null)
  const askRef = useRef<HTMLHeadingElement>(null)
  // Changed elsewhere (the other tab): a pending question no longer applies.
  useEffect(() => setAsking(null), [current])
  useEffect(() => {
    if (asking) askRef.current?.focus()
  }, [asking])

  const apply = (next: ShareChoice) => {
    setAsking(null)
    if (next === current) return
    update((s) => setShareLevel(s, viewer, next))
    toast.show(
      next === 'details'
        ? `${partner.name}님에게 자세한 기록까지 보여요`
        : next === 'week'
          ? `${partner.name}님에게는 ‘우리의 주간’만 보여요`
          : `${partner.name}님 화면에서 날짜를 모두 뺐어요`,
    )
  }
  const choose = (next: ShareChoice) => {
    if (next !== 'none' && widens(current, next)) setAsking(next)
    else apply(next)
  }
  const shown: ShareChoice = asking ?? current

  return (
    <Card>
      <h3 id={headingId} className="text-sm font-bold text-ink">
        {partner.name}님 화면에 보이는 것
      </h3>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
        체크 현황, 할 일, 신호, 병원 일정은 늘 함께 봐요. 날짜를 얼마나 보여 줄지는 여기서 정해요.
      </p>
      <div role="radiogroup" aria-labelledby={headingId} className="mt-3 grid gap-2">
        {SHARE_OPTIONS.map((o) => {
          const on = o.value === shown
          return (
            <RadioCard
              key={o.value}
              name={group}
              checked={on}
              onSelect={() => choose(o.value)}
              className="min-h-[52px] gap-3 px-3 py-2 text-left"
            >
              <span
                aria-hidden
                className={cx(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                  on ? 'border-brand' : 'border-line',
                )}
              >
                {on ? <span className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{o.label}</span>
                <span className="block text-[11px] leading-relaxed text-ink-3">{o.hint(partner.name)}</span>
              </span>
            </RadioCard>
          )
        })}
      </div>
      {asking ? (
        <div className="mt-3 rounded-xl bg-surface-2 p-3">
          <h4 ref={askRef} tabIndex={-1} className="mb-1.5 text-xs font-bold text-ink outline-none">
            {asking === 'details' ? '자세한 기록 공유에 동의할까요?' : '‘우리의 주간’ 공유에 동의할까요?'}
          </h4>
          <ShareConsentNotice partner={partner.name} level={asking} />
          <SharePrototypeNote />
          <ConfirmActions confirmLabel="동의하고 보여 줄게요" onConfirm={() => apply(asking)} onCancel={() => setAsking(null)} />
        </div>
      ) : (
        <details className="group mt-2">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center text-xs font-medium text-brand-ink [&::-webkit-details-marker]:hidden">
            자세한 기록을 공유하면
            <Icon name="chev" className="ml-1 h-4 w-4 transition-transform group-open:rotate-180" strokeWidth={2.2} />
          </summary>
          <div className="pb-1">
            <ShareConsentNotice partner={partner.name} />
            <SharePrototypeNote />
          </div>
        </details>
      )}
    </Card>
  )
}

function SharePrototypeNote() {
  return (
    <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
      지금은 프로토타입이라 한 기기 안에서만 보여요. 실제 연결 뒤에도 원본은 기록한 사람 기기에 두고, 연결을 끊으면 공유가 바로 멈춰요.
    </p>
  )
}

/** What each level means on the partner's own phone, read-only. */
const PARTNER_LINE: Record<ShareChoice, (owner: string) => string> = {
  none: (o) => `날짜 없이 함께해요. 체크·할 일·신호, 그리고 ${o}님이 알려 준 것만 보여요.`,
  week: () => '‘우리의 주간’과 부드러운 안내만 함께 봐요.',
  details: () => '생리일, 배테기·임테기 결과까지 함께 봐요.',
}

function PartnerView() {
  const { state, cycleOwner } = useApp()
  const level = shareLevelOf(state)
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm text-ink">{PARTNER_LINE[level](cycleOwner.name)}</p>
        <Pill tone={level === 'details' ? 'brand' : 'muted'}>{shareOption(level).short}</Pill>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-3">
        {cycleOwner.name}님의 주기 기록이라 {cycleOwner.name}님이 정해요. 기록도 {cycleOwner.name}님만 남길 수 있어요.
      </p>
    </Card>
  )
}
