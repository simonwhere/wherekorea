'use client'

// "기록 지키기" rows for the pregnant / parenting home: add the app to the home
// screen (Safari keeps a tab's storage only 7 days without a visit; the
// home-screen app is exempt — WebKit, review [42]) and a weekly backup nudge.
// The preparing home has the compact BackupBanner under 우리 한 줄 instead
// (N16), so this renders nothing there. Device state: useDeviceRecord.

import { INSTALL_STEPS, backupNudge } from '@/lib/persist'
import { goToSettings } from '@/components/settings/anchors'
import { Icon } from '@/components/ui/icons'
import { useApp } from '@/lib/store'
import { useDeviceRecord } from './useDeviceRecord'

const rowAction =
  'mt-2 inline-flex min-h-[44px] items-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-brand-ink ' +
  'transition-colors hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

/** Go to 설정 › 데이터와 개인정보 (#data, 전체 백업). */
const goToBackup = () => goToSettings('data')

export default function InstallBackupCard() {
  const { state, today } = useApp()
  const { device, install } = useDeviceRecord()

  // Preparing: BackupBanner (components/tabs/TodayTab.tsx) carries this now.
  if (state.stage === 'preparing') return null
  if (!device) return null
  const nudge = backupNudge(device.lastBackup, state.createdAt, today)
  if (device.installed && !nudge) return null

  return (
    <section aria-label="기록 지키기" className="space-y-3">
      {device.installed ? null : (
        <div className="flex items-start gap-3 rounded-xl bg-surface-2 px-4 py-3">
          <Icon name="phone" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-ink-2" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink">홈 화면에 추가해 두세요</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-2">
              홈 화면에 추가하면 사파리의 7일 삭제를 피할 수 있어요. 알림은 앱이 열려 있을 때만 와요.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-3">{INSTALL_STEPS[device.platform]}</p>
            {device.canPrompt ? (
              <button type="button" className={rowAction} onClick={() => void install()}>
                홈 화면에 추가하기
              </button>
            ) : device.platform === 'inapp' && !nudge ? (
              // Moving to Safari / Chrome starts from empty storage: back up first.
              <button type="button" className={rowAction} onClick={goToBackup}>
                백업 파일 받으러 가기
              </button>
            ) : null}
          </div>
        </div>
      )}
      {nudge ? (
        <div className="flex items-start gap-3 rounded-xl bg-surface-2 px-4 py-3">
          <Icon name="box" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-ink-2" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink">
              {nudge.kind === 'stale' ? `백업한 지 ${nudge.days}일 지났어요` : '아직 이 기기에서 받은 백업 파일이 없어요'}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-2">
              기록은 이 기기에만 있어요. 일주일에 한 번 백업 파일을 받아 두면 폰을 바꿔도 되살릴 수 있어요.
            </p>
            <button type="button" className={rowAction} onClick={goToBackup}>
              백업하기
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
