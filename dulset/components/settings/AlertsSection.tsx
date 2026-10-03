'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { Button, Card, Toggle, cx, inputClass, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { NICE_GUIDANCE } from '@/lib/content/fertility'
import { cycleLens, cyclePause, icsAvailability, windowRangeShort } from '@/lib/logic/calendarView'
import { upcomingWindows } from '@/lib/logic/cycle'
import { buildIcs, downloadText, fertileWindowEvents } from '@/lib/logic/ics'
import {
  ALERT_STYLE_OPTIONS,
  acceptNudgesFor,
  alertPreview,
  alertStyleLabel,
  alertStyleOf,
  homeDiscreetFor,
  lockScreenText,
  setAlertStyle,
  setSetting,
} from '@/lib/logic/settings'
import { useApp } from '@/lib/store'
import type { AlertStyle } from '@/lib/types'
import { Pill, RadioCard, Segmented, SettingsSection } from './bits'
import {
  USES_LH_OPTIONS,
  canLogCycle,
  canSeeCycleDetails,
  canSeeWeekBand,
  discreetFor,
  lhTestTimeFor,
  lowPressureFor,
  setLHTestTime,
  setPersonalPref,
  setUsesLH,
  settingsFor,
  type UsesLH,
} from '@/lib/logic/prefs'
import { fertilityVoice } from '@/lib/logic/today'
import { openLHHowTo } from '@/lib/logLauncher'

/**
 * Does this viewer read 가임기 / 배란 wording? Only with their own explicit
 * choice (not soft, off or 부담 없이). The choice list itself still names the
 * explicit option — it's what they'd be choosing.
 */
function useExplicitWords(): boolean {
  const { state, viewer, cycleOwner } = useApp()
  return fertilityVoice(settingsFor(state.settings, viewer), viewer, viewer === cycleOwner.id) === 'explicit'
}

/** The partner's choice, named without health words (for a soft / off / 부담 없이 viewer). */
const PLAIN_STYLE_LABEL: Record<AlertStyle, string> = {
  explicit: '날짜와 함께 알림',
  soft: '은근하게',
  off: '받지 않음',
}

export default function AlertsSection() {
  const { state, update, viewer, me, partner } = useApp()
  const preparing = state.stage === 'preparing'
  const low = lowPressureFor(state.settings, viewer)
  const explicit = useExplicitWords()
  return (
    <SettingsSection id="alerts" title="내 알림" sub={`${me.name}님 폰에만 적용돼요 · ${partner.name}님은 각자 정해요`}>
      <div className="grid gap-2">
        {preparing ? <MyAlertStyle /> : null}
        <Card>
          {preparing ? <LowPressureToggle /> : null}
          <div className={cx(preparing && 'mt-1 border-t border-line pt-1')}>
            <Toggle
              checked={discreetFor(state.settings, viewer)}
              onChange={(v) => update((s) => setPersonalPref(s, viewer, 'discreet', v))}
              label={
                <>
                  잠금화면에서 조용히 <span className="text-xs font-normal text-ink-3">(내 폰만)</span>
                </>
              }
              description={
                preparing && !low && canLogCycle(state, viewer)
                  ? '잠금화면에는 ‘둘셋 — 새 알림이 있어요’로만 보여요. 캘린더 파일에도 건강 용어 대신 ‘우리의 주간’으로 적혀요.'
                  : '잠금화면에는 ‘둘셋 — 새 알림이 있어요’로만 보여요.'
              }
            />
            {/* 잠금화면 숨김을 홈 카드까지 (Next B): the owner's own moment card and ring stay neutral until tapped. */}
            {preparing ? <HomeDiscreetToggle /> : null}
          </div>
          <div className="mt-1 border-t border-line pt-1">
            <NudgesToggle />
          </div>
          <div className="mt-1 border-t border-line pt-1">
            <BrowserNotifications />
          </div>
        </Card>
        {/* The cycle owner's own dates, so only the owner exports them (as on the 주기 tab).
            Low-pressure mode makes no date alarms, so the export isn't offered at all. */}
        {preparing && !low && canLogCycle(state, viewer) ? <IcsCard /> : null}
        {/* LH strips are the owner's tool, named only where she reads 가임기 words herself. */}
        {preparing && canLogCycle(state, viewer) && explicit ? <LHStripsCard /> : null}
      </div>
    </SettingsSection>
  )
}

// ── 홈 카드까지 조용히 · 콕 받기 (per person, Next B) ───────────

/**
 * settings.personal[me].homeDiscreet — the 오늘 moment card and cycle ring on
 * my phone show a neutral title ('오늘의 우리') until I tap them, so the phone
 * can be handed over (review D-21). Unset follows 잠금화면에서 조용히
 * (lib/logic/settings.ts homeDiscreetFor); a tap here sets it on its own.
 */
function HomeDiscreetToggle() {
  const { state, update, viewer } = useApp()
  const toast = useToast()
  const on = homeDiscreetFor(state.settings, viewer)
  return (
    <div className="pl-3">
      <Toggle
        checked={on}
        onChange={(v) => {
          update((s) => setPersonalPref(s, viewer, 'homeDiscreet', v))
          toast.show(v ? '홈 카드도 한 번 눌러야 내용이 보여요' : '홈 카드에 내용이 바로 보여요')
        }}
        label={
          <>
            홈 카드까지 조용히 <span className="text-xs font-normal text-ink-3">(내 폰만)</span>
          </>
        }
        description="오늘 화면의 상황 카드와 띠가 ‘오늘의 우리’로만 보이고, 한 번 누르면 내용이 열려요. 폰을 건넬 때 편해요."
      />
    </div>
  )
}

/**
 * settings.personal[me].acceptNudges — whether the partner's 콕 reaches my
 * phone at all (default yes). Off here, their 콕 button quietly disappears
 * and sendNudge drops it (lib/logic/notifications.ts).
 */
function NudgesToggle() {
  const { state, update, viewer, partner } = useApp()
  const toast = useToast()
  const on = acceptNudgesFor(state.settings, viewer)
  return (
    <Toggle
      checked={on}
      onChange={(v) => {
        update((s) => setPersonalPref(s, viewer, 'acceptNudges', v))
        toast.show(v ? `${partner.name}님의 콕을 받아요` : `${partner.name}님의 콕을 쉬어요 · 응원은 그대로 와요`)
      }}
      label={
        <>
          콕 받기 <span className="text-xs font-normal text-ink-3">(내 폰만)</span>
        </>
      }
      description={
        on
          ? `${partner.name}님이 내 체크를 콕 찌르면 알림함에 와요. 끄면 ${partner.name}님 화면에서 콕 버튼이 사라져요.`
          : `${partner.name}님 화면에서 콕 버튼이 사라졌어요. 응원과 신호는 그대로 와요.`
      }
    />
  )
}

// ── 배란테스트기 (LH) ────────────────────────────────────────

const USES_LH_CHOICES = USES_LH_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))

function usesLHFrom(value: string): UsesLH {
  return value === 'true' ? true : value === 'false' ? false : 'later'
}

/**
 * settings.usesLH — [써요][안 써요][나중에], the same answer the log sheet asks
 * for at the first LH moment (N17). '안 써요' takes the LH prompts off the home
 * (prefs.lhPrompting); the usual test time is a per-person note for now.
 */
function LHStripsCard() {
  const { state, update, viewer } = useApp()
  const toast = useToast()
  const uses = state.settings.usesLH
  const time = lhTestTimeFor(state.settings, viewer) ?? ''
  const timeId = useId()
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Icon name="flask" className="h-[18px] w-[18px] text-ink-2" />
          배란테스트기(LH)
        </h3>
        <button
          type="button"
          onClick={openLHHowTo}
          className="-mr-2 -mt-2 min-h-[44px] shrink-0 rounded-lg px-2 text-xs font-semibold text-brand-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          어떻게 해요?
        </button>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-2">
        ‘안 써요’면 홈에서 LH 테스트 권유가 사라지고 달력 기준으로만 안내해요. 기록은 언제든 할 수 있어요.
      </p>
      <div className="mt-3">
        <Segmented
          legend="써요?"
          options={USES_LH_CHOICES}
          value={uses === undefined ? '' : String(uses)}
          onChange={(v) => {
            const next = usesLHFrom(v)
            update((s) => setUsesLH(s, next, viewer))
            toast.show(next === true ? '배란테스트기를 써요' : next === false ? 'LH 테스트 권유를 쉬어요' : '다음 주기에 다시 물어볼게요')
          }}
        />
      </div>
      {uses === true ? (
        <div className="mt-3 flex items-center gap-3">
          <label htmlFor={timeId} className="shrink-0 text-xs font-semibold text-ink-2">
            보통 검사하는 시각 <span className="font-normal text-ink-3">(내 폰만)</span>
          </label>
          <input
            id={timeId}
            type="time"
            value={time}
            onChange={(e) => update((s) => setLHTestTime(s, viewer, e.target.value || undefined))}
            className={`${inputClass} w-32`}
          />
        </div>
      ) : null}
      {uses === true ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">지금은 메모만 해 둬요. 시각 알림은 설치형 앱에서 켤 예정이에요.</p>
      ) : null}
    </Card>
  )
}

function MyAlertStyle() {
  const { state, update, viewer, me, partner, cycleOwner, today } = useApp()
  const style = alertStyleOf(state, viewer)
  const partnerStyle = alertStyleOf(state, partner.id)
  const isOwner = me.id === cycleOwner.id
  const low = lowPressureFor(state.settings, viewer)
  // Until the owner shares the details, the partner hears the shared "우리의
  // 주간" wording even with "가임기라고" picked — the same rule the alerts,
  // home and calendar follow (no dates or peak days that give away an LH result).
  const limited = style === 'explicit' && !canSeeCycleDetails(state, viewer)
  // '날짜 없음' (N23): she shares no dates, so no 우리의 주간 notice reaches this
  // person at all (notifications.scheduledNotices) — the preview shows none.
  const noBand = !canSeeWeekBand(state, viewer)
  // No dates in the preview while this cycle is paused (쉬어요 / 병원 확인 전).
  const [w] = state.periods.length && !cyclePause(state, today) && !noBand ? upcomingWindows(state, today, 1) : []
  const preview = noBand
    ? {
        message: null,
        note: `${cycleOwner.name}님이 ‘날짜 없음’을 골라서 우리의 주간 알림은 오지 않아요. 체크·신호·할 일 알림은 그대로 와요.`,
      }
    : alertPreview(limited ? 'soft' : style, { lowPressure: low, isCycleOwner: isOwner, window: w })
  const lock = preview.message && discreetFor(state.settings, viewer) ? lockScreenText(preview.message, true) : null

  const choose = (next: AlertStyle) => update((s) => setAlertStyle(s, viewer, next))
  const headingId = useId()
  const group = useId()
  const explicitWords = useExplicitWords()

  return (
    <Card>
      <h3 id={headingId} className="text-sm font-bold text-ink">
        {explicitWords ? `${me.name}님의 가임기 알림` : `${me.name}님의 알림 방식`}
      </h3>
      <p className="mt-0.5 text-xs text-ink-3">
        각자 자기 방식만 바꿀 수 있어요 · {partner.name}님 선택:{' '}
        {explicitWords ? alertStyleLabel(partnerStyle) : PLAIN_STYLE_LABEL[partnerStyle]}
      </p>

      <div role="radiogroup" aria-labelledby={headingId} className={cx('mt-3 grid gap-2', low && 'opacity-60')}>
        {ALERT_STYLE_OPTIONS.map((o) => {
          const on = o.value === style
          return (
            <RadioCard
              key={o.value}
              name={group}
              checked={on}
              onSelect={() => choose(o.value)}
              className="min-h-[52px] gap-3 px-3 py-2 text-left"
            >
              <span
                aria-hidden
                className={cx(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                  on ? 'border-brand' : 'border-line',
                )}
              >
                {on ? <span className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{o.label}</span>
                <span className="block text-[11px] text-ink-3">
                  {!explicitWords && o.value === 'off' ? '‘우리의 주간’ 알림만 쉬어요' : o.hint}
                </span>
              </span>
            </RadioCard>
          )
        })}
      </div>

      <div className="mt-3" aria-live="polite">
        <p className="text-[11px] font-semibold text-ink-3">알림 미리보기</p>
        {preview.message ? (
          <div className="mt-1.5 rounded-2xl border border-line bg-surface-2 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-ink-3">
              <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded bg-brand text-[9px] font-bold text-white">
                둘
              </span>
              둘셋 · 지금
            </div>
            <p className="mt-1 text-sm font-semibold text-ink">{preview.message.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{preview.message.body}</p>
          </div>
        ) : null}
        <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{preview.note}</p>
        {limited && !low && !noBand ? (
          <p className="mt-1 text-[11px] text-ink-3">
            {cycleOwner.name}님이 자세한 기록을 공유하기 전까지는 ‘우리의 주간’으로 알려 드려요.
          </p>
        ) : null}
        {lock ? (
          <p className="mt-1 text-[11px] text-ink-3">
            잠금화면에서는 ‘{lock.title} — {lock.body}’로만 보여요.
          </p>
        ) : null}
        {low ? <p className="mt-1 text-[11px] text-ink-3">부담 없이 모드를 끄면 고른 방식으로 알려 드려요.</p> : null}
      </div>
    </Card>
  )
}

function LowPressureToggle() {
  const { state, update, viewer, partner } = useApp()
  const toast = useToast()
  const on = lowPressureFor(state.settings, viewer)
  const explicitWords = useExplicitWords()
  const dateAlerts = explicitWords ? '가임기 알림' : '날짜 알림'
  return (
    <div>
      <Toggle
        checked={on}
        onChange={(v) => {
          update((s) => setPersonalPref(s, viewer, 'lowPressure', v))
          toast.show(v ? '부담 없이 모드를 켰어요 · 내 폰에만 적용돼요' : '부담 없이 모드를 껐어요')
        }}
        label={
          <>
            부담 없이 모드 <span className="text-xs font-normal text-ink-3">(내 폰만)</span>
          </>
        }
        description={`${dateAlerts}과 카운트다운 없이, 날짜를 맞추지 않고 지내는 방식이에요. ${partner.name}님 설정은 그대로예요.`}
      />
      <details className="group">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center text-xs font-medium text-brand-ink [&::-webkit-details-marker]:hidden">
          왜 이런 방식이 있나요?
          <Icon name="chev" className="ml-1 h-4 w-4 transition-transform group-open:rotate-180" strokeWidth={2.2} />
        </summary>
        <div className="pb-2 text-xs leading-relaxed text-ink-2">
          <p>
            영국 NICE 지침(NG257, 2026)은 {explicitWords ? '배란일을' : '날짜를'} 맞추기보다{' '}
            <strong className="font-semibold text-ink">주기 내내 2~3일에 한 번</strong> 함께하는 방식을 권해요. 날짜에 맞춘 알림이 부담으로
            느껴진다면 이 모드가 잘 맞을 수 있어요.
          </p>
          <p className="mt-1.5">
            켜 두면 내 폰에서는 {dateAlerts}과 카운트다운이 사라지고, 둘만의 시간으로만 안내해요.{' '}
            {`${partner.name}님 화면과 알림은 ${partner.name}님 설정을 따라요.`} 체크·응원 알림은 그대로 와요.
          </p>
          <a
            href={NICE_GUIDANCE.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-[44px] items-center font-semibold text-brand-ink underline-offset-2 hover:underline"
          >
            NICE NG257 원문 보기
            <Icon name="ext" className="ml-0.5 h-3.5 w-3.5" strokeWidth={2.2} />
          </a>
        </div>
      </details>
    </div>
  )
}

// ── Browser notifications ───────────────────────────────────

type Permission = NotificationPermission | 'unsupported'

function readPermission(): Permission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

function requestPermission(): Promise<NotificationPermission> {
  // Older Safari only supports the callback form.
  return new Promise((resolve) => {
    try {
      const maybe = Notification.requestPermission((p) => resolve(p))
      if (maybe && typeof maybe.then === 'function') maybe.then(resolve, () => resolve(Notification.permission))
    } catch {
      resolve(Notification.permission)
    }
  })
}

const PERMISSION_LABEL: Record<Permission, { text: string; tone: 'ok' | 'period' | 'muted' | 'warn' }> = {
  granted: { text: '브라우저 허용됨', tone: 'ok' },
  denied: { text: '브라우저에서 차단됨', tone: 'period' },
  default: { text: '아직 묻지 않았어요', tone: 'muted' },
  unsupported: { text: '지원하지 않는 브라우저', tone: 'warn' },
}

function BrowserNotifications() {
  const { state, update, viewer } = useApp()
  const toast = useToast()
  const [perm, setPerm] = useState<Permission>('default')
  const [asking, setAsking] = useState(false)
  const setting = state.settings.browserNotifications
  const discreet = discreetFor(state.settings, viewer)

  const refresh = useCallback(() => setPerm(readPermission()), [])
  useEffect(() => {
    refresh()
    // The user may change the site permission in browser settings and come back.
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  const checked = setting && perm === 'granted'

  const onChange = async (next: boolean) => {
    if (!next) {
      update((s) => setSetting(s, 'browserNotifications', false))
      return
    }
    const current = readPermission()
    if (current === 'unsupported') {
      setPerm(current)
      toast.show('이 브라우저는 알림을 지원하지 않아요')
      return
    }
    if (current === 'denied') {
      setPerm(current)
      toast.show('브라우저에서 알림이 차단돼 있어요')
      return
    }
    let result: NotificationPermission = current
    if (current === 'default') {
      setAsking(true)
      result = await requestPermission()
      setAsking(false)
    }
    setPerm(result)
    if (result === 'granted') {
      update((s) => setSetting(s, 'browserNotifications', true))
      toast.show('브라우저 알림을 켰어요')
    } else {
      toast.show('알림 권한을 받지 못했어요')
    }
  }

  const sendTest = () => {
    try {
      new Notification(discreet ? '둘셋' : '둘셋 테스트 알림', {
        body: discreet ? '새 알림이 있어요 💌' : '이렇게 알려 드릴게요 🔔',
        icon: './icon.svg',
        tag: 'dulset-test',
      })
      toast.show('테스트 알림을 보냈어요')
    } catch {
      toast.show('이 브라우저는 앱 안에서 바로 알림을 띄울 수 없어요')
    }
  }

  const status = PERMISSION_LABEL[perm]

  return (
    <div>
      <Toggle
        checked={checked}
        onChange={(v) => void onChange(v)}
        label="브라우저 알림"
        description={asking ? '브라우저에서 허용 여부를 물어보고 있어요…' : '둘셋이 열려 있을 때 새 알림을 띄워 드려요.'}
      />
      <div className="flex flex-wrap items-center gap-2 pb-1">
        <Pill tone={status.tone}>{status.text}</Pill>
        {setting && perm !== 'granted' && perm !== 'unsupported' ? (
          <span className="text-[11px] text-ink-3">권한이 없어 알림이 뜨지 않아요</span>
        ) : null}
      </div>

      {perm === 'denied' ? (
        <p className="mt-2 rounded-xl bg-warn-soft p-3 text-xs leading-relaxed text-ink-2">
          주소창 옆 자물쇠(사이트 설정)에서 알림을 ‘허용’으로 바꾼 뒤, 이 화면으로 돌아와 다시 켜 주세요.
        </p>
      ) : null}
      {perm === 'unsupported' ? (
        <p className="mt-2 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-ink-2">
          이 브라우저에서는 웹 알림을 쓸 수 없어요. iPhone은 Safari에서 ‘홈 화면에 추가’한 뒤 열면 알림을 받을 수 있어요. 알림 없이도 앱
          안의 알림함에는 그대로 쌓여요.
        </p>
      ) : null}
      {checked ? (
        <Button variant="secondary" size="sm" className="mt-2 min-h-[44px]" onClick={sendTest}>
          테스트 알림 보내기
        </Button>
      ) : null}
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
        지금은 둘셋이 열려 있을 때만 알림이 떠요. 앱을 닫아도 오는 푸시 알림은 설치형 앱과 서버가 있어야 해요.
      </p>
    </div>
  )
}

// ── Calendar export ─────────────────────────────────────────

function IcsCard() {
  const { state, today, viewer } = useApp()
  const toast = useToast()
  const mine = settingsFor(state.settings, viewer)
  // The calendar's lens (the owner's own wording), and cyclePause: a rest cycle or a
  // positive test awaiting the clinic makes no date alarms either.
  const lens = cycleLens(state, viewer, today)
  const view = lens.view
  const { enabled, reason, windows } = icsAvailability(state, today, mine, view, cyclePause(state, today))
  // A "soft" viewer gets the discreet title (우리의 주간) and only the window event.
  const discreet = mine.discreet || view === 'soft'
  const label = view === 'explicit' ? '가임기 일정 캘린더로 내보내기 (.ics)' : '우리의 주간 캘린더로 내보내기 (.ics)'

  const download = () => {
    if (!enabled) return
    downloadText(
      'dulset-fertile.ics',
      buildIcs(fertileWindowEvents(windows, { discreet, peak: view === 'explicit', id: state.couple.inviteCode })),
    )
    toast.show('캘린더 파일을 저장했어요 · 열어서 추가해 주세요')
  }

  return (
    <Card>
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
        <Icon name="cal" className="h-[18px] w-[18px] text-ink-2" />
        휴대폰 캘린더에 알람 넣기
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-2">
        파일을 열어 구글·애플·삼성 캘린더에 추가하면 하루 전 오전 9시에 알람이 울려요. 내 캘린더에만 들어가요.
      </p>
      {enabled ? (
        <p className="mt-1 text-[11px] text-ink-3">
          앞으로 {windows.length}번 (예상): {windows.map(windowRangeShort).join(', ')}
          {discreet ? ' · 캘린더에는 건강 용어 없이 적혀요' : ''}
        </p>
      ) : null}
      <Button full variant="secondary" className="mt-3" disabled={!enabled} onClick={download}>
        {label}
      </Button>
      {!enabled && reason ? <p className="mt-2 text-xs text-ink-3">{reason}</p> : null}
    </Card>
  )
}
