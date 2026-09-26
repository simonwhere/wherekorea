// Diary entries (준비 기록 · 태교일기 · 육아일기) — pure helpers.

import { uid } from '../id'
import type { AppState, DiaryEntry, ISODate, MemberId, Stage } from '../types'

export const DIARY_NAME: Record<Stage, string> = {
  preparing: '우리의 기록',
  pregnant: '태교일기',
  parenting: '육아일기',
}

export function addEntry(
  state: AppState,
  entry: { date: ISODate; author: MemberId; text: string; mood?: string; photoId?: string; stage?: Stage },
  nowISO: string,
): AppState {
  const text = entry.text.trim()
  if (!text && !entry.photoId) return state
  const e: DiaryEntry = {
    id: uid(),
    date: entry.date,
    author: entry.author,
    stage: entry.stage ?? state.stage,
    text,
    mood: entry.mood,
    photoId: entry.photoId,
    createdAt: nowISO,
  }
  return { ...state, diary: [...state.diary, e] }
}

export function updateEntry(
  state: AppState,
  id: string,
  patch: Partial<Pick<DiaryEntry, 'text' | 'mood' | 'date' | 'photoId'>>,
): AppState {
  return { ...state, diary: state.diary.map((e) => (e.id === id ? { ...e, ...patch } : e)) }
}

export function removeEntry(state: AppState, id: string): AppState {
  return { ...state, diary: state.diary.filter((e) => e.id !== id) }
}

/** Newest first; same-day entries by creation time. */
export function sortedEntries(entries: DiaryEntry[]): DiaryEntry[] {
  return [...entries].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1,
  )
}

/** Group by 'YYYY-MM' (newest month first). */
export function groupByMonth(entries: DiaryEntry[]): Array<{ month: string; entries: DiaryEntry[] }> {
  const groups = new Map<string, DiaryEntry[]>()
  for (const e of sortedEntries(entries)) {
    const key = e.date.slice(0, 7)
    const list = groups.get(key) ?? []
    list.push(e)
    groups.set(key, list)
  }
  return Array.from(groups, ([month, list]) => ({ month, entries: list }))
}

/** Rotating writing prompts so a blank page is never the starting point. */
export const PROMPTS: Record<Stage, string[]> = {
  preparing: [
    '오늘 서로에게 고마웠던 순간은?',
    '우리 아이에게 꼭 들려주고 싶은 우리 이야기가 있다면?',
    '요즘 우리 둘의 컨디션은 어때요?',
    '다음 데이트에서 해 보고 싶은 것',
    '준비하면서 힘들었던 점, 서로에게 솔직하게',
  ],
  pregnant: [
    '오늘 아기에게 해 주고 싶은 말',
    '요즘 가장 먹고 싶은 음식은?',
    '처음 심장 소리를 들었을 때의 기분',
    '아빠가 오늘 해 준 태교',
    '아기 이름 후보를 적어 볼까요?',
  ],
  parenting: [
    '오늘 아기가 처음 해 본 것',
    '오늘 가장 많이 웃은 순간',
    '오늘 먹은 것, 잠든 시간, 기분',
    '엄마·아빠가 오늘 서로에게 고마웠던 점',
    '10년 뒤의 너에게',
  ],
}

export function promptFor(stage: Stage, date: ISODate): string {
  const list = PROMPTS[stage]
  const seed = Number(date.replace(/-/g, '')) % list.length
  return list[seed]!
}
