'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useId, useState } from 'react'
import DiaryTab from '@/components/tabs/DiaryTab'
import AnniversaryPanel from '@/components/us/AnniversaryPanel'
import CoupleDatesSheet from '@/components/us/CoupleDatesSheet'
import KeepCard from '@/components/us/KeepCard'
import Segmented, { segmentPanelId, segmentTabId, type SegmentOption } from '@/components/us/Segmented'
import UsHero from '@/components/us/UsHero'
import { useApp } from '@/lib/store'

type Segment = 'story' | 'album' | 'days'

// The photo feed (viewer, reactions, lazy photos) is its own local chunk, fetched the first time 앨범 opens.
const AlbumPanel = dynamic(() => import('@/components/us/AlbumPanel'), {
  ssr: false,
  loading: () => <div className="min-h-[40vh]" aria-busy="true" />,
})

const SEGMENTS: ReadonlyArray<SegmentOption<Segment>> = [
  { key: 'story', label: '이야기' },
  { key: 'album', label: '앨범' },
  { key: 'days', label: '기념일' },
]

/** Hashes that open 우리 on one segment (AppShell routes them to this tab). */
const SEGMENT_HASH: Readonly<Record<string, Segment>> = { '#days': 'days', '#album': 'album' }

function segmentFromHash(): Segment | undefined {
  return typeof window === 'undefined' ? undefined : SEGMENT_HASH[window.location.hash]
}

/**
 * Open 우리 › 앨범 from anywhere (the home cover's '앨범 →'). Setting the hash
 * switches the tab; the same hash again only switches the segment.
 */
export function goToAlbum(): void {
  if (typeof window === 'undefined') return
  if (window.location.hash === '#album') window.dispatchEvent(new HashChangeEvent('hashchange'))
  else window.location.hash = 'album'
  window.scrollTo({ top: 0 })
}

/**
 * 우리 — the couple's record book (Between-style): how long we've been
 * together, our story from dating through prep, pregnancy and the baby, the
 * photo album and our days. Everything stays on this device and exports free.
 */
export default function UsTab() {
  const { state } = useApp()
  // #days opens straight on 기념일 (links from 설정 and the home banner), #album on 앨범 (the home cover).
  const [segment, setSegment] = useState<Segment>(() => segmentFromHash() ?? 'story')
  useEffect(() => {
    const onHash = () => {
      const next = segmentFromHash()
      if (next) setSegment(next)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const [datesOpen, setDatesOpen] = useState(false)
  // Stable, so the Sheet's open effect doesn't re-run (and refocus) on every render.
  const openDates = useCallback(() => setDatesOpen(true), [])
  const closeDates = useCallback(() => setDatesOpen(false), [])
  const base = useId()
  // The album's empty-state button disappears with the switch; keep keyboard
  // and screen-reader users on the 이야기 tab instead of losing focus.
  const goStory = useCallback(() => {
    setSegment('story')
    requestAnimationFrame(() => document.getElementById(segmentTabId(base, 'story'))?.focus())
  }, [base])
  const count = state.diary.length

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">우리</h1>
        <p className="mt-0.5 text-xs text-ink-3">
          둘이 셋이 되기까지, 두 사람의 기록이 한 권으로 이어져요
          {count ? <span className="text-ink-2"> · 함께 남긴 기록 {count.toLocaleString('ko-KR')}개</span> : null}
        </p>
      </header>

      <UsHero onEditDates={openDates} />

      <Segmented options={SEGMENTS} value={segment} onChange={setSegment} label="우리 기록 보기" base={base} />

      <div role="tabpanel" id={segmentPanelId(base, segment)} aria-labelledby={segmentTabId(base, segment)}>
        {segment === 'story' ? (
          <DiaryTab />
        ) : segment === 'album' ? (
          <AlbumPanel onGoStory={goStory} />
        ) : (
          <AnniversaryPanel onEditDates={openDates} />
        )}
      </div>

      <KeepCard />

      <CoupleDatesSheet open={datesOpen} onClose={closeDates} />
    </div>
  )
}
