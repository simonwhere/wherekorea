'use client'

// 아기 tab (stage 'parenting'): who the baby is and how old, Korean milestone
// days, growth records, development milestones, NHIS checkups, vaccination
// pointers and support-program deadlines — all shared between both partners.

import { useCallback, useState } from 'react'
import BabyHero from '@/components/baby/BabyHero'
import BabyInfoSheet from '@/components/baby/BabyInfoSheet'
import Checkups from '@/components/baby/Checkups'
import DiaryQuick from '@/components/baby/DiaryQuick'
import GrowthSection from '@/components/baby/GrowthSection'
import KoreanDays from '@/components/baby/KoreanDays'
import Milestones from '@/components/baby/Milestones'
import SupportCards, { ClaimDeadlineCard } from '@/components/baby/SupportCards'
import Vaccination from '@/components/baby/Vaccination'
import { Button, EmptyState } from '@/components/ui'
import { useApp } from '@/lib/store'

export default function BabyTab() {
  const { state } = useApp()
  const [sheet, setSheet] = useState<'create' | 'edit' | null>(null)
  // Stable, so the shared Sheet doesn't re-run its focus effect on every re-render
  // (e.g. when the partner's tab syncs a change while the sheet is open).
  const closeSheet = useCallback(() => setSheet(null), [])
  const baby = state.baby

  if (!baby) {
    return (
      <div className="pt-4">
        <EmptyState
          icon="baby"
          title="아기 정보를 알려 주세요"
          body="이름과 태어난 날을 적으면 기념일, 영유아 건강검진 시기, 성장 기록을 우리 둘이 함께 볼 수 있어요."
          action={
            <Button size="lg" onClick={() => setSheet('create')}>
              아기 정보 입력하기
            </Button>
          }
        />
        <BabyInfoSheet open={sheet === 'create'} onClose={closeSheet} mode="create" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <BabyHero baby={baby} onEdit={() => setSheet('edit')} />
      <ClaimDeadlineCard baby={baby} />
      <DiaryQuick />
      <div className="space-y-6 pt-3">
        <KoreanDays baby={baby} />
        <GrowthSection baby={baby} />
        <Milestones baby={baby} />
        <Checkups baby={baby} />
        <Vaccination />
        <SupportCards baby={baby} />
      </div>
      <BabyInfoSheet open={sheet === 'edit'} onClose={closeSheet} mode="edit" />
    </div>
  )
}
