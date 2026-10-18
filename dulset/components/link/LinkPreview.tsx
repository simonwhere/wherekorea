'use client'

// '민수님 화면 미리보기' (Now 3 N23): the partner page exactly as his link draws
// it, from a snapshot her phone just built (lib/logic/partnerSnapshot
// buildPartnerSnapshot — the same lenses, nothing sent anywhere). Read-only:
// the subtree is inert, so nothing in it can be tapped or focused, and there
// is no transport, no storage, no first-run card. For 설정 › 연결:
//
//   const snap = buildPartnerSnapshot(state, today, partner.id)
//   {snap ? <LinkPreview snapshot={snap} today={today} /> : null}

import { cx } from '@/components/ui'
import { snapshotDay, type PartnerSnapshot } from '@/lib/logic/partnerSnapshot'
import type { ISODate } from '@/lib/types'
import LinkBody, { NO_ACTIONS } from './LinkBody'
import { NO_MARKS, viewerOf } from './model'

export default function LinkPreview({ snapshot, today, className }: { snapshot: PartnerSnapshot; today: ISODate; className?: string }) {
  const page = snapshotDay(snapshot, today)
  if (!page) return null
  return (
    <div className={cx('bg-bg', className)} inert aria-label={`${viewerOf(page).name}님 화면 미리보기`}>
      <LinkBody page={page} today={today} marks={NO_MARKS} actions={NO_ACTIONS} />
    </div>
  )
}
