'use client'

import { useCallback, useMemo, useState } from 'react'
import CycleHistory from '@/components/cycle/CycleHistory'
import CycleSummary from '@/components/cycle/CycleSummary'
import DaySheet from '@/components/cycle/DaySheet'
import FertilityGuide from '@/components/cycle/FertilityGuide'
import FirstPeriodCard from '@/components/cycle/FirstPeriodCard'
import IcsExport from '@/components/cycle/IcsExport'
import MonthCalendar from '@/components/cycle/MonthCalendar'
import SettingsLink from '@/components/cycle/SettingsLink'
import { Avatar, Card, SectionTitle, useToast } from '@/components/ui'
import { startOfMonth } from '@/lib/dates'
import type { CycleInput } from '@/lib/logic/cycle'
import {
  cycleHistory,
  cycleLens,
  cycleSummary,
  icsAvailability,
  showsLH,
  strongestTest,
  viewNotice,
} from '@/lib/logic/calendarView'
import { ageFromBirthYear, ttcClockStart } from '@/lib/logic/notifications'
import { canLogCycle, canSeeCycleDetails, discreetFor, settingsFor } from '@/lib/logic/prefs'
import { stampOn } from '@/lib/logic/today'
import { startRestCycle } from '@/lib/logic/ttc'
import { endRestFromHome } from '@/lib/logic/ttcFlow'
import { openLog } from '@/lib/logLauncher'
import { useApp } from '@/lib/store'
import type { ISODate, PregnancyTestResult } from '@/lib/types'

/**
 * 주기 — the cycle owner's calendar. Only the owner logs (tapping a past day
 * opens "+ 기록"); the partner sees details only if the owner shares them,
 * otherwise just the shared "우리의 주간".
 */
export default function CycleTab() {
  const { state, update, today, viewer, partner, cycleOwner } = useApp()
  const toast = useToast()
  const mine = settingsFor(state.settings, viewer)
  const { couple, settings, restCycle, positivePending, periods, stage } = state
  const lens = useMemo(
    () => cycleLens({ couple, settings, restCycle, positivePending, periods, stage }, viewer),
    [couple, settings, restCycle, positivePending, periods, stage, viewer],
  )
  const [month, setMonth] = useState<ISODate>(() => startOfMonth(today))
  const [selected, setSelected] = useState<ISODate | null>(null)
  const closeSheet = useCallback(() => setSelected(null), [])

  const { lhTests, cycle, pregnancy, pregnancyTests } = state
  // The pregnancy record lets predictions pause after a pregnancy ended (see cycle.forecastLimit).
  const input = useMemo<CycleInput>(() => ({ periods, lhTests, cycle, pregnancy }), [periods, lhTests, cycle, pregnancy])
  const tests = useMemo(() => {
    const by: Record<ISODate, PregnancyTestResult[]> = {}
    for (const t of pregnancyTests) (by[t.date] ??= []).push(t.result)
    const out: Record<ISODate, PregnancyTestResult> = {}
    for (const [d, rs] of Object.entries(by)) out[d] = strongestTest(rs)!
    return out
  }, [pregnancyTests])

  const hasData = periods.length > 0
  const summary = useMemo(() => (hasData ? cycleSummary(input, today, lens.view, lens) : null), [hasData, input, today, lens])
  const ttcStart = ttcClockStart(state)
  const history = useMemo(
    () => (lens.details ? cycleHistory(input, today, ttcStart) : null),
    [lens.details, input, today, ttcStart],
  )
  const ics = useMemo(
    () => (lens.owner ? icsAvailability(input, today, mine, lens.view, lens.pause) : null),
    [lens, input, today, mine.lowPressure],
  )
  const canLog = canLogCycle(state, viewer)
  const sharedWithPartner = canSeeCycleDetails(state, partner.id)
  // A partner without details keeps their own "hidden" notice, but not the
  // soft one — soft wording is forced by sharing there, not their choice.
  const notice = lens.details || lens.view === 'hidden' ? viewNotice(lens.view, mine) : null

  const select = (date: ISODate) => {
    if (canLog && date <= today) openLog({ date })
    else setSelected(date)
  }

  return (
    <div>
      <header className="mb-3 flex items-center gap-3 px-1">
        <Avatar member={cycleOwner} size="md" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-ink">
            {lens.details ? `${cycleOwner.name}님의 주기` : lens.view === 'hidden' ? '우리의 리듬' : '우리의 주간'}
          </h1>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-3">
            {lens.owner ? (
              <>
                <span>
                  {partner.name}님에게는 {sharedWithPartner ? '기록도 함께 보여요' : '우리의 주간만 보여요'}
                </span>
                <SettingsLink className="-my-3" anchor="share">
                  바꾸기
                </SettingsLink>
              </>
            ) : lens.details ? (
              `${cycleOwner.name}님이 기록하고 함께 봐요`
            ) : lens.view === 'hidden' ? (
              // Fertile-day info is off for this viewer: don't name 우리의 주간 either.
              `주기 기록은 ${cycleOwner.name}님이 해요`
            ) : (
              `${cycleOwner.name}님이 공유한 우리의 주간만 보여요`
            )}
          </p>
        </div>
      </header>

      {notice ? (
        <p className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-surface-2 py-0.5 pl-3 pr-2 text-xs text-ink-2">
          <span className="min-w-0">
            <span aria-hidden>{notice.icon} </span>
            {notice.text}
          </span>
          <SettingsLink className="px-1" anchor="alerts">
            바꾸기
          </SettingsLink>
        </p>
      ) : null}

      {summary ? (
        <CycleSummary
          summary={summary}
          lens={lens}
          today={today}
          onLog={canLog ? () => openLog({ date: today }) : undefined}
          onRest={
            canLog
              ? () => {
                  update((s) => startRestCycle(s, today, 'rest'))
                  toast.show('이번 주기는 쉬어요 · 다음 생리를 기록하면 다시 켜져요')
                }
              : undefined
          }
          onResume={
            canLog
              ? () => {
                  // Like the home's [다시 켜기]: turning a vaccine rest off is an answer too,
                  // so the dismissed vaccine suggestion doesn't come straight back.
                  update((s) => endRestFromHome(s, today, stampOn(today)))
                  toast.show('다시 켰어요')
                }
              : undefined
          }
        />
      ) : lens.owner ? (
        <FirstPeriodCard view={lens.view} />
      ) : (
        <Card tone="muted" as="div">
          <p className="text-sm font-bold text-ink">아직 주기 기록이 없어요</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            {cycleOwner.name}님이 기록을 시작하면 {lens.view === 'hidden' ? '여기에 보여요.' : '우리의 주간 예상이 여기에 보여요.'}
          </p>
        </Card>
      )}

      {lens.details || lens.view !== 'hidden' ? (
        <>
          <SectionTitle
            sub={
              !lens.details
                ? '우리의 주간만 보여요'
                : lens.view === 'hidden'
                  ? '생리와 생리 예정일만 보여요'
                  : '모든 날짜는 참고용 예상이에요'
            }
          >
            달력
          </SectionTitle>
          <MonthCalendar input={input} tests={tests} month={month} onMonthChange={setMonth} today={today} lens={lens} onSelect={select} />
        </>
      ) : null}

      {history ? (
        <CycleHistory
          history={history}
          today={today}
          showLH={showsLH(lens)}
          onSelect={canLog ? (date) => openLog({ date, kind: 'period' }) : undefined}
        />
      ) : null}

      {ics ? (
        <div className="mt-6">
          <IcsExport availability={ics} view={lens.view} discreet={discreetFor(state.settings, viewer)} coupleId={state.couple.inviteCode} />
        </div>
      ) : null}

      <FertilityGuide view={lens.view} ownerName={cycleOwner.name} ownerAge={ageFromBirthYear(cycleOwner.birthYear, today)} />

      <DaySheet date={selected} onClose={closeSheet} lens={lens} />
    </div>
  )
}
