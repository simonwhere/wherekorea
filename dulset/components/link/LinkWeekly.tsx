'use client'

// '매주 이 시간에 알려 받기' on the partner page (Now 3 N31) — the one weekly
// prompt that needs no server (docs/positioning.md §4 #7): he picks a day,
// and his phone's own calendar gets a repeating event '둘셋 · 이번 주 우리'
// (lib/logic/ics weeklyLinkIcs — RRULE FREQ=WEEKLY, no health word, nothing
// about her cycle) that links to this page WITHOUT the share token: a
// calendar never holds the secret. Opened from it on this phone, the page
// uses the token this browser remembers (model LINK_TOKEN_KEY). Nothing is
// sent anywhere; the file is made right here.

import { useState } from 'react'
import { cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { weekdayIndex } from '@/lib/dates'
import { WEEKLY_DAYS, WEEKLY_DAY_LABEL, WEEKLY_LINK_DEFAULT_TIME, type WeeklyDay } from '@/lib/logic/ics'
import type { ISODate } from '@/lib/types'
import { Pill } from './bits'

/** The day of the week `date` falls on, as an RFC 5545 code (Monday first). */
export function weeklyDayOf(date: ISODate): WeeklyDay {
  // weekdayIndex: 0 = Sunday … 6 = Saturday.
  return WEEKLY_DAYS[(weekdayIndex(date) + 6) % 7]!
}

/** '저녁 8시' from 'HH:MM'. */
function timeWords(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2))
  const m = Number(hhmm.slice(3, 5))
  const part = h < 12 ? '오전' : h < 18 ? '오후' : '저녁'
  const hour = h % 12 || 12
  return `${part} ${hour}시${m ? ` ${m}분` : ''}`
}

export default function LinkWeekly({
  today,
  onDownload,
  className,
}: {
  today: ISODate
  /** Make and hand over the .ics for `day` (LinkPage: weeklyLinkIcs + downloadText). */
  onDownload: (day: WeeklyDay) => void
  className?: string
}) {
  const [day, setDay] = useState<WeeklyDay>(() => weeklyDayOf(today))
  return (
    <section
      aria-label="매주 이 시간에 알려 받기"
      className={cx('rounded-card bg-surface px-[18px] py-4 shadow-warm dark:border dark:border-line/70 dark:shadow-none', className)}
    >
      <p className="flex items-center gap-1.5 text-[12.5px] font-bold tracking-[-0.01em] text-brand-ink">
        <Icon name="cal" className="h-4 w-4 shrink-0" />
        매주 이 시간에 알려 받기
      </p>
      <p className="mt-1 text-[13px] leading-[1.55] text-ink-2">
        고른 요일 {timeWords(WEEKLY_LINK_DEFAULT_TIME)}에 휴대폰 캘린더가 ‘둘셋 · 이번 주 우리’를 알려 줘요. 링크의 비밀 주소는 넣지 않아요.
      </p>
      <div role="group" aria-label="알려 받을 요일" className="mt-3 grid grid-cols-7 gap-1">
        {WEEKLY_DAYS.map((d) => {
          const on = d === day
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              data-weekly-day={d}
              onClick={() => setDay(d)}
              className={cx(
                'flex h-11 items-center justify-center rounded-xl border text-[14px] font-bold transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                on ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
              )}
            >
              {WEEKLY_DAY_LABEL[d]}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Pill tone="outline" icon="plus" onClick={() => onDownload(day)}>
          캘린더에 넣기
        </Pill>
        <span className="text-[12px] text-ink-3">
          매주 {WEEKLY_DAY_LABEL[day]}요일 {timeWords(WEEKLY_LINK_DEFAULT_TIME)} · 이 폰에서 열면 바로 보여요
        </span>
      </div>
    </section>
  )
}
