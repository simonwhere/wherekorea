'use client'

// 설정 › 공유 범위 — what the partner sees of the cycle. Only the person whose
// cycle it is can change it; the partner sees the current choice, read-only.

import { useEffect, useId, useRef, useState } from 'react'
import { Card, cx, useToast } from '@/components/ui'
import { SHARE_OPTIONS, ShareConsentNotice, type ShareChoice } from '@/components/onboarding/consentCopy'
import { setShareCycleDetails } from '@/lib/logic/partnerTrack'
import { canLogCycle, canSeeCycleDetails } from '@/lib/logic/prefs'
import { useApp } from '@/lib/store'
import { ConfirmActions, Pill, RadioCard, SettingsSection } from './bits'

export default function SharingSection() {
  const { state, viewer, cycleOwner, partner } = useApp()
  const isOwner = canLogCycle(state, viewer)
  return (
    <SettingsSection
      title="공유 범위"
      sub={isOwner ? `${partner.name}님에게 보여 줄 것 · ${cycleOwner.name}님만 바꿀 수 있어요` : `${cycleOwner.name}님이 정해요`}
    >
      {isOwner ? <OwnerChoice /> : <PartnerView />}
    </SettingsSection>
  )
}

function OwnerChoice() {
  const { state, update, viewer, partner } = useApp()
  const toast = useToast()
  const headingId = useId()
  const group = useId()
  const current: ShareChoice = state.settings.shareCycleDetails === true ? 'details' : 'week'
  // Widening is a separate consent (who gets what, for how long): the notice is
  // shown and confirmed here first. Narrowing back applies at once.
  const [asking, setAsking] = useState(false)
  const askRef = useRef<HTMLHeadingElement>(null)
  // Changed elsewhere (the other tab): a pending question no longer applies.
  useEffect(() => setAsking(false), [current])
  useEffect(() => {
    if (asking) askRef.current?.focus()
  }, [asking])

  const apply = (next: ShareChoice) => {
    setAsking(false)
    if (next === current) return
    update((s) => setShareCycleDetails(s, viewer, next === 'details'))
    toast.show(
      next === 'details'
        ? `${partner.name}님에게 자세한 기록까지 보여요`
        : `${partner.name}님에게는 ‘우리의 주간’만 보여요`,
    )
  }
  const choose = (next: ShareChoice) => {
    if (next === 'details' && current !== 'details') setAsking(true)
    else apply(next)
  }
  const shown: ShareChoice = asking ? 'details' : current

  return (
    <Card>
      <h3 id={headingId} className="text-sm font-bold text-ink">
        {partner.name}님 화면에 보이는 것
      </h3>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
        ‘우리의 주간’, 체크 현황, 병원 일정은 늘 함께 봐요. 생리일과 테스트 결과는 여기서 정해요.
      </p>
      <div role="radiogroup" aria-labelledby={headingId} className="mt-3 grid gap-2">
        {SHARE_OPTIONS.map((o) => {
          const on = o.value === shown
          return (
            <RadioCard key={o.value} name={group} checked={on} onSelect={() => choose(o.value)} className="min-h-[52px] gap-3 px-3 py-2 text-left">
              <span
                aria-hidden
                className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-brand' : 'border-line')}
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
            파트너 공유에 동의할까요?
          </h4>
          <ShareConsentNotice partner={partner.name} />
          <SharePrototypeNote />
          <ConfirmActions
            confirmLabel="동의하고 보여 줄게요"
            onConfirm={() => apply('details')}
            onCancel={() => setAsking(false)}
          />
        </div>
      ) : (
        <details className="group mt-2">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center text-xs font-medium text-brand-ink [&::-webkit-details-marker]:hidden">
            자세한 기록을 공유하면
            <span aria-hidden className="ml-1 transition-transform group-open:rotate-180">
              ▾
            </span>
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
      지금은 프로토타입이라 한 기기 안에서만 보여요. 실제 연결 뒤에도 원본은 기록한 사람 기기에 두고, 연결을 끊으면 공유가 바로
      멈춰요.
    </p>
  )
}

function PartnerView() {
  const { state, viewer, cycleOwner } = useApp()
  const details = canSeeCycleDetails(state, viewer)
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm text-ink">
          {details ? '생리일, 배테기·임테기 결과까지 함께 봐요.' : '‘우리의 주간’과 부드러운 안내만 함께 봐요.'}
        </p>
        <Pill tone={details ? 'brand' : 'muted'}>{details ? '자세한 기록까지' : '우리의 주간만'}</Pill>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-3">
        {cycleOwner.name}님의 주기 기록이라 {cycleOwner.name}님이 정해요. 기록도 {cycleOwner.name}님만 남길 수 있어요.
      </p>
    </Card>
  )
}
