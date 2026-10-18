'use client'

// 설정 › 첫 화면 (Next B) — what the top of 오늘 and the 우리 tab show:
//   · 표지 사진: change it, or (my phone only) show the drawing instead
//   · 'N년 전 오늘': off unless the couple turns it on, with the filter rules in one line —
//     while preparing the switch sits in the 기록장 (우리 tab) instead (N27)
//   · 기념일 알림: off by default while preparing and then on the day only, D-7 · 당일
//     by default later (N27); an explicit choice is stored and wins in every stage
//   · '시도 N번째 주기' in the cycle history: hidden by default (neutral wording)
// Each switch is read through lib/logic/settings.ts (memoriesOn …); unset = default.

import { useCallback, useState } from 'react'
import CoverSheet from '@/components/cover/CoverSheet'
import { Card, Toggle, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { coverView, setHideCover } from '@/lib/logic/cover'
import { canLogCycle, canSeeCycleDetails } from '@/lib/logic/prefs'
import { anniversaryAlertsOn, memoriesOn, setAnniversaryAlerts, setCoupleFlag, showTryCountOn } from '@/lib/logic/settings'
import { useApp } from '@/lib/store'
import { SettingsSection } from './bits'

export default function HomeSection() {
  const { state, update, today, viewer, partner } = useApp()
  const toast = useToast()
  const preparing = state.stage === 'preparing'
  const view = coverView(state, viewer, today)
  const [coverOpen, setCoverOpen] = useState(false)
  const openCover = useCallback(() => setCoverOpen(true), [])
  const closeCover = useCallback(() => setCoverOpen(false), [])

  return (
    <SettingsSection id="home" title="첫 화면">
      <div className="grid gap-2">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
                <Icon name="img" className="h-[18px] w-[18px] text-ink-2" />
                표지 사진
              </h3>
              {view.photo ? null : <p className="mt-0.5 text-xs leading-relaxed text-ink-3">아직 기본 그림이에요</p>}
            </div>
            <button
              type="button"
              onClick={openCover}
              className="-mr-2 -mt-2 h-11 shrink-0 rounded-xl px-3 text-xs font-semibold text-brand-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              {view.photo ? '바꾸기' : '사진 걸기'}
            </button>
          </div>
          <div className="mt-1 border-t border-line pt-1">
            {/* An auto-hidden photo (quiet weeks) reads as ON; turning it off then means "show it" (false). */}
            <Toggle
              checked={view.hidden || view.autoHidden}
              onChange={(next) => update((s) => setHideCover(s, viewer, next ? true : view.quiet ? false : undefined))}
              label={
                <>
                  내 화면에서는 그림만 보기 <span className="text-xs font-normal text-ink-3">(내 폰만)</span>
                </>
              }
            />
          </div>
          <CoverSheet open={coverOpen} onClose={closeCover} />
        </Card>

        <Card>
          {preparing ? null : (
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
            />
          )}
          <div className={preparing ? undefined : 'mt-1 border-t border-line pt-1'}>
            <Toggle
              checked={anniversaryAlertsOn(state.settings, state.stage)}
              onChange={(v) => {
                update((s) => setAnniversaryAlerts(s, v))
                toast.show(v ? '기념일 알림을 켰어요' : '기념일 알림을 껐어요')
              }}
              label={
                <>
                  기념일 알림 <span className="text-xs font-normal text-ink-3">(두 사람 모두)</span>
                </>
              }
            />
          </div>
        </Card>

        {/* The cycle history is the owner's record: only the owner decides whether it counts the tries. */}
        {preparing && canLogCycle(state, viewer) ? (
          <Card>
            <Toggle
              checked={showTryCountOn(state.settings)}
              onChange={(v) => {
                update((s) => setCoupleFlag(s, 'showTryCount', v))
                toast.show(v ? '주기 기록에 몇 번째 주기인지 보여요' : '주기 기록에서 횟수를 숨겼어요')
              }}
              label="주기 기록에 몇 번째 주기인지 보이기"
              description={canSeeCycleDetails(state, partner.id) ? `자세히 공유 중이라 ${partner.name}님 화면에도 보여요.` : undefined}
            />
          </Card>
        ) : null}
      </div>
    </SettingsSection>
  )
}
