'use client'

// Consent and sharing copy shared by onboarding and 설정 › 공유 범위.
//
// 개인정보보호법 제23조: health / sex-life information (생리·가임기·테스트
// 결과) is 민감정보 — consent for it is asked separately from the other
// consents. Showing it to the partner is in effect a provision to a third
// party, so the partner-sharing consent names who gets it, what, why, for how
// long, and that saying no is fine. 시행령 제17조 · 처리 방법 고시 제4조: the
// sensitive items, the retention period and the recipient are marked clearly
// (bold + underline). Research: docs/research/regulation.json.

import { cx } from '@/components/ui'

/** Clearly marked "중요한 내용" (bold + underline). */
export function Mark({ children }: { children: React.ReactNode }) {
  return <strong className="font-bold text-ink underline decoration-1 underline-offset-2">{children}</strong>
}

/** Label · value rows for a consent notice. */
export function NoticeRows({ rows, className }: { rows: ReadonlyArray<[string, React.ReactNode]>; className?: string }) {
  return (
    <dl className={cx('grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-xs leading-relaxed', className)}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-semibold text-ink-3">{k}</dt>
          <dd className="min-w-0 text-ink-2">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** 개인정보 수집·이용 (general) — 제15조②: 목적·항목·보유 기간·거부할 권리와 불이익. */
export function GeneralConsentNotice() {
  return (
    <NoticeRows
      rows={[
        ['항목', '이름·애칭, 역할, 출생연도(선택), 우리의 날(선택), 준비 시작일'],
        ['목적', '두 사람 공간 만들기, 상담 시기·기념일 안내'],
        ['보관', <Mark key="k">직접 지울 때까지, 이 기기에만</Mark>],
        ['거부', '동의하지 않을 수 있어요. 다만 그러면 두 사람 공간을 만들 수 없어 둘셋을 시작할 수 없어요.'],
      ]}
    />
  )
}

/** 민감정보(건강) 수집·이용 — asked separately. */
export function SensitiveConsentNotice() {
  return (
    <NoticeRows
      rows={[
        ['항목', <Mark key="i">생리일·주기, 가임기 예상, 배테기(LH)·임테기 결과, 영양제·생활 습관 체크</Mark>],
        ['목적', '주기 예상과 두 사람의 준비 알림'],
        ['보관', <Mark key="k">직접 지울 때까지, 이 기기에만 저장</Mark>],
        ['거부', '동의하지 않을 수 있어요. 다만 주기와 체크가 둘셋의 중심이라, 동의해야 시작할 수 있어요.'],
      ]}
    />
  )
}

/** 파트너 공유 — what "자세한 기록까지" means, for the cycle owner. */
export function ShareConsentNotice({ partner }: { partner: string }) {
  return (
    <NoticeRows
      rows={[
        ['받는 사람', <Mark key="r">{partner}님</Mark>],
        ['항목', <Mark key="i">생리일, 배테기(LH)·임테기 결과</Mark>],
        ['목적', '둘이 함께 준비하기 위해'],
        ['기간', <Mark key="k">설정에서 끄거나 연결을 끊을 때까지</Mark>],
        ['거부', '‘우리의 주간만’을 고르면 돼요. 그래도 둘셋을 똑같이 쓸 수 있어요.'],
      ]}
    />
  )
}

export type ShareChoice = 'week' | 'details'

export const SHARE_OPTIONS: ReadonlyArray<{ value: ShareChoice; label: string; hint: (partner: string) => string }> = [
  {
    value: 'week',
    label: '우리의 주간만 (기본)',
    hint: (p) => `${p}님에게는 ‘우리의 주간’과 부드러운 안내만 보여요. 생리일과 테스트 결과는 나만 봐요.`,
  },
  {
    value: 'details',
    label: '자세한 기록까지 (생리·배테기·임테기)',
    hint: (p) => `생리일, 배테기·임테기 결과도 ${p}님 화면에 보여요.`,
  },
]
