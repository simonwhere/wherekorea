'use client'

import { useCallback, useState } from 'react'
import CoupleDatesSheet from '@/components/us/CoupleDatesSheet'
import { Button, Card } from '@/components/ui'
import { IconTile, type IconName } from '@/components/ui/icons'
import { dLabel, formatKo, isISODate } from '@/lib/dates'
import { anniversaryDayOnly, daysSince, nextAnniversaries } from '@/lib/logic/anniversary'
import { anniversaryAlertsOn } from '@/lib/logic/settings'
import { useApp } from '@/lib/store'
import { SettingsSection } from './bits'

/** #days opens the 우리 tab on its 기념일 view. */
function openDays() {
  if (window.location.hash.replace(/^#/, '') !== 'days') window.location.hash = 'days'
  window.scrollTo({ top: 0 })
}

const fmt = (n: number) => n.toLocaleString('ko-KR')

function Row({ icon, label, date, sub }: { icon: IconName; label: string; date?: string; sub?: string }) {
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0">
      <IconTile name={icon} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink-3">{label}</p>
        <p className="text-sm font-bold text-ink">
          {date ?? <span className="font-medium text-ink-3">아직 없어요</span>}
          {sub ? <span className="ml-1.5 text-xs font-semibold text-brand-ink">{sub}</span> : null}
        </p>
      </div>
    </li>
  )
}

/**
 * 처음 만난 날 · 결혼한 날 (edited with the same sheet as the 우리 tab) and a way to the anniversaries.
 * While preparing it sits near the bottom of 설정 (N27: the record book's own days; the 우리 tab asks for them).
 */
export default function CoupleDaysSection() {
  const { state, today } = useApp()
  const [open, setOpen] = useState(false)
  // Stable, so the Sheet's open effect doesn't re-run (and refocus) on every render.
  const openSheet = useCallback(() => setOpen(true), [])
  const close = useCallback(() => setOpen(false), [])
  const { metDate, marriedDate } = state.couple
  const met = isISODate(metDate) ? metDate : undefined
  const married = isISODate(marriedDate) ? marriedDate : undefined
  const next = nextAnniversaries(state.couple, state.anniversaries, today, 1)[0]
  const custom = state.anniversaries.length
  const long = (d: string) => formatKo(d, { year: true, weekday: false })

  return (
    <SettingsSection id="ourdays" title="우리 둘의 날" sub="함께한 날수와 100일·주년 기념일을 챙기는 기준이에요">
      <Card>
        <ul className="divide-y divide-line">
          <Row
            icon="heart"
            label="처음 만난 날"
            date={met ? long(met) : undefined}
            sub={met && met <= today ? `함께한 지 D+${fmt(daysSince(met, today))}` : undefined}
          />
          <Row
            icon="ring"
            label="결혼한 날"
            date={married ? long(married) : undefined}
            sub={married ? (married <= today ? `결혼한 지 ${fmt(daysSince(married, today))}일` : '결혼 예정') : undefined}
          />
          <Row icon="star" label="직접 추가한 기념일" date={custom ? `${fmt(custom)}개` : undefined} />
        </ul>

        {next ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-xs text-ink-2">
            <span aria-hidden className="text-base leading-none">
              {next.emoji}
            </span>
            <span className="min-w-0 flex-1">
              다음 기념일 · <b className="font-semibold text-ink">{next.title}</b> {formatKo(next.date, { weekday: false })}
            </span>
            <span className="shrink-0 font-bold tabular-nums text-brand-ink">{dLabel(next.date, today)}</span>
          </p>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={openSheet}>
            {met || married ? '날짜 고치기' : '날짜 넣기'}
          </Button>
          <Button variant="ghost" onClick={openDays}>
            기념일 보기 <span aria-hidden>→</span>
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
          첫날을 1일로 세어요. 두 사람 화면에 똑같이 보이고,{' '}
          {anniversaryAlertsOn(state.settings, state.stage)
            ? anniversaryDayOnly(state.stage)
              ? '기념일 당일에 둘 다에게 알려 드려요.'
              : '기념일 7일 전과 당일에 둘 다에게 알려 드려요.'
            : '기념일 알림은 ‘첫 화면’에서 켤 수 있어요.'}{' '}
          첫 여행 같은 우리만의 날은 우리 탭의 ‘기념일’에서 더하고 고칠 수 있어요.
        </p>
      </Card>
      <CoupleDatesSheet open={open} onClose={close} />
    </SettingsSection>
  )
}
