'use client'

// ③ 동의 + 공유 범위: three short facts, what the partner may see (only the
// cycle owner answers, with the same three levels as 설정 › 공유 범위 —
// 날짜 없음 / 우리의 주간 (default) / 자세히, N23), then the general and
// the separate 민감정보 consent — each notice folded under '자세히' so the two
// checkboxes sit on one screen. Copy and the legal notes live in ./consentCopy.

import { cx } from '@/components/ui'
import { Icon, type IconName } from '@/components/ui/icons'
import { draftNames, draftOwner, type OnboardingDraft } from '@/lib/onboardingDraft'
import {
  GeneralConsentNotice,
  SHARE_OPTIONS,
  SensitiveConsentNotice,
  ShareConsentNotice,
  type ShareChoice,
} from './consentCopy'
import { Disclosure } from './parts'

export default function ConsentStep({
  draft,
  patch,
  sensitive,
  onSensitive,
  share,
  onShare,
}: {
  draft: OnboardingDraft
  patch: (p: Partial<OnboardingDraft>) => void
  /** 민감정보 수집·이용 별도 동의. */
  sensitive: boolean
  onSensitive: (next: boolean) => void
  /** What the partner sees (only asked of the cycle owner). */
  share: ShareChoice
  onShare: (next: ShareChoice) => void
}) {
  const names = draftNames(draft)
  const owner = draftOwner(draft)
  const iAmOwner = owner === 'a'
  const partner = names.b
  const points: Array<{ icon: IconName; text: string }> = [
    { icon: 'phone', text: '지금은 이 기기에만 저장해요. 서버가 없고, 동의하기 전에는 아무것도 저장하지 않았어요.' },
    { icon: 'users', text: `체크 현황, 할 일, 신호, 병원 일정은 함께 봐요. 날짜를 얼마나 보여 줄지는 ${names[owner]}님이 정해요.` },
    { icon: 'trash', text: '기록은 직접 지울 때까지만 보관해요. 설정에서 한 번에 지울 수 있어요.' },
  ]

  return (
    <div className="space-y-4">
      <ul className="space-y-2 rounded-xl2 border border-line bg-surface p-3.5 shadow-card">
        {points.map((p) => (
          <li key={p.icon} className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-2">
            <Icon name={p.icon} className="mt-px h-[18px] w-[18px] shrink-0 text-ink-2" />
            <span>{p.text}</span>
          </li>
        ))}
      </ul>

      {iAmOwner ? (
        <fieldset className="rounded-xl2 border border-line bg-surface p-4 shadow-card">
          <legend className="float-left mb-1 w-full text-sm font-bold text-ink">{partner}님에게 보여 줄 것</legend>
          <p className="mb-3 text-xs leading-relaxed text-ink-3">내 주기 기록이라 내가 정해요. 설정 › 공유 범위에서 언제든 바꿀 수 있어요.</p>
          <div className="grid gap-2">
            {SHARE_OPTIONS.map((o) => {
              const on = share === o.value
              return (
                <label
                  key={o.value}
                  className={cx(
                    'relative flex min-h-[52px] cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                    on ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:bg-surface-2',
                  )}
                >
                  <input
                    type="radio"
                    name="share-cycle"
                    checked={on}
                    onChange={() => onShare(o.value)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{o.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">{o.hint(partner)}</span>
                  </span>
                </label>
              )
            })}
          </div>
          {share === 'details' ? (
            <div className="mt-3 rounded-xl bg-surface-2 p-3">
              <p className="mb-1.5 text-xs font-bold text-ink">파트너 공유 동의 (선택)</p>
              <ShareConsentNotice partner={partner} level="details" />
            </div>
          ) : share === 'week' ? (
            <Disclosure className="mt-1" label="‘우리의 주간’을 보여 주면" closeLabel="접기">
              <ShareConsentNotice partner={partner} level="week" />
            </Disclosure>
          ) : null}
        </fieldset>
      ) : (
        <div className="rounded-xl2 border border-line bg-surface p-4 shadow-card">
          <p className="text-sm font-bold text-ink">자세한 주기 기록은 {names[owner]}님이 정해요</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            처음에는 ‘우리의 주간’만 함께 봐요. 날짜를 얼마나 보여 줄지(날짜 없음 · 우리의 주간 · 자세히)는 {names[owner]}님이 직접 골라요.
          </p>
        </div>
      )}

      <ConsentBox
        checked={draft.consent}
        onChange={(consent) => patch({ consent })}
        title="개인정보 수집·이용에 동의해요"
        summary="이름·역할·만난 날 같은 기본 정보를 이 기기에만 보관해요."
        notice={<GeneralConsentNotice />}
      />
      <ConsentBox
        checked={sensitive}
        onChange={onSensitive}
        title="민감정보(건강) 수집·이용에 따로 동의해요"
        summary="생리일·주기, 배테기·임테기 결과, 체크 기록을 이 기기에만 보관해요."
        notice={<SensitiveConsentNotice />}
      />

      <p className="px-1 text-[11px] leading-relaxed text-ink-3">
        생리·가임기·테스트 결과는 개인정보보호법 제23조의 민감정보라, 다른 동의와 따로 받아요. 가임기는 참고용 예상이라 피임이나
        진단 목적으로는 쓰지 말아 주세요.
      </p>
    </div>
  )
}

function ConsentBox({
  checked,
  onChange,
  title,
  summary,
  notice,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  title: string
  summary: string
  notice: React.ReactNode
}) {
  return (
    <div className={cx('rounded-xl2 border p-4 transition-colors', checked ? 'border-brand bg-brand-soft' : 'border-line bg-surface')}>
      <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-snug text-ink">
            {title} <span className="font-bold text-brand-ink">(필수)</span>
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">{summary}</span>
        </span>
      </label>
      <Disclosure className="pl-8" label="자세히" closeLabel="접기">
        {notice}
      </Disclosure>
    </div>
  )
}
