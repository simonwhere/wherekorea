'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useId, useState } from 'react'
import DiaryTab from '@/components/tabs/DiaryTab'
import AnniversaryPanel from '@/components/us/AnniversaryPanel'
import CoupleDatesSheet from '@/components/us/CoupleDatesSheet'
import KeepCard from '@/components/us/KeepCard'
import Segmented, { segmentPanelId, segmentTabId, type SegmentOption } from '@/components/us/Segmented'
import UsHero from '@/components/us/UsHero'
import { entryDomId, requestOpenEntry, takeOpenEntry } from '@/components/diary/openEntry'
import { Card, Toggle, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { formatKo } from '@/lib/dates'
import { MEMORIES_PROMISE } from '@/lib/logic/cover'
import { memoriesOn, setCoupleFlag } from '@/lib/logic/settings'
import { excerpt, markRecordBookNotesRead, recordBookNotes } from '@/lib/logic/usView'
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
  const { state, me } = useApp()
  const preparing = state.stage === 'preparing'
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
  // A reaction note opens its entry: the story list scrolls to the card (DiaryTab reads the request when it mounts).
  const openNote = useCallback(
    (entryId: string) => {
      requestOpenEntry(entryId)
      if (segment !== 'story') {
        setSegment('story')
        return
      }
      const el = document.getElementById(entryDomId(entryId))
      if (!el) return
      takeOpenEntry()
      el.scrollIntoView({ block: 'center' })
      el.focus({ preventScroll: true })
    },
    [segment],
  )

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">우리</h1>
        <p className="mt-0.5 text-xs text-ink-3">
          {/* While preparing the book is the couple's own — no 둘이 셋이 되기까지 promise in its first line (N27). */}
          {preparing ? '두 사람의 이야기·사진·기념일을 한 권에 모아요' : '둘이 셋이 되기까지, 두 사람의 기록이 한 권으로 이어져요'}
          {count ? <span className="text-ink-2"> · 함께 남긴 기록 {count.toLocaleString('ko-KR')}개</span> : null}
        </p>
      </header>

      {/* While preparing, '내 기록에 마음을 남겼어요' arrives here, not in the 🔔 (N27). */}
      {preparing ? <ReactionNotes key={me.id} onOpen={openNote} /> : null}

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

      {/* 'N년 전 오늘' moved here from 설정 › 첫 화면 while preparing (N27): it is the record book's line. */}
      {preparing ? <MemoriesSwitch /> : null}

      <KeepCard />

      <CoupleDatesSheet open={datesOpen} onClose={closeDates} />
    </div>
  )
}

/**
 * The record book's own news while preparing (usView.recordBookNotes): the
 * reactions on my entries I haven't seen. Shown for this visit and marked
 * read at once, so the 🔔 never counts them (AppShell bellUnread).
 */
function ReactionNotes({ onOpen }: { onOpen: (entryId: string) => void }) {
  const { state, update, me } = useApp()
  const [notes] = useState(() => recordBookNotes(state, me.id))
  useEffect(() => {
    if (notes.length) update((s) => markRecordBookNotesRead(s, me.id))
    // Once per visit, with what was there when the 기록장 opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (!notes.length) return null
  return (
    <section aria-label="새로 받은 마음" className="rounded-xl2 border border-line bg-surface px-4 py-3 shadow-card">
      <h2 className="text-[13px] font-bold text-ink">새로 받은 마음</h2>
      <ul className="mt-1 divide-y divide-line/60">
        {notes.map((n) => {
          const entryId = n.key?.split(':')[1] ?? ''
          const entry = state.diary.find((e) => e.id === entryId)
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onOpen(entryId)}
                disabled={!entry}
                className="flex min-h-[48px] w-full items-center gap-2 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">{n.title}</span>
                  {entry ? (
                    <span className="block truncate text-xs text-ink-3">
                      {formatKo(entry.date, { weekday: false })} · {excerpt(entry.text, 24) || '사진'}
                    </span>
                  ) : null}
                </span>
                {entry ? <Icon name="right" className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} /> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** 'N년 전 오늘' (couple-wide, off by default) — its preparing-stage home (N27). */
function MemoriesSwitch() {
  const { state, update } = useApp()
  const toast = useToast()
  return (
    <Card>
      <Toggle
        checked={memoriesOn(state.settings)}
        onChange={(v) => {
          update((s) => setCoupleFlag(s, 'memories', v))
          toast.show(v ? '‘N년 전 오늘’을 켰어요' : '‘N년 전 오늘’을 껐어요')
        }}
        label={
          <>
            ‘N년 전 오늘’ <span className="text-xs font-normal text-ink-3">(두 사람 모두)</span>
          </>
        }
        description={MEMORIES_PROMISE}
      />
    </Card>
  )
}
