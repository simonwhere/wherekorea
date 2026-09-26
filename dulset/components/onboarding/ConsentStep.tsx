'use client'

import { cx } from '@/components/ui'
import { draftNames, type OnboardingDraft } from '@/lib/demo'

export default function ConsentStep({
  draft,
  patch,
}: {
  draft: OnboardingDraft
  patch: (p: Partial<OnboardingDraft>) => void
}) {
  const partner = draftNames(draft).b
  const points = [
    {
      emoji: '🔒',
      title: '생리·가임기·건강 기록은 민감한 건강정보예요',
      body: '그래서 어떻게 다루는지 먼저 알려 드려요.',
    },
    {
      emoji: '📱',
      title: '지금은 이 기기에만 저장해요',
      body: '프로토타입이라 서버가 없어요. 기록은 이 브라우저 밖으로 나가지 않아요. 지금까지 입력한 내용도 동의하기 전에는 저장하지 않았어요.',
    },
    {
      emoji: '👫',
      title: `연결하면 ${partner}님과 함께 봐요`,
      body: '실제 앱에서는 가임기 예상, 체크 현황, 병원 일정, 우리 기록을 두 사람이 함께 봐요. 무엇을 공유할지는 각자 나중에 바꿀 수 있어요.',
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

      <p className="px-1 text-[11px] leading-relaxed text-ink-3">
        실제 앱에서는 민감정보 수집·이용 동의와 파트너 공유 동의를 따로따로 받아요. 가임기는 참고용 예상이라, 피임이나
        진단 목적으로는 쓰지 말아 주세요.
      </p>

      <label
        className={cx(
          'flex min-h-[52px] cursor-pointer items-start gap-3 rounded-xl2 border p-4 transition-colors',
          draft.consent ? 'border-brand bg-brand-soft' : 'border-line bg-surface',
        )}
      >
        <input
          type="checkbox"
          checked={draft.consent}
          onChange={(e) => patch({ consent: e.target.checked })}
          className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
          aria-describedby="consent-note"
        />
        <span className="text-sm font-medium leading-snug text-ink">
          위 내용을 확인했고, 건강 기록을 이 기기에 저장하는 데 동의해요{' '}
          <span className="font-bold text-brand-ink">(필수)</span>
        </span>
      </label>
      <p id="consent-note" className="sr-only">
        동의해야 다음으로 넘어갈 수 있어요.
      </p>
    </div>
  )
}
