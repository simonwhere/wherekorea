'use client'

import { useCallback, useMemo, useState } from 'react'
import CycleSummary from '@/components/cycle/CycleSummary'
import DaySheet from '@/components/cycle/DaySheet'
import FertilityGuide from '@/components/cycle/FertilityGuide'
import FirstPeriodCard from '@/components/cycle/FirstPeriodCard'
import IcsExport from '@/components/cycle/IcsExport'
import MonthCalendar from '@/components/cycle/MonthCalendar'
import PeriodHistory from '@/components/cycle/PeriodHistory'
import SettingsLink from '@/components/cycle/SettingsLink'
import { Avatar, SectionTitle } from '@/components/ui'
import { startOfMonth } from '@/lib/dates'
import type { CycleInput } from '@/lib/logic/cycle'
import { cycleSummary, fertilityView, icsAvailability, viewNotice } from '@/lib/logic/calendarView'
import { ageFromBirthYear } from '@/lib/logic/notifications'
import { useApp } from '@/lib/store'
import type { ISODate } from '@/lib/types'
import { discreetFor } from '@/lib/logic/prefs'
import { settingsFor } from '@/lib/logic/prefs'

/** 달력 — the couple's shared cycle calendar. Both partners can view and log. */
export default function CycleTab() {
  const { state, today, viewer, me, cycleOwner } = useApp()
  const mine = settingsFor(state.settings, viewer)
  const view = fertilityView(mine, viewer, cycleOwner.id)
  const [month, setMonth] = useState<ISODate>(() => startOfMonth(today))
  const [selected, setSelected] = useState<ISODate | null>(null)
  const closeSheet = useCallback(() => setSelected(null), [])

  const { periods, lhTests, cycle, pregnancy } = state
  // The pregnancy record lets predictions pause after a pregnancy ended (see cycle.forecastLimit).
  const input = useMemo<CycleInput>(() => ({ periods, lhTests, cycle, pregnancy }), [periods, lhTests, cycle, pregnancy])
  const hasData = periods.length > 0
  const summary = useMemo(() => (hasData ? cycleSummary(input, today, view) : null), [hasData, input, today, view])
  const ics = useMemo(
    () => icsAvailability(input, today, mine, view),
    [input, today, state.settings, viewer, view],
  )
  const isOwner = me.id === cycleOwner.id

  return (
    <div>
      <header className="mb-3 flex items-center gap-3 px-1">
        <Avatar member={cycleOwner} size="md" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-ink">{cycleOwner.name}님의 주기</h1>
          <p className="text-xs text-ink-3">
            {isOwner ? '두 사람이 함께 보고 기록해요' : `${cycleOwner.name}님 대신 기록해도 돼요 · 두 사람 화면에 함께 보여요`}
          </p>
        </div>
      </header>

      <ViewNotice notice={viewNotice(view, mine)} />

      {summary ? (
        <CycleSummary summary={summary} view={view} today={today} onLogToday={() => setSelected(today)} />
      ) : (
        <FirstPeriodCard view={view} />
      )}

      <SectionTitle sub={view === 'hidden' ? '생리와 생리 예정일만 보여요' : '모든 예측은 참고용 예상이에요'}>달력</SectionTitle>
      <MonthCalendar
        input={input}
        month={month}
        onMonthChange={setMonth}
        today={today}
        view={view}
        onSelect={setSelected}
      />

      <div className="mt-3">
        <IcsExport availability={ics} view={view} discreet={discreetFor(state.settings, viewer)} coupleId={state.couple.inviteCode} />
      </div>

      <PeriodHistory periods={periods} today={today} onSelect={setSelected} />

      <FertilityGuide view={view} ownerName={cycleOwner.name} ownerAge={ageFromBirthYear(cycleOwner.birthYear, today)} />

      <DaySheet date={selected} onClose={closeSheet} view={view} />
    </div>
  )
}

function ViewNotice({ notice }: { notice: { icon: string; text: string } | null }) {
  if (!notice) return null
  return (
    <p className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-surface-2 py-0.5 pl-3 pr-2 text-xs text-ink-2">
      <span className="min-w-0">
        <span aria-hidden>{notice.icon} </span>
        {notice.text}
      </span>
      <SettingsLink className="px-1">바꾸기</SettingsLink>
    </p>
  )
}
