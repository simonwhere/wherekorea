'use client'

// "백업 파일로 복원하기" on the welcome screen: the same check → summary →
// confirm → "이 폰은 누구 거예요?" flow as 설정 › 데이터 and the recovery
// screen (components/system/RestoreFullBackup), reading both backup kinds.

import RestoreFullBackup from '@/components/system/RestoreFullBackup'

export default function WelcomeRestore({ label = '백업 파일로 복원하기' }: { label?: string }) {
  return <RestoreFullBackup label={label} variant="ghost" />
}
