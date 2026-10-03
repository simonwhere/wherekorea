'use client'

// '이번 주 우리 둘' on the partner page (Now 3 N21, his side) — the weekly loop
// of docs/positioning.md §4: once a week he picks one relationship-side thing
// out of three (weekTogether.weekOptions, computed on her phone and carried
// in the snapshot as ids and words), says [했어요] when it is done, sees 내
// 준비 (his own progress, no zeros) and, when she sent one, her [고마워요] for
// the rest of the week. A pick is a 'week-pick' event, [했어요] a 'week-done'
// event — ids and a date only. What he picked is not shown to her; only
// [했어요] is (her home's '이번 주 민수님'). Nothing here is shown in the quiet
// after a loss: the snapshot carries no week then.

import { useState } from 'react'
import { cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { formatKo } from '@/lib/dates'
import type { SnapshotWeek } from '@/lib/logic/partnerSnapshot'
import type { WeekOptionId } from '@/lib/logic/weekTogether'
import { Pill } from './bits'
import { WEEK_BLOCK_TITLE, prepParts, thanksText } from './model'

export default function LinkWeek({
  week,
  ownerName,
  onPick,
  onDone,
  className,
}: {
  /** The week with his local marks applied (model.viewWeek). */
  week: SnapshotWeek
  ownerName: string
  onPick: (id: WeekOptionId) => void
  onDone: () => void
  className?: string
}) {
  const [changing, setChanging] = useState(false)
  const picked = week.pick ? week.options.find((o) => o.id === week.pick) : undefined
  const choosing = !week.done && (!picked || changing)
  const prep = prepParts(week.prep)

  return (
    <section
      aria-label={WEEK_BLOCK_TITLE}
      className={cx('rounded-card bg-surface px-[18px] py-4 shadow-warm dark:border dark:border-line/70 dark:shadow-none', className)}
    >
      <p className="text-[12.5px] font-bold tracking-[-0.01em] text-brand-ink">
        {WEEK_BLOCK_TITLE} <span className="font-semibold text-ink-3">· {formatKo(week.monday, { weekday: false })}부터</span>
      </p>

      {week.done ? (
        <div role="status">
          <p className="mt-1 flex items-center gap-1.5 text-[17px] font-extrabold tracking-[-0.03em] text-ink">
            <Icon name="check" className="h-5 w-5 shrink-0 text-ok" strokeWidth={2.6} />
            <span className="min-w-0">{week.doneText ?? picked?.text}</span>
          </p>
          <p className="mt-1 text-[13px] leading-[1.5] text-ink-2">이번 주 하나를 했어요. 다음 주 월요일에 새로 골라요.</p>
        </div>
      ) : choosing ? (
        <>
          <h3 className="mt-1 text-[17px] font-extrabold tracking-[-0.03em] text-ink">이번 주 내가 맡을 것 하나</h3>
          <p className="mt-0.5 text-[12.5px] leading-[1.5] text-ink-3">
            셋 중 하나를 골라요. 고른 건 {ownerName}님에게 보이지 않고, [했어요]를 누르면 전해져요.
          </p>
          <div role="group" aria-label="이번 주 맡을 것" className="mt-3 grid gap-2">
            {week.options.map((o) => {
              const on = o.id === week.pick
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={on}
                  data-week-option={o.id}
                  onClick={() => {
                    setChanging(false)
                    if (!on) onPick(o.id)
                  }}
                  className={cx(
                    'flex min-h-[48px] w-full items-center gap-2.5 rounded-xl border px-3.5 py-2 text-left text-[14.5px] font-semibold transition-colors',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                    on ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line bg-surface text-ink hover:bg-surface-2',
                  )}
                >
                  <span
                    aria-hidden
                    className={cx(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                      on ? 'border-brand bg-brand text-white' : 'border-line',
                    )}
                  >
                    {on ? <Icon name="check" className="h-3 w-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0">{o.text}</span>
                </button>
              )
            })}
          </div>
        </>
      ) : picked ? (
        <>
          <h3 className="mt-1 text-[17px] font-extrabold tracking-[-0.03em] text-ink">{picked.text}</h3>
          <p className="mt-0.5 text-[12.5px] leading-[1.5] text-ink-3">이번 주 안에 하면 돼요. 하고 나서 눌러 주세요.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill tone="primary" icon="check" onClick={onDone}>
              했어요
            </Pill>
            <button
              type="button"
              onClick={() => setChanging(true)}
              className="inline-flex min-h-[44px] items-center px-2 text-[13px] font-bold text-ink-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              다른 걸로 바꾸기
            </button>
          </div>
        </>
      ) : null}

      {prep.length || week.thanks ? (
        <div className="mt-3.5 space-y-1.5 border-t border-line/75 pt-3 text-[13px] leading-[1.5]">
          {prep.length ? (
            <p className="flex items-start gap-2 text-ink-2">
              <Icon name="sprout" className="mt-px h-4 w-4 shrink-0 text-ink-3" />
              <span className="min-w-0">
                <b className="font-bold text-ink">내 준비</b> · {prep.join(' · ')}
              </span>
            </p>
          ) : null}
          {week.thanks ? (
            <p className="flex items-start gap-2 text-ink-2">
              <Icon name="heart" className="mt-px h-4 w-4 shrink-0 fill-current text-her" strokeWidth={1.5} />
              {/* '지은님이 고마워했어요 (토)' says who it is from — no '지은님에게서 ·' label in front of it. */}
              <span className="min-w-0 font-bold text-ink">{thanksText(ownerName, week.thanks)}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
