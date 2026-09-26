'use client'

import { Sheet } from '@/components/ui'

// Placeholder — implemented in the feature build step.
export default function NotificationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="알림">
      <p className="text-sm text-ink-3">준비 중</p>
    </Sheet>
  )
}
