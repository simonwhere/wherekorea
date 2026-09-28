'use client'

import { Sheet } from '@/components/ui'
import type { LogRequest } from '@/lib/logLauncher'

// Placeholder — the "+ 기록" sheet is built in the next step.
export default function LogSheet({ request, onClose }: { request: LogRequest | null; onClose: () => void }) {
  return (
    <Sheet open={request !== null} onClose={onClose} title="기록하기">
      <p className="text-sm text-ink-3">준비 중이에요.</p>
    </Sheet>
  )
}
