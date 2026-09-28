'use client'

// 개인정보: general consent, a separate 민감정보 (health) consent, and — for the
// person whose cycle it is — what the partner may see (the partner-sharing
// consent). Copy and the legal notes live in ./consentCopy.

import { cx } from '@/components/ui'
import { draftNames, draftOwner, type OnboardingDraft } from '@/lib/demo'
import {
  GeneralConsentNotice,
  SHARE_OPTIONS,
  SensitiveConsentNotice,
  ShareConsentNotice,
  type ShareChoice,
} from './consentCopy'

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
  const points = [
    {
      emoji: '📱',
      title: '지금은 이 기기에만 저장해요',
      body: '프로토타입이라 서버가 없어요. 기록은 이 브라우저 밖으로 나가지 않아요. 지금까지 입력한 내용도 동의하기 전에는 저장하지 않았어요.',
    },
    {
      emoji: '👫',
      title: `연결하면 ${partner}님과 이만큼 함께 봐요`,
      body: `‘우리의 주간’, 체크 현황, 병원 일정, 우리 기록은 함께 봐요. 생리일·배테기·임테기 같은 자세한 기록은 ${names[owner]}님이 허용할 때만 보여요.`,
    },
    {
      emoji: '🗑️',
      title: '언제든 지울 수 있어요',
      body: '기록은 직접 지울 때까지만 보관해요. 설정에서 모든 기록을 한 번에 삭제할 수 있어요.',
    },
  ]

  return (
    <div className="space-y-4">
      <ul className="space-y-2.5">
        {points.map((p) => (
          <li key={p.emoji} className="flex items-start gap-3 rounded-xl2 border border-line bg-surface p-3.5 shadow-card">
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-lg">
              {p.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">{p.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{p.body}</p>
            </div>
          </li>
        ))}
      </ul>

      {iAmOwner ? (
        <fieldset className="rounded-xl2 border border-line bg-surface p-4 shadow-card">
          <legend className="float-left mb-1 w-full text-sm font-bold text-ink">{partner}님에게 보여 줄 것</legend>
          <p className="mb-3 text-xs leading-relaxed text-ink-3">
            내 주기 기록이라 내가 정해요. 설정 › 공유 범위에서 언제든 바꿀 수 있어요.
          </p>
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
              <ShareConsentNotice partner={partner} />
            </div>
          ) : null}
        </fieldset>
      ) : (
        <div className="rounded-xl2 border border-line bg-surface p-4 shadow-card">
          <p className="text-sm font-bold text-ink">자세한 주기 기록은 {names[owner]}님이 정해요</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            처음에는 ‘우리의 주간’만 함께 봐요. 생리일이나 테스트 결과를 보여 줄지는 {names[owner]}님이 연결한 뒤 직접 골라요.
          </p>
        </div>
      )}

      <ConsentBox
        checked={draft.consent}
        onChange={(consent) => patch({ consent })}
        title="개인정보 수집·이용에 동의해요"
        notice={<GeneralConsentNotice />}
      />
      <ConsentBox
        checked={sensitive}
        onChange={onSensitive}
        title="민감정보(건강) 수집·이용에 따로 동의해요"
        notice={<SensitiveConsentNotice />}
      />

      <p className="px-1 text-[11px] leading-relaxed text-ink-3">
        생리·가임기·테스트 결과는 개인정보보호법 제23조의 민감정보라, 다른 동의와 따로 받아요. 가임기는 참고용 예상이라
        피임이나 진단 목적으로는 쓰지 말아 주세요.
      </p>
    </div>
  )
}

function ConsentBox({
  checked,
  onChange,
  title,
  notice,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  title: string
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
        <span className="text-sm font-semibold leading-snug text-ink">
          {title} <span className="font-bold text-brand-ink">(필수)</span>
        </span>
      </label>
      <div className="mt-2 pl-8">{notice}</div>
    </div>
  )
}
