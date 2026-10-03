// Now 3 · '이번 주 우리 둘' on both homes (N21), the three-level share picker and
// the partner preview (N23), and the weekly check-in's 되돌리기 (N24).
//
// The demo couple: 민수 'a' (partner) · 지은 'b' (cycle owner). On Monday of
// T0's week 민수 picked this week's first option and said [했어요] on Thursday,
// so 지은's home has '이번 주 민수님' and her [고마워요] is still hers to give.

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CycleTab from '@/components/tabs/CycleTab'
import SettingsTab from '@/components/tabs/SettingsTab'
import TodayTab from '@/components/tabs/TodayTab'
import { receivedReply } from '@/components/today/model'
import { addDays } from '@/lib/dates'
import { activeWeeklyItems, isDone, weeklyDone } from '@/lib/logic/checks'
import { markRead, weekThanksNoticeKey } from '@/lib/logic/notifications'
import { startPregnancy } from '@/lib/logic/pregnancy'
import { SIGNALS_PER_DAY, sendSignal } from '@/lib/logic/signals'
import { endPregnancy } from '@/lib/logic/today'
import { partnerWeekSummary, weekDaysSoFar, weekDone, weekOf, weekOptions, weekPick, weekThanked } from '@/lib/logic/weekTogether'
import { MOCK_SYNC_KEY } from '@/lib/sync/mockTransport'
import type { AppState, ISODate } from '@/lib/types'
import { demoState, pageText, renderApp, seedApp, stateProbe, withProviders } from '../setup'

const T0: ISODate = '2026-10-03' // a Saturday: 민수's Thursday [했어요] has happened
const PARTNER = 'a' as const
const OWNER = 'b' as const

/** The demo with nothing of 민수's in T0's week: no pick, no checks, no signals, no ticks. */
function nothingWeek(today: ISODate = T0): AppState {
  const s = demoState(today)
  const days = new Set(weekDaysSoFar(weekOf(today), today))
  const checkLog: AppState['checkLog'] = {}
  for (const [d, byMember] of Object.entries(s.checkLog)) {
    if (!days.has(d)) {
      checkLog[d] = byMember
      continue
    }
    const { [PARTNER]: _his, ...rest } = byMember
    checkLog[d] = rest
  }
  const decisions = Object.fromEntries(Object.entries(s.decisions ?? {}).filter(([k]) => !k.startsWith('week-')))
  const planDone = Object.fromEntries(Object.entries(s.planDone).filter(([, v]) => !(v?.by === PARTNER && days.has(String(v.at)))))
  return {
    ...s,
    checkLog,
    decisions,
    planDone,
    customTasks: s.customTasks.map((c) => (c.doneBy === PARTNER && days.has(String(c.doneAt)) ? { ...c, doneAt: undefined, doneBy: undefined } : c)),
    notifications: s.notifications.filter((n) => !(n.from === PARTNER && n.key?.startsWith('signal:'))),
  }
}

/** The same couple in the 42-day quiet after a pregnancy ended yesterday. */
function lossQuiet(): AppState {
  const s = demoState(T0)
  const pregnant = startPregnancy(s, addDays(T0, -50), addDays(T0, -15))
  expect(pregnant.stage).toBe('pregnant')
  return endPregnancy(pregnant, addDays(T0, -1))
}

const usLine = () => document.getElementById('us-line')!

afterEach(() => vi.restoreAllMocks())

describe('우리 한 줄 on her home: 이번 주 민수님 + [고마워요]', () => {
  it('shows what he did this week (at most three) and takes one [고마워요] a week', () => {
    const probe = stateProbe()
    const state = demoState(T0)
    const summary = partnerWeekSummary(state, T0, PARTNER)
    expect(summary.length).toBeGreaterThan(0)
    expect(summary.length).toBeLessThanOrEqual(3)
    renderApp(
      <>
        <TodayTab onNavigate={() => {}} />
        <probe.Probe />
      </>,
      { state, viewer: OWNER, today: T0 },
    )
    const block = within(usLine()).getByText('이번 주 민수님').closest('[data-week-summary]') as HTMLElement
    expect(block).toBeTruthy()
    const items = within(block).getAllByRole('listitem')
    expect(items.map((li) => li.textContent?.trim())).toEqual(summary.map((d) => d.text))
    // His pick shows only once done — as its done text, never the pick itself.
    const pick = weekPick(state, weekOf(T0), PARTNER)!
    expect(block.textContent).toContain(pick.doneText)
    expect(block.textContent).not.toContain(pick.text)
    // Never a zero or '안 했어요'.
    expect(block.textContent).not.toMatch(/\b0\b|안 했어요/)

    fireEvent.click(within(block).getByRole('button', { name: /고마워요/ }))
    expect(weekThanked(probe.current.state!, OWNER, weekOf(T0))).toBe(T0)
    // One 🔔 for him, with the fixed words, keyed by the week (notifications.sendWeekThanks).
    const thanks = probe.current.state!.notifications.filter((n) => n.to === PARTNER && n.from === OWNER && n.body === '이번 주 고마워요')
    expect(thanks).toHaveLength(1)
    expect(thanks[0]).toMatchObject({ kind: 'cheer', title: '💛 지은님이 고마워했어요', key: weekThanksNoticeKey(T0, OWNER) })
    // Once a week: the button gives way to a quiet line.
    expect(within(block).queryByRole('button', { name: /고마워요/ })).toBeNull()
    expect(block.textContent).toContain('고마워요를 전했어요')
  })

  it('a week he did nothing in shows no line and no button at all (never a 0)', () => {
    const state = nothingWeek()
    expect(partnerWeekSummary(state, T0, PARTNER)).toEqual([])
    renderApp(<TodayTab onNavigate={() => {}} />, { state, viewer: OWNER, today: T0 })
    expect(usLine().querySelector('[data-week-summary]')).toBeNull()
    expect(within(usLine()).queryByText(/이번 주 민수님/)).toBeNull()
    expect(within(usLine()).queryByRole('button', { name: /고마워요/ })).toBeNull()
  })

  it('rests in the quiet after a loss: no summary, no [고마워요] — though his [했어요] is in the record', () => {
    const state = lossQuiet()
    expect(weekDone(state, weekOf(T0), PARTNER)).toBeTruthy()
    expect(partnerWeekSummary(state, T0, PARTNER)).toEqual([])
    renderApp(<TodayTab onNavigate={() => {}} />, { state, viewer: OWNER, today: T0 })
    expect(usLine().querySelector('[data-week-summary]')).toBeNull()
    expect(within(usLine()).queryByRole('button', { name: /고마워요/ })).toBeNull()
  })

  it('his home has no ‘이번 주 지은님’ line: the summary is hers to read about him', () => {
    renderApp(<TodayTab onNavigate={() => {}} />, { state: demoState(T0), viewer: PARTNER, today: T0 })
    expect(usLine().querySelector('[data-week-summary]')).toBeNull()
  })
})

describe('우리 한 줄: 신호 보내기 out of 더 보기, and his reply on her home', () => {
  it('the chip row sends with one tap, keeps the daily limit, and 더 보기 no longer holds the card', () => {
    const probe = stateProbe()
    renderApp(
      <>
        <TodayTab onNavigate={() => {}} />
        <probe.Probe />
      </>,
      { state: nothingWeek(), viewer: OWNER, today: T0 },
    )
    const row = within(usLine()).getByRole('group', { name: '신호 보내기' })
    const chips = within(row).getAllByRole('button')
    // Her set: '이번 달은 아니었어요' is the cycle owner's; a rest signal is always there.
    expect(chips.map((c) => c.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('이번 달은 아니었어요')]))
    expect(chips.some((c) => /푹 쉬어요/.test(c.textContent ?? ''))).toBe(true)
    const before = probe.current.state!.notifications.length
    fireEvent.click(chips[1]!)
    expect(probe.current.state!.notifications.length).toBe(before + 1)
    expect(within(usLine()).getByText(`오늘 ${SIGNALS_PER_DAY - 1}번 더`)).toBeTruthy()
    // 더 보기 has no '우리 신호' card any more.
    const more = screen.getByText('더 보기').closest('details')!
    expect(within(more).queryByText('우리 신호')).toBeNull()
  })

  it('at the daily limit every chip is disabled', () => {
    let s = nothingWeek()
    for (let i = 0; i < SIGNALS_PER_DAY; i++) s = sendSignal(s, OWNER, PARTNER, 'rest', T0, `${T0}T0${i}:00:00`)
    renderApp(<TodayTab onNavigate={() => {}} />, { state: s, viewer: OWNER, today: T0 })
    const row = within(usLine()).getByRole('group', { name: '신호 보내기' })
    expect(within(row).getAllByRole('button').every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
    expect(within(usLine()).getByText('오늘은 다 보냈어요')).toBeTruthy()
  })

  it('his reply to her signal shows in 우리 한 줄 (who, to what, the words) until she asks something new', () => {
    let s = nothingWeek()
    s = sendSignal(s, OWNER, PARTNER, 'comfort', T0, `${T0}T09:00:00`)
    s = sendSignal(s, PARTNER, OWNER, 'here', T0, `${T0}T09:30:00`)
    expect(receivedReply(s, OWNER, T0)?.reply.id).toBe('here')
    expect(receivedReply(s, OWNER, T0)?.answered?.id).toBe('comfort')
    renderApp(<TodayTab onNavigate={() => {}} />, { state: s, viewer: OWNER, today: T0 })
    const line = usLine().querySelector('[data-received-reply]') as HTMLElement
    expect(line).toBeTruthy()
    expect(line.textContent).toContain('민수님이 답했어요')
    expect(line.textContent).toContain('위로가 필요해요')
    expect(line.textContent).toContain('옆에 있을게요')
    cleanup()
    // A newer signal of hers: that answer belonged to the previous question.
    const asked = sendSignal(s, OWNER, PARTNER, 'clinic', T0, `${T0}T10:00:00`)
    expect(receivedReply(asked, OWNER, T0)).toBeUndefined()
    // Once read, it passes with the reply window; unread (her phone was closed), it waits for her.
    const seen = markRead(s, OWNER)
    expect(receivedReply(seen, OWNER, addDays(T0, 3))).toBeUndefined()
    expect(receivedReply(seen, OWNER, addDays(T0, 2))?.reply.id).toBe('here')
    expect(receivedReply(s, OWNER, addDays(T0, 3))?.reply.id).toBe('here')
  })

  it('a reply applied days later (her phone closed) still shows on her home, dated', () => {
    let s = nothingWeek()
    s = sendSignal(s, OWNER, PARTNER, 'comfort', T0, `${T0}T09:00:00`)
    s = sendSignal(s, PARTNER, OWNER, 'here', addDays(T0, 2), `${addDays(T0, 2)}T08:00:00`)
    renderApp(<TodayTab onNavigate={() => {}} />, { state: s, viewer: OWNER, today: addDays(T0, 5) })
    const line = usLine().querySelector('[data-received-reply]') as HTMLElement
    expect(line).toBeTruthy()
    expect(line.textContent).toContain('옆에 있을게요')
    // Older than 그저께: the date, not '그저께'.
    expect(line.textContent).not.toContain('그저께')
    expect(line.textContent).toMatch(/\d+월 \d+일/)
  })
})

describe('his in-app home: the same 이번 주 우리 둘 block as the link', () => {
  it('three picks → [이번 주 이걸로] → [했어요] (with 되돌리기); the pick is his alone until done', () => {
    const probe = stateProbe()
    const state = nothingWeek()
    const options = weekOptions(state, T0, PARTNER)
    expect(options).toHaveLength(3)
    renderApp(
      <>
        <TodayTab onNavigate={() => {}} />
        <probe.Probe />
      </>,
      { state, viewer: PARTNER, today: T0 },
    )
    const block = screen.getByRole('region', { name: '이번 주 우리 둘' })
    const picks = within(block).getAllByRole('button').filter((b) => b.hasAttribute('data-week-option'))
    expect(picks.map((b) => b.textContent?.trim())).toEqual(options.map((o) => o.text))

    fireEvent.click(picks[1]!)
    expect(weekPick(probe.current.state!, weekOf(T0), PARTNER)?.id).toBe(options[1]!.id)
    fireEvent.click(within(block).getByRole('button', { name: /했어요/ }))
    expect(weekDone(probe.current.state!, weekOf(T0), PARTNER)).toBe(T0)
    expect(within(block).getByRole('status').textContent).toContain(options[1]!.doneText)

    // 되돌리기 takes [했어요] back; the pick stays.
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }))
    expect(weekDone(probe.current.state!, weekOf(T0), PARTNER)).toBeUndefined()
    expect(weekPick(probe.current.state!, weekOf(T0), PARTNER)?.id).toBe(options[1]!.id)
  })

  it('keeps her thanks for the rest of the week and shows 내 준비 when there is something to say', () => {
    const probe = stateProbe()
    seedApp({ state: demoState(T0), viewer: OWNER, today: T0 })
    const { unmount } = render(
      withProviders(
        <>
          <TodayTab onNavigate={() => {}} />
          <probe.Probe />
        </>,
      ),
    )
    fireEvent.click(within(usLine()).getByRole('button', { name: /고마워요/ }))
    const thanked = probe.current.state!
    unmount()

    renderApp(<TodayTab onNavigate={() => {}} />, { state: thanked, viewer: PARTNER, today: addDays(T0, 1) })
    const block = screen.getByRole('region', { name: '이번 주 우리 둘' })
    expect(block.textContent).toContain('지은님이 고마워했어요 (토)')
    // The line names her once: no '지은님에게서 ·' label in front of '지은님이 고마워했어요'.
    expect(block.textContent).not.toContain('지은님에게서')
    expect(block.textContent).toContain('내 준비')
  })

  it('is not on her home, and rests in the quiet after a loss', () => {
    renderApp(<TodayTab onNavigate={() => {}} />, { state: demoState(T0), viewer: OWNER, today: T0 })
    expect(screen.queryByRole('region', { name: '이번 주 우리 둘' })).toBeNull()
    cleanup()
    renderApp(<TodayTab onNavigate={() => {}} />, { state: lossQuiet(), viewer: PARTNER, today: T0 })
    expect(screen.queryByRole('region', { name: '이번 주 우리 둘' })).toBeNull()
    expect(pageText()).not.toContain('이번 주 내가 맡을 것')
  })
})

describe('the weekly check-in: 술 쉬기 · 이번 주 지켰어요? and 되돌리기 (N24)', () => {
  it('reads as a question about the week, and taking it back can be undone on exactly those days', () => {
    const probe = stateProbe()
    const state = demoState(T0)
    const weekly = activeWeeklyItems(state, PARTNER)
    expect(weekly.length).toBeGreaterThan(0)
    const item = weekly[0]!
    // Checked in on T0 so the row is on the home, ticked.
    const checked: AppState = {
      ...state,
      checkLog: { ...state.checkLog, [T0]: { ...state.checkLog[T0], [PARTNER]: [...(state.checkLog[T0]?.[PARTNER] ?? []), item.id] } },
    }
    renderApp(
      <>
        <TodayTab onNavigate={() => {}} />
        <probe.Probe />
      </>,
      { state: checked, viewer: PARTNER, today: T0 },
    )
    const row = screen.getAllByRole('checkbox').find((b) => /이번 주 지켰어요\?/.test(b.textContent ?? ''))!
    expect(row).toBeTruthy()
    expect(row.getAttribute('aria-checked')).toBe('true')
    expect(row.textContent).not.toContain('이번 주 금주')

    fireEvent.click(row)
    expect(weeklyDone(probe.current.state!, PARTNER, item.id, T0)).toBe(false)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '되돌리기' }))
    })
    expect(isDone(probe.current.state!, PARTNER, T0, item.id)).toBe(true)
  })
})

describe('설정 › 공유 범위: three levels, the owner’s to choose', () => {
  const openShare = () =>
    fireEvent.click(within(screen.getByRole('navigation', { name: '설정 목차' })).getByRole('button', { name: '공유' }))

  it('writes the level she picks — narrowing at once, widening after the consent for that level', () => {
    const probe = stateProbe()
    renderApp(
      <>
        <SettingsTab />
        <probe.Probe />
      </>,
      { state: demoState(T0), viewer: OWNER, today: T0 },
    )
    openShare()
    const share = document.getElementById('share')!
    expect(within(share).getAllByRole('radio')).toHaveLength(3)
    expect(probe.current.state!.settings.shareLevel).toBe('week')

    // 날짜 없음: narrowing applies at once.
    fireEvent.click(within(share).getByRole('radio', { name: /날짜 없음/ }))
    expect(probe.current.state!.settings.shareLevel).toBe('none')

    // 우리의 주간 again: a widening, so the notice for that level comes first.
    fireEvent.click(within(share).getByRole('radio', { name: /우리의 주간/ }))
    expect(probe.current.state!.settings.shareLevel).toBe('none')
    expect(within(share).getByText('‘우리의 주간’ 공유에 동의할까요?')).toBeTruthy()
    fireEvent.click(within(share).getByRole('button', { name: '동의하고 보여 줄게요' }))
    expect(probe.current.state!.settings.shareLevel).toBe('week')

    // 자세히: the details consent, then the level.
    fireEvent.click(within(share).getByRole('radio', { name: /자세히/ }))
    expect(within(share).getByText('자세한 기록 공유에 동의할까요?')).toBeTruthy()
    fireEvent.click(within(share).getByRole('button', { name: '동의하고 보여 줄게요' }))
    expect(probe.current.state!.settings.shareLevel).toBe('details')

    // Cancel keeps what was there.
    fireEvent.click(within(share).getByRole('radio', { name: /날짜 없음/ }))
    fireEvent.click(within(share).getByRole('radio', { name: /우리의 주간/ }))
    fireEvent.click(within(share).getByRole('button', { name: '그대로 둘게요' }))
    expect(probe.current.state!.settings.shareLevel).toBe('none')
  })

  it('every level says in one line exactly what he sees', () => {
    renderApp(<SettingsTab />, { state: demoState(T0), viewer: OWNER, today: T0 })
    openShare()
    const share = document.getElementById('share')!
    const line = (name: RegExp) => within(share).getByRole('radio', { name }).closest('label')?.textContent ?? ''
    expect(line(/날짜 없음/)).toMatch(/민수님 화면에 날짜와 띠가 없어요/)
    expect(line(/우리의 주간/)).toMatch(/‘우리의 주간’ 예상 띠/)
    expect(line(/자세히/)).toMatch(/배테기·임테기 결과까지/)
    expect(share.textContent).toContain('생리일·테스트 결과는 나만 봐요')
    expect(share.textContent).toContain('생리일, 배테기·임테기 결과까지 민수님 화면에 보여요')
  })

  it('민수 reads the level, read-only', () => {
    const s = demoState(T0)
    renderApp(<SettingsTab />, { state: { ...s, settings: { ...s.settings, shareLevel: 'none' } }, viewer: PARTNER, today: T0 })
    openShare()
    const share = document.getElementById('share')!
    expect(within(share).queryAllByRole('radio')).toHaveLength(0)
    expect(share.textContent).toContain('날짜 없이 함께해요')
  })
})

describe('설정 › 연결: 민수님 화면 미리보기', () => {
  it('renders his page for today from a snapshot built here — nothing sent, nothing stored', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new Error('no network in a preview')))
    renderApp(<SettingsTab />, { state: demoState(T0), viewer: OWNER, today: T0 })
    fireEvent.click(within(screen.getByRole('navigation', { name: '설정 목차' })).getByRole('button', { name: '연결' }))
    const before = window.localStorage.getItem(MOCK_SYNC_KEY)
    fireEvent.click(screen.getByRole('button', { name: /미리보기 열기/ }))
    const frame = document.querySelector('[data-partner-preview]') as HTMLElement
    expect(frame).toBeTruthy()
    const page = within(frame).getByLabelText('민수님 화면 미리보기')
    expect(page.hasAttribute('inert')).toBe(true)
    // His own things are there: the week block and his checks.
    expect(within(page).getByLabelText('이번 주 우리 둘')).toBeTruthy()
    expect(page.textContent).toContain('오늘 할 일')
    expect(page.textContent).toContain('여기서는 아무것도 보내지 않아요')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(MOCK_SYNC_KEY)).toBe(before)
  })

  it('follows her share level: with 날짜 없음 his preview has no 우리의 주간 band', () => {
    const s = demoState(T0)
    renderApp(<SettingsTab />, { state: { ...s, settings: { ...s.settings, shareLevel: 'none' } }, viewer: OWNER, today: T0 })
    fireEvent.click(within(screen.getByRole('navigation', { name: '설정 목차' })).getByRole('button', { name: '연결' }))
    fireEvent.click(screen.getByRole('button', { name: /미리보기 열기/ }))
    const frame = document.querySelector('[data-partner-preview]') as HTMLElement
    expect(frame.textContent).not.toMatch(/우리의 주간|가임기|배란/)
    // And the list of what the link carries says the band does not go.
    expect(pageText()).toContain('우리의 주간 띠와 날짜 (공유 범위: 날짜 없음)')
  })

  it('is the owner’s: 민수 has no preview button', () => {
    renderApp(<SettingsTab />, { state: demoState(T0), viewer: PARTNER, today: T0 })
    fireEvent.click(within(screen.getByRole('navigation', { name: '설정 목차' })).getByRole('button', { name: '연결' }))
    expect(screen.queryByRole('button', { name: /미리보기 열기/ })).toBeNull()
    // And no '링크를 연 날' count anywhere on her screens or his (positioning §6).
    expect(pageText()).not.toMatch(/링크를 연 날|열어 본 날/)
  })
})

describe('주기 tab under 날짜 없음', () => {
  const none = (): AppState => {
    const s = demoState(T0)
    return { ...s, settings: { ...s.settings, shareLevel: 'none' } }
  }

  it('his tab: no window words, no dates, and no frequency line (that stays hers)', () => {
    renderApp(<CycleTab />, { state: none(), viewer: PARTNER, today: T0 })
    const text = pageText()
    expect(text).not.toMatch(/우리의 주간|가임기|배란/)
    expect(text).not.toContain('2~3일에 한 번 편하게')
    // His notice points to 공유 범위 (hers to change), not to his alerts.
    expect(screen.getByText(/날짜 없이 함께 준비해요/)).toBeTruthy()
    expect(screen.getByRole('link', { name: '보기' }).getAttribute('href')).toBe('#share')
  })

  it('her tab says what he sees, and her own view is not hidden by it', () => {
    renderApp(<CycleTab />, { state: none(), viewer: OWNER, today: T0 })
    expect(screen.getByText('민수님에게는 날짜가 보이지 않아요')).toBeTruthy()
    expect(pageText()).not.toContain('날짜 없이 함께 준비해요')
  })
})
