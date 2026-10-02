'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Composer from '@/components/diary/Composer'
import DeleteEntrySheet from '@/components/diary/DeleteEntrySheet'
import EditEntrySheet from '@/components/diary/EditEntrySheet'
import EntryCard from '@/components/diary/EntryCard'
import { entryDomId, takeOpenEntry } from '@/components/diary/openEntry'
import { Button, Chip, EmptyState, useToast } from '@/components/ui'
import type { IconName } from '@/components/ui/icons'
import { groupByMonth } from '@/lib/logic/diary'
import { monthLabel } from '@/lib/logic/diaryExport'
import { visibleEntries } from '@/lib/logic/personalLog'
import { stampOn } from '@/lib/logic/today'
import {
  CHAPTER_SHORT,
  chapterContext,
  chapterLabel,
  chaptersWithEntries,
  entryChapter,
  filterStory,
  reactToEntry,
  reactionOf,
  receivedReactions,
  type Chapter,
} from '@/lib/logic/usView'
import { useApp } from '@/lib/store'
import type { Member, MemberId, Stage } from '@/lib/types'

type AuthorFilter = 'all' | 'me' | 'partner'

type OpenSheet = { kind: 'edit' | 'delete'; id: string } | null

const EMPTY: Record<Stage, { icon: IconName; title: string; body: string }> = {
  preparing: {
    icon: 'book',
    title: '우리 둘의 첫 기록을 남겨 볼까요?',
    body: '오늘 있었던 작은 일 하나면 충분해요. 날짜를 예전으로 바꾸면 연애 시절 이야기도 ‘우리 둘’로 남길 수 있어요.',
  },
  pregnant: {
    icon: 'sprout',
    title: '아기에게 첫 편지를 써 볼까요?',
    body: '짧은 한 줄도 좋아요. 두 사람이 번갈아 쓰다 보면 그대로 태교일기가 돼요.',
  },
  parenting: {
    icon: 'baby',
    title: '아기와의 오늘을 남겨 볼까요?',
    body: '사진 한 장, 한 줄이면 충분해요. 금방 지나가는 하루들을 둘이 함께 모아 봐요.',
  },
}

// Chip is h-8 visually; min-height lifts the tap target to 44px without a class conflict.
const chipClass = 'min-h-[44px]'

/**
 * 우리 › 이야기: composer, filters and the shared timeline (우리 둘 → 준비 →
 * 임신 → 육아). The page heading, export and backup live in the 우리 tab.
 *
 * The ⇄ switch simulates picking up the other phone, so the whole panel
 * (filters, open sheets, the composer's draft) starts fresh for that person.
 * "내 글" / "{partner} 글" would otherwise silently flip meaning.
 */
export default function DiaryTab() {
  const { me } = useApp()
  return <DiaryView key={me.id} />
}

function DiaryView() {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const [chapterFilter, setChapterFilter] = useState<Chapter | 'all'>('all')
  const [authorFilter, setAuthorFilter] = useState<AuthorFilter>('all')
  const [sheet, setSheet] = useState<OpenSheet>(null)
  // Sheets re-run their focus effect when onClose changes — keep it stable.
  const closeSheet = useCallback(() => setSheet(null), [])
  const onEdit = useCallback((id: string) => setSheet({ kind: 'edit', id }), [])
  const onDelete = useCallback((id: string) => setSheet({ kind: 'delete', id }), [])

  // Never the other member's '나만 보기' entries (DiaryEntry.privateTo).
  const entries = useMemo(() => visibleEntries(state.diary, me.id), [state.diary, me.id])
  // Opened for one entry (the cover's 'N년 전 오늘' line): scroll its card into view once.
  useEffect(() => {
    const id = takeOpenEntry()
    if (!id) return
    const el = document.getElementById(entryDomId(id))
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    el.focus({ preventScroll: true })
  }, [])
  const { settings, pregnancy, baby, createdAt } = state
  const ctx = useMemo(
    () => chapterContext({ settings, pregnancy, baby, createdAt }),
    [settings, pregnancy, baby, createdAt],
  )
  const chapters = useMemo(() => chaptersWithEntries(entries, ctx), [entries, ctx])
  const mineCount = entries.filter((e) => e.author === me.id).length
  const partnerCount = entries.length - mineCount
  const showChapterChips = chapters.length > 1
  const showAuthorChips = mineCount > 0 && partnerCount > 0
  // A filter whose chip is no longer shown (its entries are gone, or the other
  // tab deleted them) quietly falls back to 전체 instead of hiding everything.
  const chapter: Chapter | 'all' =
    showChapterChips && chapterFilter !== 'all' && chapters.includes(chapterFilter) ? chapterFilter : 'all'
  const authorSel: AuthorFilter = showAuthorChips ? authorFilter : 'all'
  const author: MemberId | 'all' = authorSel === 'me' ? me.id : authorSel === 'partner' ? partner.id : 'all'
  const groups = useMemo(
    () => groupByMonth(filterStory(entries, ctx, { chapter, author, viewer: me.id })),
    [entries, ctx, chapter, author, me.id],
  )

  const members = state.couple.members
  const byId = useMemo(() => new Map<MemberId, Member>(members.map((m) => [m.id, m])), [members])
  const filtered = chapter !== 'all' || author !== 'all'

  // Only my own entries can be edited or deleted; a sheet whose entry is gone closes itself.
  const target = sheet ? entries.find((e) => e.id === sheet.id && e.author === me.id) ?? null : null
  const editing = sheet?.kind === 'edit' ? target : null
  const deleting = sheet?.kind === 'delete' ? target : null

  const resetFilters = () => {
    setChapterFilter('all')
    setAuthorFilter('all')
  }
  // Toggle against what's on screen (the effective filter), not the raw state.
  const toggleAuthor = (next: Exclude<AuthorFilter, 'all'>) => setAuthorFilter(authorSel === next ? 'all' : next)
  const toggleChapter = (next: Chapter) => setChapterFilter(chapter === next ? 'all' : next)

  // `next` is decided from what's on screen, so re-applying it (two-tab sync) is harmless.
  const onReact = (id: string, next: string | null) => {
    const writer = entries.find((e) => e.id === id)?.author
    update((s) => reactToEntry(s, id, me.id, next, stampOn(today)))
    if (next && writer) toast.show(`${byId.get(writer)?.name ?? partner.name}님에게 ${next} 마음을 전했어요`)
  }

  const empty = EMPTY[state.stage]

  return (
    <div className="space-y-4">
      {/* Remounted per viewer (see DiaryTab): each person gets their own draft, never saved under the other name. */}
      <Composer />

      {showChapterChips || showAuthorChips ? (
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <div role="group" aria-label="기록 골라 보기" className="flex w-max items-center gap-1.5">
            <Chip selected={!filtered} onClick={resetFilters} className={chipClass}>
              전체
            </Chip>
            {showChapterChips
              ? chapters.map((c) => (
                  <Chip key={c} selected={chapter === c} onClick={() => toggleChapter(c)} className={chipClass}>
                    {CHAPTER_SHORT[c]}
                  </Chip>
                ))
              : null}
            {showChapterChips && showAuthorChips ? <span className="mx-0.5 h-5 w-px bg-line" aria-hidden /> : null}
            {showAuthorChips ? (
              <>
                <Chip
                  selected={authorSel === 'me'}
                  onClick={() => toggleAuthor('me')}
                  tone={me.tracksCycle ? 'her' : 'him'}
                  className={chipClass}
                >
                  내 글
                </Chip>
                <Chip
                  selected={authorSel === 'partner'}
                  onClick={() => toggleAuthor('partner')}
                  tone={partner.tracksCycle ? 'her' : 'him'}
                  className={chipClass}
                >
                  <span className="max-w-[7rem] truncate">{partner.name}</span> 글
                </Chip>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {!entries.length ? (
        <EmptyState icon={empty.icon} title={empty.title} body={empty.body} />
      ) : !groups.length ? (
        <EmptyState
          icon="search"
          title="고른 조건에 맞는 기록이 없어요"
          action={
            <Button variant="secondary" onClick={resetFilters}>
              전체 보기
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const headingId = `diary-month-${g.month}`
            return (
              <section key={g.month} aria-labelledby={headingId}>
                <h2 id={headingId} className="mb-2 px-1 text-xs font-bold text-ink-2">
                  {monthLabel(g.month)}
                  <span className="ml-1 font-medium text-ink-3">· {g.entries.length}개</span>
                </h2>
                <ol className="space-y-3">
                  {g.entries.map((e) => {
                    const writer = byId.get(e.author) ?? (e.author === me.id ? me : partner)
                    const mine = e.author === me.id
                    const received = mine
                      ? receivedReactions(e).flatMap((r) => {
                          const m = byId.get(r.member)
                          return m ? [{ member: m, emoji: r.emoji }] : []
                        })
                      : []
                    return (
                      <li key={e.id} id={entryDomId(e.id)} tabIndex={-1} className="rounded-xl2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                        <EntryCard
                          entry={e}
                          author={writer}
                          mine={mine}
                          chapter={entryChapter(e, ctx)}
                          stageLabel={chapterLabel(e, ctx)}
                          myReaction={mine ? undefined : reactionOf(e, me.id)}
                          received={received}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onReact={onReact}
                        />
                      </li>
                    )
                  })}
                </ol>
              </section>
            )
          })}
        </div>
      )}

      <EditEntrySheet entry={editing} onClose={closeSheet} />
      <DeleteEntrySheet entry={deleting} onClose={closeSheet} />
    </div>
  )
}
