'use client'

import type { TabKey } from '@/components/AppShell'
import { EmptyState } from '@/components/ui'

// Placeholder — implemented in the feature build step.
export default function TodayTab({ onNavigate: _onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  return <EmptyState icon="🚧" title="TodayTab 준비 중" />
}
