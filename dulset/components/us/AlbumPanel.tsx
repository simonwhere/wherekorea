'use client'

import { useCallback, useMemo, useState } from 'react'
import { Button, EmptyState, cx } from '@/components/ui'
import { formatKo } from '@/lib/dates'
import { monthLabel } from '@/lib/logic/diaryExport'
import { albumGroups } from '@/lib/logic/usView'
import { useApp } from '@/lib/store'
import type { DiaryEntry, Member, MemberId } from '@/lib/types'
import PhotoViewer from './PhotoViewer'
import { useNearScreen, usePhotoURL } from './usePhotoURL'

/** 우리 › 앨범: every diary photo, newest first, by month. */
export default function AlbumPanel({ onGoStory }: { onGoStory: () => void }) {
  const { state, me, partner } = useApp()
  const groups = useMemo(() => albumGroups(state.diary, me.id), [state.diary, me.id])
  const flat = useMemo(() => groups.flatMap((g) => g.entries), [groups])
  const [openId, setOpenId] = useState<string | null>(null)
  const close = useCallback(() => setOpenId(null), [])
  const members = state.couple.members
  const byId = useMemo(() => new Map<MemberId, Member>(members.map((m) => [m.id, m])), [members])
  const authorOf = (e: DiaryEntry) => byId.get(e.author) ?? (e.author === me.id ? me : partner)

  if (!flat.length) {
    return (
      <EmptyState
        icon="🖼️"
        title="아직 사진이 없어요"
        body="이야기에 사진을 붙여 기록하면 여기에 날짜별로 모여요. 연애 시절 사진도 날짜를 예전으로 바꿔 남길 수 있어요."
        action={
          <Button variant="secondary" onClick={onGoStory}>
            이야기 쓰러 가기
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-5">
      <p className="px-1 text-xs text-ink-3">
        사진 {flat.length.toLocaleString('ko-KR')}장 · 이야기에 붙인 사진이 여기에 모여요
      </p>
      {groups.map((g) => {
        const headingId = `album-month-${g.month}`
        return (
          <section key={g.month} aria-labelledby={headingId}>
            <h2 id={headingId} className="mb-2 px-1 text-xs font-bold text-ink-2">
              {monthLabel(g.month)}
              <span className="ml-1 font-medium text-ink-3">· {g.entries.length}장</span>
            </h2>
            <ul className="grid grid-cols-3 gap-1">
              {g.entries.map((e) => (
                <li key={e.id}>
                  <Thumb entry={e} author={authorOf(e)} onOpen={setOpenId} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <PhotoViewer list={flat} openId={openId} onMove={setOpenId} onClose={close} authorOf={authorOf} />
    </div>
  )
}

function Thumb({ entry, author, onOpen }: { entry: DiaryEntry; author: Member; onOpen: (id: string) => void }) {
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
      aria-label={`${author.name}의 사진 · ${formatKo(entry.date, { weekday: false })} 크게 보기`}
      className={cx(
        'relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-surface-2',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        !shown && !missing && 'animate-pulse',
      )}
    >
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob: URL
        <img
          src={shown}
          alt=""
          className="h-full w-full object-cover"
          decoding="async"
          onError={() => setBroken(shown)}
        />
      ) : missing ? (
        <span aria-hidden className="text-xl text-ink-3">
          📷
        </span>
      ) : null}
    </button>
  )
}
