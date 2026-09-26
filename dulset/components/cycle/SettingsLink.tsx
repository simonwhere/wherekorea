'use client'

import { cx } from '@/components/ui'

/**
 * Link to the 설정 tab. AppShell switches tabs on `hashchange`; we also scroll
 * to the top like its own tab bar does, so the settings screen doesn't open
 * half-way down. 44px tall for touch.
 */
export default function SettingsLink({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <a
      href="#settings"
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
