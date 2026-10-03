'use client'

// A way back that does not depend on her (Now 3 N22, docs/next-a-setup.md
// §7-3): the page opened from 카카오톡 usually runs inside its in-app browser,
// where '홈 화면에 추가' is not possible — so there it says '사파리/크롬으로
// 열기' (카카오톡 has its own way out to the default browser; elsewhere the
// address is copied). In a real browser that is not already the home-screen
// app, a small card shows the two or three steps for this phone. Both close
// with ✕ and stay closed on this device (components/link/model keys).

import { useEffect, useState } from 'react'
import { cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { Pill } from './bits'
import { devicePlatform, inAppBrowser, installSteps, kakaoExternalURL, type DevicePlatform, type InAppBrowser } from './model'

export interface Where {
  inApp: InAppBrowser | null
  platform: DevicePlatform
  /** Already opened from the home screen (display-mode: standalone / navigator.standalone). */
  standalone: boolean
}

/** Where the page is open — read once on the client (null during the static render). */
export function useWhere(): Where | null {
  const [where, setWhere] = useState<Where | null>(null)
  useEffect(() => {
    const ua = navigator.userAgent || ''
    const nav = navigator as Navigator & { standalone?: boolean }
    let standalone = nav.standalone === true
    try {
      standalone = standalone || window.matchMedia?.('(display-mode: standalone)').matches === true
    } catch {
      /* old engine */
    }
    setWhere({ inApp: inAppBrowser(ua), platform: devicePlatform(ua, navigator.maxTouchPoints ?? 0), standalone })
  }, [])
  return where
}

function CloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <Icon name="x" className="h-[18px] w-[18px]" />
    </button>
  )
}

/** '사파리/크롬으로 열기' inside a messenger's browser (카카오톡 first). */
export function LinkOutsideHint({
  inApp,
  onCopy,
  onClose,
  className,
}: {
  inApp: InAppBrowser
  /** Copy this page's address (the page shows a toast). */
  onCopy: () => void
  onClose: () => void
  className?: string
}) {
  const where = inApp === 'kakao' ? '카카오톡' : '앱'
  return (
    <aside aria-label="사파리나 크롬으로 열기" className={cx('rounded-[18px] bg-surface-2 px-3.5 py-3', className)}>
      <div className="flex items-start gap-2">
        <Icon name="ext" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-ink-2" />
        <p className="min-w-0 flex-1 text-[13px] leading-[1.5] text-ink-2">
          <b className="font-bold text-ink">{where} 안에서 열었어요.</b> 사파리나 크롬으로 열면 홈 화면에 두고 다시 열 수 있어요.
        </p>
        <CloseButton onClick={onClose} label="안내 닫기" />
      </div>
      <div className="mt-2 flex flex-wrap gap-2 pl-[26px]">
        {inApp === 'kakao' ? (
          <a
            href={typeof window !== 'undefined' ? kakaoExternalURL(window.location.href) : '#'}
            className="relative inline-flex h-10 items-center justify-center gap-1 rounded-full bg-surface px-3.5 text-[13.5px] font-bold text-ink before:absolute before:-inset-y-0.5 before:inset-x-0 before:content-[''] hover:bg-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            사파리/크롬으로 열기
          </a>
        ) : null}
        <Pill tone={inApp === 'kakao' ? 'soft' : 'outline'} onClick={onCopy} className={inApp === 'kakao' ? 'bg-transparent' : undefined}>
          주소 복사
        </Pill>
      </div>
    </aside>
  )
}

/** '홈 화면에 두기' — the steps for this phone, in a real browser that is not the home-screen app yet. */
export function LinkInstallCard({ platform, onClose, className }: { platform: DevicePlatform; onClose: () => void; className?: string }) {
  const steps = installSteps(platform)
  return (
    <aside
      aria-label="홈 화면에 두기"
      className={cx('rounded-card bg-surface px-[18px] py-4 shadow-warm dark:border dark:border-line/70 dark:shadow-none', className)}
    >
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <Icon name="phone" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14.5px] font-bold tracking-[-0.02em] text-ink">홈 화면에 두면 다시 열기 쉬워요</h3>
          {platform === 'other' ? (
            <ul className="mt-1 space-y-0.5 text-[13px] leading-[1.5] text-ink-2">
              {steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[13px] leading-[1.5] text-ink-2">
              {platform === 'ios' ? 'iPhone' : 'Android'} · {steps.join(' → ')}
            </p>
          )}
          <p className="mt-1 text-[12px] text-ink-3">앱을 설치하는 게 아니라, 이 화면을 바로 여는 아이콘이에요.</p>
        </div>
        <CloseButton onClick={onClose} label="홈 화면 안내 닫기" />
      </div>
    </aside>
  )
}
