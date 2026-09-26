'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import DiaryTab from '@/components/tabs/DiaryTab'
import AlbumPanel from '@/components/us/AlbumPanel'
import AnniversaryPanel from '@/components/us/AnniversaryPanel'
import CoupleDatesSheet from '@/components/us/CoupleDatesSheet'
import KeepCard from '@/components/us/KeepCard'
import Segmented, { segmentPanelId, segmentTabId, type SegmentOption } from '@/components/us/Segmented'
import UsHero from '@/components/us/UsHero'
import { useApp } from '@/lib/store'

type Segment = 'story' | 'album' | 'days'

const SEGMENTS: ReadonlyArray<SegmentOption<Segment>> = [
  { key: 'story', label: '이야기' },
  { key: 'album', label: '앨범' },
  { key: 'days', label: '기념일' },
]

/**
 * 우리 — the couple's record book (Between-style): how long we've been
 * together, our story from dating through prep, pregnancy and the baby, the
 * photo album and our days. Everything stays on this device and exports free.
 */
export default function UsTab() {
  const { state } = useApp()
  // #days opens straight on 기념일 (links from 설정 and the home banner).
  const [segment, setSegment] = useState<Segment>(() =>
    typeof window !== 'undefined' && window.location.hash === '#days' ? 'days' : 'story',
  )
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === '#days') setSegment('days')
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
