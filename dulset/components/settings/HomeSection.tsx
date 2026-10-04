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
import { MEMORIES_PROMISE, coverView, setHideCover } from '@/lib/logic/cover'
import { canLogCycle, canSeeCycleDetails } from '@/lib/logic/prefs'
import { anniversaryAlertsOn, memoriesOn, setAnniversaryAlerts, setCoupleFlag, showTryCountOn } from '@/lib/logic/settings'
import { useApp } from '@/lib/store'
import { SettingsSection } from './bits'

export default function HomeSection() {
  const { state, update, today, viewer, me, partner, cycleOwner } = useApp()
  const toast = useToast()
  const preparing = state.stage === 'preparing'
  const view = coverView(state, viewer, today)
  const [coverOpen, setCoverOpen] = useState(false)
  const openCover = useCallback(() => setCoverOpen(true), [])
  const closeCover = useCallback(() => setCoverOpen(false), [])

  return (
    <SettingsSection id="home" title="첫 화면" sub="오늘 화면 맨 위의 표지와 우리 탭에 보이는 것">
      <div className="grid gap-2">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
                <Icon name="img" className="h-[18px] w-[18px] text-ink-2" />
                표지 사진
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
                {view.photo
                  ? '두 사람의 오늘 화면 맨 위에 걸려 있어요. 사진은 이 폰에만 저장돼요.'
                  : '아직 기본 그림이에요. 사진은 이 폰에만 저장돼요.'}
              </p>
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
              description={`사진 대신 기본 그림이 보여요. ${partner.name}님 화면은 그대로예요.`}
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
              description={MEMORIES_PROMISE}
            />
          )}
          <div className={preparing ? undefined : 'mt-1 border-t border-line pt-1'}>
            <Toggle
              checked={anniversaryAlertsOn(state.settings, state.stage)}
              onChange={(v) => {
                update((s) => setAnniversaryAlerts(s, v))
                toast.show(v ? '기념일 알림을 켰어요' : '기념일 알림을 껐어요 · 우리 탭 기념일에는 그대로 보여요')
              }}
              label={
                <>
                  기념일 알림 <span className="text-xs font-normal text-ink-3">(두 사람 모두)</span>
                </>
              }
              description={
                preparing
                  ? '준비하는 동안은 기본으로 꺼져 있어요. 켜면 기념일 당일에 두 사람 알림함과 첫 화면에 한 줄씩 보여요. 꺼도 우리 탭의 기념일과 D-day는 그대로예요.'
                  : '일주일 전과 당일에 두 사람 알림함에 한 줄씩 와요. 꺼도 우리 탭의 기념일과 D-day는 그대로예요.'
              }
            />
          </div>
          {preparing ? (
            <p className="mt-1 border-t border-line pt-2 text-[11px] leading-relaxed text-ink-3">
              ‘N년 전 오늘’은 우리 탭(기록장) 맨 아래에서 켜고 끌 수 있어요.
            </p>
          ) : null}
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
              description={`기본은 숨김이에요. 켜면 주기 탭의 주기 기록에 ‘주기 N’으로 보여요${
                canSeeCycleDetails(state, partner.id) ? ` · 자세한 기록을 공유 중이라 ${partner.name}님 화면에도 보여요` : ''
              }. 병원에 보여 줄 요약에는 늘 들어가요.`}
            />
          </Card>
        ) : null}
        {preparing && !canLogCycle(state, viewer) ? (
          <p className="px-1 text-[11px] leading-relaxed text-ink-3">
            주기 기록의 횟수 표시는 {cycleOwner.name}님이 정해요. {me.name}님 알림과 잠금화면 숨김은 ‘내 알림’에 있어요.
          </p>
        ) : null}
      </div>
    </SettingsSection>
  )
}
