'use client'

import type { SettingsAnchor } from '@/components/settings/anchors'
import { cx } from '@/components/ui'

/**
 * Link to the 설정 tab — or straight to one of its sections (`anchor`: 공유 범위
 * #share, 내 알림 #alerts, 데이터 #data; SettingsTab scrolls there). AppShell
 * switches tabs on `hashchange`; we also scroll to the top like its own tab bar
 * does, so the settings screen doesn't open half-way down. 44px tall for touch.
 */
export default function SettingsLink({
  children,
  className,
  anchor,
}: {
  children: React.ReactNode
  className?: string
  anchor?: SettingsAnchor
}) {
  return (
    <a
      href={`#${anchor ?? 'settings'}`}
      onClick={() => window.scrollTo({ top: 0 })}
      className={cx(
        'inline-flex min-h-[44px] shrink-0 items-center font-semibold text-brand-ink underline underline-offset-2',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        className,
      )}
    >
      {children}
    </a>
  )
}
