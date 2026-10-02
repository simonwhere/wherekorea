'use client'

// 기록 지키기 — the compact line under 우리 한 줄 on the preparing home (N16).
// Shows while the app isn't on the home screen or the last backup file is
// over a week old (closing it hides it for 7 days on this device), and once
// on the day the first period is logged. The rule is lib/persist backupBanner.
//
// Wording never names the cycle: the partner's phone shows the same banner
// kinds, and the first-period reminder is only passed in on the owner's screen.

import { useEffect, useRef, useState } from 'react'
import { goToSettings } from '@/components/settings/anchors'
import { cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import {
  BANNER_DISMISSED_KEY,
  FIRST_PERIOD_KEY,
  INSTALL_STEPS,
  backupBanner,
  firstPeriodMarker,
  readDeviceStamp,
  writeDeviceStamp,
  type BackupBanner as Banner,
} from '@/lib/persist'
import { canLogCycle } from '@/lib/logic/prefs'
import { stampOn } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import { useDeviceRecord } from './useDeviceRecord'

const link =
  'inline-flex min-h-[44px] items-center rounded-lg px-1.5 text-[12.5px] font-bold text-brand-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand'

function copy(b: Banner): { icon: string; title: string; body: string } {
  if (b.reason === 'first-period') {
    return {
      icon: '🌱',
      title: '첫 기록을 남겼어요',
      body: b.installed
        ? '기록은 이 폰에만 있어요. 백업 파일을 한 번 받아 두면 폰을 바꿔도 되살릴 수 있어요.'
        : '기록은 이 폰에만 있어요. 홈 화면에 추가하면 사파리의 7일 삭제를 피할 수 있어요.',
    }
  }
  if (b.reason === 'not-installed') {
    return {
      icon: '📲',
      title: '홈 화면에 추가해 두세요',
      body: b.nudge
        ? '브라우저 탭은 7일 동안 안 열면 기록이 지워질 수 있어요. 백업 파일도 받아 두세요.'
        : '브라우저 탭은 7일 동안 안 열면 기록이 지워질 수 있어요. 알림은 앱이 열려 있을 때만 와요.',
    }
  }
  if (b.reason === 'stale') {
    return { icon: '💾', title: `백업한 지 ${b.nudge?.days ?? 0}일 지났어요`, body: '기록은 이 폰에만 있어요. 일주일에 한 번 백업 파일을 받아 두세요.' }
  }
  return { icon: '💾', title: '아직 백업 파일이 없어요', body: '기록은 이 폰에만 있어요. 백업 파일을 받아 두면 폰을 바꿔도 되살릴 수 있어요.' }
}

/** Go to 설정 › 데이터와 개인정보 (#data, 전체 백업). */
const goToBackup = () => goToSettings('data')

export default function BackupBanner({ className }: { className?: string }) {
  const { state, today, me } = useApp()
  const { device, install } = useDeviceRecord()
  const [showSteps, setShowSteps] = useState(false)
  if (!device) return null

  const banner = backupBanner({
    installed: device.installed,
    lastBackup: device.lastBackup,
    createdAt: state.createdAt,
    today,
    dismissedOn: device.dismissedOn,
    // The first-period reminder belongs to the person who logs the cycle.
    firstPeriodOn: canLogCycle(state, me.id) ? device.firstPeriodOn : null,
  })
  if (!banner) return null
  const text = copy(banner)
  const dismiss = () => writeDeviceStamp(BANNER_DISMISSED_KEY, stampOn(today))
  const wantsInstall = !banner.installed
  const wantsBackup = banner.reason !== 'not-installed' || !!banner.nudge

  return (
    <section aria-label="기록 지키기" className={cx('relative rounded-xl bg-surface-2 py-3 pl-4 pr-12', className)}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="pt-px text-lg leading-6">
          {text.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-5 text-ink">{text.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{text.body}</p>
          <div className="-mb-2 -ml-1.5 mt-0.5 flex flex-wrap items-center gap-x-2">
            {wantsInstall ? (
              device.canPrompt ? (
                <button type="button" className={link} onClick={() => void install()}>
                  홈 화면에 추가하기
                </button>
              ) : (
                <button type="button" className={link} aria-expanded={showSteps} onClick={() => setShowSteps((v) => !v)}>
                  추가하는 방법
                </button>
              )
            ) : null}
            {wantsBackup ? (
              <button type="button" className={link} onClick={goToBackup}>
                백업하기
              </button>
            ) : null}
          </div>
          {wantsInstall && showSteps ? (
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">{INSTALL_STEPS[device.platform]}</p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="7일 동안 닫기"
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-ink-3 hover:bg-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        <Icon name="plus" className="h-[18px] w-[18px] rotate-45" strokeWidth={2} />
      </button>
    </section>
  )
}

/**
 * Remembers, once per device, the day a period gets logged while the app is
 * open (from the sheet, the first-period card or the calendar — any path, since
 * it watches the count). Mounted in AppShell so it sees logs made on any tab.
 */
export function useFirstPeriodMarker(): void {
  const { state, today } = useApp()
  const count = state.periods.length
  const prev = useRef(count)
  useEffect(() => {
    const stamp = firstPeriodMarker(prev.current, count, readDeviceStamp(FIRST_PERIOD_KEY), stampOn(today))
    prev.current = count
    if (stamp) writeDeviceStamp(FIRST_PERIOD_KEY, stamp)
  }, [count, today])
}
