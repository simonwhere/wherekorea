'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import CycleHistory, { takeOpenFeels } from '@/components/cycle/CycleHistory'
import CycleSummary from '@/components/cycle/CycleSummary'
import DaySheet from '@/components/cycle/DaySheet'
import FertilityGuide from '@/components/cycle/FertilityGuide'
import FirstPeriodCard from '@/components/cycle/FirstPeriodCard'
import IcsExport from '@/components/cycle/IcsExport'
import MonthCalendar from '@/components/cycle/MonthCalendar'
import SettingsLink from '@/components/cycle/SettingsLink'
import { Badge } from '@/components/today/bits'
import { Avatar, Card, SectionTitle, Toggle, useToast } from '@/components/ui'
import { startOfMonth } from '@/lib/dates'
import type { CycleInput } from '@/lib/logic/cycle'
import {
  CLINIC_LABEL,
  cycleFeels,
  cycleHistory,
  cycleLens,
  cycleSummary,
  icsAvailability,
  showsLH,
  strongestTest,
  viewNotice,
} from '@/lib/logic/calendarView'
import { endClinicMode, isClinicMode, setClinicMode } from '@/lib/logic/clinic'
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
  // The home's '지난 주기 컨디션 N개 · 보기' opens that row's list once.
  const [openFeels, setOpenFeels] = useState<ISODate | undefined>(undefined)
  useEffect(() => {
    const v = takeOpenFeels()
    if (v) setOpenFeels(v)
  }, [])

  const { lhTests, cycle, pregnancy, pregnancyTests, cycleNotes, personalLog } = state
  // The pregnancy record lets predictions pause after a pregnancy ended (see
  // cycle.forecastLimit); cycleNotes carries '아직 안 왔어요' for a long-late cycle.
  const input = useMemo<CycleInput>(
    () => ({ periods, lhTests, cycle, pregnancy, cycleNotes }),
    [periods, lhTests, cycle, pregnancy, cycleNotes],
  )
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
  // Her own 오늘 컨디션 chips per cycle — the owner's phone only, whatever she shares.
  const feels = useMemo(
    () => (lens.owner && history ? cycleFeels({ personalLog }, viewer, history.rows, today) : undefined),
    [lens.owner, history, personalLog, viewer, today],
  )
  const ics = useMemo(
    () => (lens.owner ? icsAvailability(input, today, mine, lens.view, lens.pause) : null),
    [lens, input, today, mine.lowPressure],
  )
  const canLog = canLogCycle(state, viewer)
  const sharedWithPartner = canSeeCycleDetails(state, partner.id)
  const clinic = isClinicMode(state)
  // A partner without details keeps their own "hidden" notice, but not the
  // soft one — soft wording is forced by sharing there, not their choice.
  const notice = lens.details || lens.view === 'hidden' ? viewNotice(lens.view, mine) : null

  const select = (date: ISODate) => {
    if (canLog && date <= today) openLog({ date })
    else setSelected(date)
  }

  const toggleClinic = (on: boolean) => {
    update((s) => setClinicMode(s, on, today))
    toast.show(on ? '병원과 함께 준비해요. 날짜 예상과 알림은 쉬어요' : '병원 준비를 마쳤어요. 예상과 알림이 돌아와요')
  }

  return (
    <div>
      <header className="mb-3 flex items-center gap-3 px-1">
        <Avatar member={cycleOwner} size="md" />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-lg font-bold text-ink outline-none">
            <span className="truncate">
              {lens.details ? `${cycleOwner.name}님의 주기` : lens.view === 'hidden' ? '우리의 리듬' : '우리의 주간'}
            </span>
            {/* 병원과 함께 준비 중 (N13): both people see the badge; only the owner has the switch below. */}
            {clinic ? <Badge tone="brand">{CLINIC_LABEL}</Badge> : null}
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

      {canLog && stage === 'preparing' ? (
        <Card className="mb-3 py-1">
          <Toggle
            checked={clinic}
            onChange={toggleClinic}
            label={CLINIC_LABEL}
            description={
              clinic
                ? '날짜 예상과 알림은 쉬고, 기록과 병원 일정만 보여요. 생리를 기록해도 꺼지지 않아요.'
                : '병원에서 시기를 정하는 주기라면 켜 두세요. 예상과 알림이 쉬고, 홈은 다음 병원 일정부터 보여 줘요.'
            }
          />
        </Card>
      ) : null}

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
                  if (isClinicMode(state)) {
                    update((s) => endClinicMode(s))
                    toast.show('병원 준비를 마쳤어요. 예상과 알림이 돌아와요')
                    return
                  }
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
              lens.pause === 'clinic'
                ? '기록한 날만 보여요 · 날짜는 병원 일정을 따라요'
                : !lens.details
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
          feels={feels}
          openFeels={openFeels}
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
