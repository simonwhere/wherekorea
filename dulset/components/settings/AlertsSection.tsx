'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { Button, Card, Toggle, cx, useToast } from '@/components/ui'
import { NICE_GUIDANCE } from '@/lib/content/fertility'
import { fertilityView, icsAvailability, windowRangeShort } from '@/lib/logic/calendarView'
import { upcomingWindows } from '@/lib/logic/cycle'
import { buildIcs, downloadText, fertileWindowEvents } from '@/lib/logic/ics'
import {
  ALERT_STYLE_OPTIONS,
  alertPreview,
  alertStyleLabel,
  alertStyleOf,
  lockScreenText,
  setAlertStyle,
  setSetting,
} from '@/lib/logic/settings'
import { useApp } from '@/lib/store'
import type { AlertStyle } from '@/lib/types'
import { Pill, RadioCard, SettingsSection } from './bits'
import { discreetFor, lowPressureFor, setPersonalPref, settingsFor } from '@/lib/logic/prefs'

export default function AlertsSection() {
  const { state, update, viewer } = useApp()
  const preparing = state.stage === 'preparing'
  const low = lowPressureFor(state.settings, viewer)
  return (
    <SettingsSection title="알림" sub="알림 방식은 각자 정해요 · 내 폰에만 적용돼요">
      <div className="grid gap-2">
        {preparing ? <MyAlertStyle /> : null}
        <Card>
          {preparing ? <LowPressureToggle /> : null}
          <div className={cx(preparing && 'mt-1 border-t border-line pt-1')}>
            <Toggle
              checked={discreetFor(state.settings, viewer)}
              onChange={(v) => update((s) => setPersonalPref(s, viewer, 'discreet', v))}
              label="잠금화면에서 조용히"
              description={
                preparing && !low
                  ? '잠금화면에는 ‘둘셋 — 새 알림이 있어요’로만 보여요. 캘린더 파일에도 건강 용어 대신 ‘우리의 주간’으로 적혀요.'
                  : '잠금화면에는 ‘둘셋 — 새 알림이 있어요’로만 보여요.'
              }
            />
          </div>
          <div className="mt-1 border-t border-line pt-1">
            <BrowserNotifications />
          </div>
        </Card>
        {/* Low-pressure mode makes no date alarms, so the export isn't offered at all. */}
        {preparing && !low ? <IcsCard /> : null}
      </div>
    </SettingsSection>
  )
}

function MyAlertStyle() {
  const { state, update, viewer, me, partner, cycleOwner, today } = useApp()
  const style = alertStyleOf(state, viewer)
  const partnerStyle = alertStyleOf(state, partner.id)
  const isOwner = me.id === cycleOwner.id
  const low = lowPressureFor(state.settings, viewer)
  const [w] = state.periods.length ? upcomingWindows(state, today, 1) : []
  const preview = alertPreview(style, { lowPressure: low, isCycleOwner: isOwner, window: w })
  const lock = preview.message && discreetFor(state.settings, viewer) ? lockScreenText(preview.message, true) : null

  const choose = (next: AlertStyle) => update((s) => setAlertStyle(s, viewer, next))
  const headingId = useId()
  const group = useId()

  return (
    <Card>
      <h3 id={headingId} className="text-sm font-bold text-ink">
        {me.name}님의 가임기 알림
      </h3>
      <p className="mt-0.5 text-xs text-ink-3">
        각자 자기 방식만 바꿀 수 있어요 · {partner.name}님 선택: {alertStyleLabel(partnerStyle)}
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
                <span className="block text-[11px] text-ink-3">{o.hint}</span>
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
  const { state, update, viewer } = useApp()
  const toast = useToast()
  const on = lowPressureFor(state.settings, viewer)
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
        description="가임기 알림과 카운트다운 없이, 날짜를 맞추지 않고 지내는 방식이에요."
      />
      <details className="group">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center text-xs font-medium text-brand-ink [&::-webkit-details-marker]:hidden">
          왜 이런 방식이 있나요?
          <span aria-hidden className="ml-1 transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="pb-2 text-xs leading-relaxed text-ink-2">
          <p>
            영국 NICE 지침(NG257, 2026)은 배란일을 맞추기보다 <strong className="font-semibold text-ink">주기 내내 2~3일에 한 번</strong>{' '}
            함께하는 방식을 권해요. 날짜에 맞춘 알림이 부담으로 느껴진다면 이 모드가 잘 맞을 수 있어요.
          </p>
          <p className="mt-1.5">
            켜 두면 두 사람 모두 가임기 알림과 카운트다운이 없어지고, 달력에는 생리 기록과 예정일만 보여요. 체크·응원 알림은
            그대로 와요.
          </p>
          <a
            href={NICE_GUIDANCE.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-[44px] items-center font-semibold text-brand-ink underline-offset-2 hover:underline"
          >
            NICE NG257 원문 보기 ↗
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
          이 브라우저에서는 웹 알림을 쓸 수 없어요. iPhone은 Safari에서 ‘홈 화면에 추가’한 뒤 열면 알림을 받을 수 있어요. 알림
          없이도 앱 안의 🔔 알림함에는 그대로 쌓여요.
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
  const { state, today, viewer, cycleOwner } = useApp()
  const toast = useToast()
  const mine = settingsFor(state.settings, viewer)
  const view = fertilityView(mine, viewer, cycleOwner.id)
  const { enabled, reason, windows } = icsAvailability(state, today, mine, view)
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
      <h3 className="text-sm font-bold text-ink">
        <span aria-hidden>🗓️ </span>휴대폰 캘린더에 알람 넣기
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-2">
        파일을 열어 구글·애플·삼성 캘린더에 추가하면 하루 전 오전 9시에 알람이 울려요. 두 사람 모두 추가하면 함께 받아요.
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
