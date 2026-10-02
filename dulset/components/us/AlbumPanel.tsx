'use client'

// 우리 › 앨범 — a photo-first feed (Next B): one card per photo, newest first,
// with its day, who took it, a bit of the story and the partner's small
// reaction. Photos load only as they scroll near (useNearScreen) and open full
// size in PhotoViewer. Everything comes from the diary: the feed never shows
// anything from the cycle, the health records or the stage, and the other
// member's '나만 보기' entries stay out (lib/logic/usView.ts albumFeed).

import { useCallback, useMemo, useState } from 'react'
import CoverSheet from '@/components/cover/CoverSheet'
import { CHAPTER_BADGE_TONE } from '@/components/diary/EntryCard'
import { ReactionPicker, ReceivedReactions } from '@/components/diary/Reactions'
import { Avatar, Button, EmptyState, cx, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { formatKo } from '@/lib/dates'
import { monthLabel } from '@/lib/logic/diaryExport'
import { stampOn } from '@/lib/logic/today'
import {
  albumFeed,
  chapterContext,
  chapterLabel,
  entryChapter,
  reactToEntry,
  reactionOf,
  receivedReactions,
  type AlbumItem,
} from '@/lib/logic/usView'
import { useApp } from '@/lib/store'
import type { DiaryEntry, Member, MemberId } from '@/lib/types'
import PhotoViewer from './PhotoViewer'
import { useNearScreen, usePhotoURL } from './usePhotoURL'

// ── 광고 자리 (지금은 없어요) ───────────────────────────────────
// There is no ad, no sponsored card and no ad SDK in this feed or anywhere in
// the app, and the welcome screen promises as much. If a clearly labelled
// '광고' card is ever tried, this feed is the only place it may go (between
// two photo cards, never first), and only under these rules
// (docs/STATUS.md Next B · docs/review-realuse.md G11):
//   · never on 오늘, 주기, 알림, the partner's link screen — and never while
//     the couple is in the preparing stage (the fact itself is health context)
//   · never chosen from cycle, health, stage or any record: self-served,
//     untargeted, no SDK, no tracking
//   · never in the 42 quiet days after a loss (lib/logic/pregnancy recentlyEnded)
//     and never on 생리 1~3일
//   · off with one switch in 설정, and labelled '광고' on the card itself
// Until a decision says otherwise, nothing here renders such a card.

export default function AlbumPanel({ onGoStory }: { onGoStory: () => void }) {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const feed = useMemo(() => albumFeed(state.diary, me.id), [state.diary, me.id])
  const list = useMemo(() => feed.map((i) => i.entry), [feed])
  const [openId, setOpenId] = useState<string | null>(null)
  const close = useCallback(() => setOpenId(null), [])
  const [coverOpen, setCoverOpen] = useState(false)
  const openCover = useCallback(() => setCoverOpen(true), [])
  const closeCover = useCallback(() => setCoverOpen(false), [])

  const members = state.couple.members
  const byId = useMemo(() => new Map<MemberId, Member>(members.map((m) => [m.id, m])), [members])
  const authorOf = useCallback(
    (e: DiaryEntry) => byId.get(e.author) ?? (e.author === me.id ? me : partner),
    [byId, me, partner],
  )
  const { settings, pregnancy, baby, createdAt } = state
  const ctx = useMemo(
    () => chapterContext({ settings, pregnancy, baby, createdAt }),
    [settings, pregnancy, baby, createdAt],
  )

  // Same rule as the story: decided from what's on screen, so a re-apply (two-tab sync) is harmless.
  const onReact = (id: string, next: string | null) => {
    const writer = list.find((e) => e.id === id)?.author
    update((s) => reactToEntry(s, id, me.id, next, stampOn(today)))
    if (next && writer) toast.show(`${byId.get(writer)?.name ?? partner.name}님에게 ${next} 마음을 전했어요`)
  }

  if (!feed.length) {
    return (
      <>
        <EmptyState
          icon="img"
          title="아직 사진이 없어요"
          body="첫 화면에 걸 사진 한 장부터 시작해 볼까요? 이야기에 사진을 붙이면 여기에 날짜순으로 모여요. 연애 시절 사진도 날짜를 예전으로 바꿔 남길 수 있어요."
          action={
            <div className="grid gap-2">
              <Button onClick={openCover}>
                <Icon name="plus" className="h-[18px] w-[18px]" strokeWidth={2.2} />
                우리 사진 걸기
              </Button>
              <Button variant="ghost" onClick={onGoStory}>
                이야기에 사진 붙이기
              </Button>
            </div>
          }
        />
        <CoverSheet open={coverOpen} onClose={closeCover} />
      </>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs text-ink-3">
          사진 {feed.length.toLocaleString('ko-KR')}장 · 이야기에 붙인 사진이 날짜순으로 모여요
        </p>
        <button
          type="button"
          onClick={openCover}
          className="-mr-2 flex h-11 shrink-0 items-center rounded-xl px-2 text-xs font-semibold text-brand-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          표지 사진<span className="sr-only"> 바꾸기</span>
        </button>
      </div>

      <ol className="space-y-4" aria-label="앨범">
        {feed.map((item, i) => {
          const monthBreak = i === 0 || feed[i - 1]!.month !== item.month
          const author = authorOf(item.entry)
          const mine = item.entry.author === me.id
          const received = mine
            ? receivedReactions(item.entry).flatMap((r) => {
                const m = byId.get(r.member)
                return m ? [{ member: m, emoji: r.emoji }] : []
              })
            : []
          return (
            <li key={item.entry.id}>
              {monthBreak ? (
                <p className="mb-2 px-1 text-xs font-bold text-ink-2" aria-hidden>
                  {monthLabel(item.month)}
                </p>
              ) : null}
              <FeedCard
                item={item}
                author={author}
                mine={mine}
                chapter={chapterLabel(item.entry, ctx)}
                chapterTone={CHAPTER_BADGE_TONE[entryChapter(item.entry, ctx)]}
                sameYear={item.entry.date.slice(0, 4) === today.slice(0, 4)}
                myReaction={mine ? undefined : reactionOf(item.entry, me.id)}
                received={received}
                onOpen={setOpenId}
                onReact={onReact}
              />
            </li>
          )
        })}
      </ol>

      <PhotoViewer list={list} openId={openId} onMove={setOpenId} onClose={close} authorOf={authorOf} />
      <CoverSheet open={coverOpen} onClose={closeCover} />
    </div>
  )
}

/** One photo card: the picture (lazy), then who · when · chapter, the caption and the reaction row. */
function FeedCard({
  item,
  author,
  mine,
  chapter,
  chapterTone,
  sameYear,
  myReaction,
  received,
  onOpen,
  onReact,
}: {
  item: AlbumItem
  author: Member
  mine: boolean
  chapter: string
  chapterTone: string
  sameYear: boolean
  myReaction?: string
  received: Array<{ member: Member; emoji: string }>
  onOpen: (id: string) => void
  onReact: (id: string, next: string | null) => void
}) {
  const { entry } = item
  const day = formatKo(entry.date, { year: !sameYear })
  return (
    <article className="overflow-hidden rounded-xl2 border border-transparent bg-surface shadow-warm dark:border-line/70 dark:shadow-none forced-colors:border-line">
      <FeedPhoto entry={entry} label={`${author.name}의 사진 · ${formatKo(entry.date, { weekday: false })} 크게 보기`} onOpen={onOpen} />
      <div className="px-4 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <Avatar member={author} size="sm" />
          <p className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-ink">
            <span className="truncate font-semibold">{author.name}</span>
            {mine ? <span className="shrink-0 rounded-full bg-surface-2 px-1.5 text-[10px] font-medium text-ink-3">나</span> : null}
            <time dateTime={entry.date} className="shrink-0 text-xs text-ink-3">
              {day}
            </time>
          </p>
          <span className={cx('shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', chapterTone)}>
            {chapter}
          </span>
        </div>
        {item.caption ? (
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-2">{item.caption}</p>
        ) : null}
        {mine ? (
          received.length ? (
            <div className="mt-2">
              <ReceivedReactions items={received} />
            </div>
          ) : null
        ) : (
          <div className="-mb-2 -ml-2 mt-1">
            <ReactionPicker author={author} value={myReaction} day={day} onChange={(next) => onReact(entry.id, next)} />
          </div>
        )}
      </div>
    </article>
  )
}

/** The picture, loaded once it scrolls near; a skeleton before that, a quiet note when it isn't on this phone. */
function FeedPhoto({ entry, label, onOpen }: { entry: DiaryEntry; label: string; onOpen: (id: string) => void }) {
  const [ref, near] = useNearScreen<HTMLButtonElement>()
  const { url, status } = usePhotoURL(entry.photoId, near)
  const [broken, setBroken] = useState<string | null>(null)
  const shown = url && broken !== url ? url : null
  const missing = status === 'missing' || (url !== null && broken === url)
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpen(entry.id)}
      aria-label={label}
      className={cx(
        'relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-surface-2',
        'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand',
        !shown && !missing && 'animate-pulse',
      )}
    >
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob: URL
        <img
          src={shown}
          alt=""
          className="h-full w-full object-cover dark:brightness-[.9]"
          decoding="async"
          loading="lazy"
          onError={() => setBroken(shown)}
        />
      ) : missing ? (
        <span className="flex items-center gap-1.5 px-4 text-center text-xs text-ink-3">
          <Icon name="cam" className="h-4 w-4" />
          이 기기에서 사진을 찾을 수 없어요
        </span>
      ) : null}
    </button>
  )
}
