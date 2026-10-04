'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ChoiceButton, LoggedList, hhmm, ro, type LineLevel, type SaveLog } from '@/components/log/parts'
import { Button, cx, inputClass, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { LH_CHOICES } from '@/lib/content/fertility'
import { LH_LABEL, type FertilityView } from '@/lib/logic/calendarView'
import { cycleAt, isSurge } from '@/lib/logic/cycle'
import {
  LH_SLOT_LABEL,
  MAX_LH_PER_DAY,
  addLHTest,
  freeLHSlot,
  isTime,
  lhAskDue,
  lhChangesEstimate,
  lhKey,
  lhSlotOf,
  lhTestsOn,
  lhWhen,
  planLHTest,
  removeLHTest,
  type LHInput,
  type LHPlan,
} from '@/lib/logic/logs'
import { USES_LH_OPTIONS, setUsesLH, type UsesLH } from '@/lib/logic/prefs'
import { nowOn } from '@/lib/logic/today'
import { openLHHowTo } from '@/lib/logLauncher'
import { LH_ASK_DEFERRED_KEY, readDeviceStamp, writeDeviceStamp } from '@/lib/persist'
import { useApp } from '@/lib/store'
import { LH_SLOTS, type ISODate, type LHResult, type LHSlot } from '@/lib/types'

const LEVEL: Record<LHResult, LineLevel> = { negative: 'none', faint: 'faint', positive: 'full', peak: 'dark' }

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

/**
 * The default: two big buttons, one tap (N29, docs/positioning.md §5 'LH
 * 상세'). [양성] saves 양성, [아직] saves 음성 — the same records as the four
 * levels; '자세히' opens 희미 · 가장 진함, the time and the 아침 / 저녁 slots.
 */
const QUICK: ReadonlyArray<{ result: LHResult; label: string; hint: string }> = [
  { result: 'positive', label: '양성', hint: '검사선이 대조선만큼 진해요' },
  { result: 'negative', label: '아직', hint: '검사선이 없거나 연해요' },
]

/**
 * LH (배테기). By default two big buttons — [양성] [아직], one tap (N29) —
 * saved as 양성 / 음성 with today's clock time or a past day's free 아침 /
 * 저녁 slot. '자세히' opens the four levels (음성 · 희미 · 양성 · 가장 진함),
 * the time and the slots — saved the same way, up to two a day. A result
 * that would take another test's place asks first ("08:10 기록을 바꿀까요?") —
 * nothing is overwritten quietly, and 되돌리기 puts the old one back.
 */
export default function LHPanel({
  date,
  view,
  paused,
  save,
}: {
  date: ISODate
  view: FertilityView
  /** Rest cycle / positive test waiting: dates aren't shown, so don't talk about recalculating them. */
  paused: boolean
  save: SaveLog
}) {
  const { state, today, viewer } = useApp()
  const toast = useToast()
  const timeId = useId()
  const isToday = date === today
  const tests = lhTestsOn(state.lhTests, date)
  const [time, setTime] = useState(() => hhmm(nowOn(today)))
  // '자세히': the four levels, the time and the slots (closed by default — N29).
  const [detail, setDetail] = useState(false)
  const detailId = useId()
  // A past day: the first half of the day with no test yet (아침, then 저녁).
  const [slot, setSlot] = useState<LHSlot>(() => freeLHSlot(tests) ?? 'morning')
  const when: Pick<LHInput, 'time' | 'slot'> = isToday ? { time: isTime(time) ? time : undefined } : { slot }
  // The test this choice would stand for: today's at the same minute, a past day's in that half.
  const current = isToday ? tests.find((t) => lhKey(t) === (when.time ?? '')) : tests.find((t) => lhSlotOf(t) === slot)
  const full = tests.length >= MAX_LH_PER_DAY && !current

  // "…기록을 바꿀까요?" — the result picked while another test is in its place.
  const [asking, setAsking] = useState<{ result: LHResult; plan: Extract<LHPlan, { action: 'replace' }> } | null>(null)
  const askRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (asking) askRef.current?.focus()
  }, [asking])

  const input = (result: LHResult): LHInput => ({ date, ...when, result, by: viewer })

  const commit = (result: LHResult, replace: boolean) => {
    const inp = input(result)
    const label = LH_LABEL[result]
    // Only when the estimate really moved (the cycle's first surge), and only where dates are shown.
    const moved = !paused && lhChangesEstimate(state, inp)
    const again = moved ? (view === 'explicit' ? ' · 배란 예상일을 다시 계산했어요' : ' · 예상 날짜를 다시 계산했어요') : ''
    save(
      (s) => addLHTest(s, inp, today, { replace }),
      { kind: 'lh', date },
      `LH ${ro(label)} ${replace ? '바꿨어요' : '남겼어요'}${again}`,
    )
  }

  const pick = (result: LHResult) => {
    const plan = planLHTest(tests, input(result))
    if (plan.action !== 'replace') return commit(result, false)
    // The same result is already there: nothing to change, nothing to ask.
    if (plan.target.result === result) {
      toast.show(`${lhWhen(plan.target)} · ${LH_LABEL[result]}, 이미 남겨 두었어요`)
      return
    }
    setAsking({ result, plan })
  }

  const howTo = (
    <button
      type="button"
      onClick={openLHHowTo}
      className={cx('-mr-2 min-h-[44px] shrink-0 rounded-lg px-2 text-xs font-semibold text-brand-ink underline-offset-2 hover:underline', FOCUS)}
    >
      어떻게 해요?
    </button>
  )

  return (
    <div className="space-y-3">
      <UsesLHAsk view={view} paused={paused} />
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="LH 결과">
        {QUICK.map((q) => (
          <ChoiceButton
            key={q.result}
            label={q.label}
            hint={q.hint}
            level={LEVEL[q.result]}
            current={!!current && isSurge(current.result) === (q.result === 'positive')}
            onClick={() => pick(q.result)}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={detail}
          aria-controls={detailId}
          onClick={() => setDetail((v) => !v)}
          className={cx(
            '-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-ink-2 hover:text-ink',
            FOCUS,
          )}
        >
          자세히
          <Icon name="chev" className={cx('h-4 w-4 transition-transform', detail && 'rotate-180')} strokeWidth={2.2} />
          <span className="sr-only">{detail ? ' 접기' : ' · 희미·가장 진함, 검사 시각'}</span>
        </button>
        {howTo}
      </div>
      {detail ? (
        <div id={detailId} className="space-y-3 rounded-xl border border-line bg-surface-2/60 p-3">
          <p className="text-[13px] leading-relaxed text-ink-2">
            검사선(T)을 대조선(C)과 비교해 골라 주세요.
            {paused ? '' : view === 'explicit' ? ' 첫 양성이 나오면 배란 예상일을 다시 계산해요.' : ' 첫 양성이 나오면 예상 날짜를 다시 계산해요.'}
          </p>
          {isToday ? (
            <div className="flex items-center gap-3">
              <label htmlFor={timeId} className="shrink-0 text-xs font-semibold text-ink-2">
                검사 시각
              </label>
              <input
                id={timeId}
                type="time"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value)
                  setAsking(null)
                }}
                className={`${inputClass} w-32`}
              />
            </div>
          ) : (
            <div role="group" aria-label="검사한 때" className="grid grid-cols-2 gap-2">
              {LH_SLOTS.map((s) => {
                const logged = tests.find((t) => lhSlotOf(t) === s)
                const on = s === slot
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setSlot(s)
                      setAsking(null)
                    }}
                    className={cx(
                      'min-h-[44px] rounded-xl border px-2 py-1 text-left text-sm font-semibold transition-colors',
                      FOCUS,
                      on ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
                    )}
                  >
                    {LH_SLOT_LABEL[s]}
                    <span className="block text-[11px] font-normal text-ink-3">
                      {logged ? `${logged.time ? `${logged.time} · ` : ''}${LH_LABEL[logged.result]}` : '아직 없어요'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="LH 테스트 결과">
            {LH_CHOICES.map((c) => (
              <ChoiceButton
                key={c.result}
                label={LH_LABEL[c.result]}
                hint={c.hint}
                level={LEVEL[c.result]}
                current={current?.result === c.result}
                onClick={() => pick(c.result)}
              />
            ))}
          </div>
        </div>
      ) : null}
      {asking ? (
        <div
          ref={askRef}
          tabIndex={-1}
          role="group"
          aria-label="기록 바꾸기"
          className="rounded-xl border border-brand/40 bg-brand-soft/50 p-3 outline-none"
        >
          <p className="text-sm font-semibold leading-snug text-ink">
            {lhWhen(asking.plan.target)} 기록({LH_LABEL[asking.plan.target.result]})을 {ro(LH_LABEL[asking.result])} 바꿀까요?
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                const { result } = asking
                setAsking(null)
                commit(result, true)
              }}
            >
              바꾸기
            </Button>
            <Button variant="secondary" onClick={() => setAsking(null)}>
              취소
            </Button>
          </div>
        </div>
      ) : full ? (
        <p className="text-xs leading-relaxed text-ink-3">
          {isToday ? `하루 ${MAX_LH_PER_DAY}번까지 남겨요. 더 고르면 어느 기록을 바꿀지 먼저 물어볼게요.` : '두 번 다 남겼어요. 고르면 바꿀지 먼저 물어볼게요.'}
        </p>
      ) : null}
      <LoggedList
        title="이 날의 LH 기록"
        items={tests.map((t) => ({
          key: `${lhKey(t)}-${t.result}`,
          text: `${lhWhen(t)} · ${LH_LABEL[t.result]}`,
          removeLabel: `${lhKey(t) ? `${lhWhen(t)} ` : ''}LH ${LH_LABEL[t.result]} 기록 지우기`,
          onRemove: () =>
            save((s) => removeLHTest(s, date, lhKey(t) || undefined), { kind: 'lh', date }, 'LH 기록을 지웠어요', { keepOpen: true }),
        }))}
      />
    </div>
  )
}

/**
 * '배란테스트기 써요? [써요][안 써요][나중에]' — asked once, here, when the cycle
 * first reaches the LH moment (logs.lhAskDue); '나중에' waits for the next cycle
 * (per device). After '안 써요' a one-liner with 바꾸기 stays, since logging is
 * still the owner's choice.
 */
function UsesLHAsk({ view, paused }: { view: FertilityView; paused: boolean }) {
  const { state, update, today, viewer } = useApp()
  const toast = useToast()
  const [deferred, setDeferred] = useState<string | null>(() => readDeviceStamp(LH_ASK_DEFERRED_KEY))
  const [changing, setChanging] = useState(false)
  const uses = state.settings.usesLH
  const due = !paused && lhAskDue(state, today, deferred)
  const strips = view === 'explicit' ? '배란테스트기(LH)' : 'LH 테스트기'

  if (!due && !changing) {
    if (uses !== false) return null
    return (
      <p className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 py-1 pl-3 pr-1 text-xs text-ink-2">
        <span>{strips} 안 써요</span>
        <button
          type="button"
          onClick={() => setChanging(true)}
          className={cx('min-h-[44px] rounded-lg px-2 text-xs font-semibold text-brand-ink underline-offset-2 hover:underline', FOCUS)}
        >
          바꾸기
        </button>
      </p>
    )
  }

  const answer = (value: UsesLH) => {
    update((s) => setUsesLH(s, value, viewer))
    if (value === 'later') {
      const start = cycleAt(state, today)?.start
      if (start) {
        writeDeviceStamp(LH_ASK_DEFERRED_KEY, start)
        setDeferred(start)
      }
    }
    setChanging(false)
    toast.show(
      value === true
        ? '좋아요. 결과를 여기에 남겨 주세요'
        : value === false
          ? 'LH 권유를 쉬어요 · 설정 › 내 알림에서 바꿀 수 있어요'
          : '다음 주기에 다시 물어볼게요',
    )
  }

  return (
    <section aria-label={`${strips} 써요?`} className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">{strips} 써요?</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">‘안 써요’면 홈에서 LH 권유가 사라져요. 기록은 언제든 할 수 있어요.</p>
        </div>
        <button
          type="button"
          onClick={openLHHowTo}
          className={cx('-mr-2 -mt-1 min-h-[44px] shrink-0 rounded-lg px-2 text-xs font-semibold text-brand-ink underline-offset-2 hover:underline', FOCUS)}
        >
          어떻게 해요?
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="답">
        {USES_LH_OPTIONS.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={!due && uses === o.value}
            onClick={() => answer(o.value)}
            className={cx(
              'min-h-[44px] rounded-xl border px-2 text-sm font-semibold transition-colors',
              FOCUS,
              !due && uses === o.value ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-surface text-ink hover:bg-surface-2',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </section>
  )
}
