'use client'

import { useCallback, useMemo, useState } from 'react'
import Composer from '@/components/diary/Composer'
import DeleteEntrySheet from '@/components/diary/DeleteEntrySheet'
import EditEntrySheet from '@/components/diary/EditEntrySheet'
import EntryCard from '@/components/diary/EntryCard'
import ExportCard from '@/components/diary/ExportCard'
import { Button, Chip, EmptyState } from '@/components/ui'
import { DIARY_NAME, groupByMonth } from '@/lib/logic/diary'
import {
  STAGE_SHORT,
  entryStageLabel,
  filterEntries,
  monthLabel,
  stagesWithEntries,
} from '@/lib/logic/diaryExport'
import { useApp } from '@/lib/store'
import type { Member, MemberId, Stage } from '@/lib/types'

type AuthorFilter = 'all' | 'me' | 'partner'

type OpenSheet = { kind: 'edit' | 'delete'; id: string } | null

const EMPTY: Record<Stage, { icon: string; title: string; body: string }> = {
  preparing: {
    icon: '📔',
    title: '우리 둘의 첫 기록을 남겨 볼까요?',
    body: '오늘 있었던 작은 일 하나면 충분해요. 나중에 둘이 함께 꺼내 볼 이야기가 돼요.',
  },
  pregnant: {
    icon: '🌱',
    title: '아기에게 첫 편지를 써 볼까요?',
    body: '짧은 한 줄도 좋아요. 두 사람이 번갈아 쓰다 보면 그대로 태교일기가 돼요.',
  },
  parenting: {
    icon: '👶',
    title: '아기와의 오늘을 남겨 볼까요?',
    body: '사진 한 장, 한 줄이면 충분해요. 금방 지나가는 하루들을 둘이 함께 모아 봐요.',
  },
}

// Chip is h-8 visually; min-height lifts the tap target to 44px without a class conflict.
const chipClass = 'min-h-[44px]'

/**
 * The ⇄ switch simulates picking up the other phone, so the whole tab (filters,
 * open sheets, the composer's draft) starts fresh for that person. "내 글" /
 * "{partner} 글" would otherwise silently flip meaning.
 */
export default function DiaryTab() {
  const { me } = useApp()
  return <DiaryView key={me.id} />
}

function DiaryView() {
  const { state, me, partner } = useApp()
  const [stageFilter, setStageFilter] = useState<Stage | 'all'>('all')
  const [authorFilter, setAuthorFilter] = useState<AuthorFilter>('all')
  const [sheet, setSheet] = useState<OpenSheet>(null)
  // Sheets re-run their focus effect when onClose changes — keep it stable.
  const closeSheet = useCallback(() => setSheet(null), [])
  const onEdit = useCallback((id: string) => setSheet({ kind: 'edit', id }), [])
  const onDelete = useCallback((id: string) => setSheet({ kind: 'delete', id }), [])

  const entries = state.diary
  const stages = useMemo(() => stagesWithEntries(entries), [entries])
  const mineCount = entries.filter((e) => e.author === me.id).length
  const partnerCount = entries.length - mineCount
  const showStageChips = stages.length > 1
  const showAuthorChips = mineCount > 0 && partnerCount > 0
  // A filter whose chip is no longer shown (its entries are gone, or the other
  // tab deleted them) quietly falls back to 전체 instead of hiding everything.
  const stage: Stage | 'all' =
    showStageChips && stageFilter !== 'all' && stages.includes(stageFilter) ? stageFilter : 'all'
  const authorSel: AuthorFilter = showAuthorChips ? authorFilter : 'all'
  const author: MemberId | 'all' = authorSel === 'me' ? me.id : authorSel === 'partner' ? partner.id : 'all'
  const groups = useMemo(() => groupByMonth(filterEntries(entries, { stage, author })), [entries, stage, author])

  const members = state.couple.members
  const byId = useMemo(() => new Map<MemberId, Member>(members.map((m) => [m.id, m])), [members])
  const filtered = stage !== 'all' || author !== 'all'

  // Only my own entries can be edited or deleted; a sheet whose entry is gone closes itself.
  const target = sheet ? entries.find((e) => e.id === sheet.id && e.author === me.id) ?? null : null
  const editing = sheet?.kind === 'edit' ? target : null
  const deleting = sheet?.kind === 'delete' ? target : null

  const resetFilters = () => {
    setStageFilter('all')
    setAuthorFilter('all')
  }
  // Toggle against what's on screen (the effective filter), not the raw state.
  const toggleAuthor = (next: Exclude<AuthorFilter, 'all'>) => setAuthorFilter(authorSel === next ? 'all' : next)
  const toggleStage = (next: Stage) => setStageFilter(stage === next ? 'all' : next)

  const empty = EMPTY[state.stage]

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">{DIARY_NAME[state.stage]}</h1>
        <p className="mt-0.5 text-xs text-ink-3">
          둘이 셋이 되기까지, 두 사람의 기록이 한 권으로 이어져요
          {entries.length ? <span className="text-ink-2"> · 함께 남긴 기록 {entries.length}개</span> : null}
        </p>
      </header>

      {/* Remounted per viewer (see DiaryTab): each person gets their own draft, never saved under the other name. */}
      <Composer />

      {showStageChips || showAuthorChips ? (
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <div role="group" aria-label="기록 골라 보기" className="flex w-max items-center gap-1.5">
            <Chip selected={!filtered} onClick={resetFilters} className={chipClass}>
              전체
            </Chip>
            {showStageChips
              ? stages.map((s) => (
                  <Chip
                    key={s}
                    selected={stage === s}
                    onClick={() => toggleStage(s)}
                    className={chipClass}
                  >
                    {STAGE_SHORT[s]}
                  </Chip>
                ))
              : null}
            {showStageChips && showAuthorChips ? <span className="mx-0.5 h-5 w-px bg-line" aria-hidden /> : null}
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
          icon="🔍"
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
                    return (
                      <li key={e.id}>
                        <EntryCard
                          entry={e}
                          author={writer}
                          mine={e.author === me.id}
                          stageLabel={entryStageLabel(e, { pregnancy: state.pregnancy, baby: state.baby })}
                          onEdit={onEdit}
                          onDelete={onDelete}
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

      {entries.length ? <ExportCard /> : null}

      <EditEntrySheet entry={editing} onClose={closeSheet} />
      <DeleteEntrySheet entry={deleting} onClose={closeSheet} />
    </div>
  )
}
