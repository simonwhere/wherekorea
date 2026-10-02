// The expected period as the user reads it — ONE copy table for the home card,
// the 주기 tab and the notices (N10). The math lives in lib/logic/cycle.ts
// (expectedPeriod); this file only words it. The date is always a range
// ("10월 21일~23일 무렵 (예상)") because the next period is a range, and the
// '임신 테스트' suggestion waits until LATE_TEST_DAYS days past it.

import { formatKo } from '../dates'
import type { ExpectedPeriod } from './cycle'

const day = (d: string) => formatKo(d, { weekday: false })

/** '10월 21일~23일' · '9월 27일~10월 1일' · '10월 21일' (a one-day range). */
export function dueRange(due: Pick<ExpectedPeriod, 'from' | 'to'>): string {
  if (due.from === due.to) return day(due.from)
  const sameMonth = due.from.slice(0, 7) === due.to.slice(0, 7)
  return `${day(due.from)}~${sameMonth ? `${Number(due.to.slice(8))}일` : day(due.to)}`
}

/** '10월 21일~23일 무렵 (예상)'. */
export function dueLine(due: Pick<ExpectedPeriod, 'from' | 'to'>): string {
  return `${dueRange(due)} 무렵 (예상)`
}

/** Days past the range from which the home card and the notices suggest a pregnancy test. */
export const LATE_TEST_DAYS = 3

/**
 * After '아직 안 왔어요' (15 days or more past the range, no positive test): one
 * quiet 🩺 notice to the owner every this many days (review ④, N12). No count
 * of days in its wording — the evidence has none.
 */
export const AMENORRHEA_NOTICE_DAYS = 7

/**
 * Everything that is said about the expected period, in one place. Whoever
 * reads a date here reads the same range as everyone else.
 */
export const PERIOD_DUE_COPY = {
  /** 주기 tab row label (and the home's eyebrow prefix). */
  rowLabel: '다음 생리 (예상)',
  rowLabelLate: '생리 예정 (지남)',
  /** What the range rests on — the row's small print and the basis badge. */
  basis: { lh: 'LH 기준', calendar: '기록 기준', settings: '설정값 기준' } as const satisfies Record<ExpectedPeriod['basis'], string>,
  /** The day before the range starts (one notice per cycle). */
  dueTomorrow: {
    title: '🗓️ 내일부터 생리 예정 무렵이에요',
    body: (due: ExpectedPeriod) => `${dueLine(due)}. 시작하면 달력에 기록해 주세요.`,
  },
  /** Inside the range: the period may start any day — no test prompt yet. */
  dueNow: {
    title: '생리 예정 무렵이에요',
    body: (due: ExpectedPeriod) => `${dueRange(due)} 무렵이에요 (예상). 시작하면 기록해 주세요.`,
  },
  /** The day after the range (one notice per cycle): no test prompt yet. */
  late: {
    title: '🗓️ 생리 예정일이 지났어요',
    body: (due: ExpectedPeriod) => `예정 범위(${dueRange(due)})가 지났어요. 시작했다면 기록해 주세요. 주기는 원래 조금씩 달라져요.`,
  },
  /** LATE_TEST_DAYS days past the range (one notice per cycle). */
  lateTest: {
    title: '🧪 임신 테스트를 해 볼 때예요',
    body: (due: ExpectedPeriod, daysLate: number) =>
      `예정 범위(${dueRange(due)})가 ${daysLate}일 지났어요. 생리가 시작됐다면 기록하고, 아니라면 임신 테스트를 해 봐요.`,
  },
  /** Titles for a late period: the 주기 tab's, and the home card's shorter one. */
  lateTitle: (daysLate: number) => `생리 예정일이 ${daysLate}일 지났어요`,
  lateTitleShort: (daysLate: number) => `예정일이 ${daysLate}일 지났어요`,
  /** Under the late title, before / from LATE_TEST_DAYS. */
  lateSub: '시작했다면 기록해 주세요. 주기는 원래 조금씩 달라져요.',
  lateSubTest: '시작했다면 기록해 주세요. 주기는 원래 조금씩 달라져요. 임신 테스트를 해 봐도 좋아요.',
  /**
   * 15 days or more past the range, after '아직 안 왔어요': keeps counting. No
   * number of days here — the evidence (NICE, docs/research/medical.json) says
   * only that irregular or absent periods are a reason to be seen earlier.
   */
  stillWaiting: {
    eyebrow: (cycleDay: number) => `주기 ${cycleDay}일째 · 길어지고 있어요`,
    title: '조금 더 기다려 봐요',
    body: '생리가 시작되면 기록해 주세요. 임신 테스트가 음성인데 생리가 많이 늦으면 병원에서 확인해 봐요.',
    // Long enough to read as a footnote under the buttons (components/today/CycleBlock NOTE_BESIDE_MAX),
    // so the two actions stay above the tab bar on a 375×667 phone.
    // Evidence: docs/research/medical.json (NICE, 'When to seek evaluation') — the path itself never reaches the screen.
    note: '생리가 불규칙하거나 없으면 1년을 기다리지 말고 더 일찍 상담하도록 안내해요 (NICE).',
    /** The DoctorCard line for the 'amenorrhea' reason (lib/logic/today.ts doctorAdvice). */
    advice: '생리가 많이 늦어지고 있어요. 임신 테스트가 음성이라면, 불규칙하거나 없는 생리는 더 일찍 상담하도록 안내해요 (NICE).',
    /** The quiet notice every AMENORRHEA_NOTICE_DAYS days (notifications.ts), to the owner only. */
    notice: {
      title: '🩺 생리가 많이 늦어지고 있어요',
      body: '생리가 시작되면 기록해 주세요. 임신 테스트가 음성인데 생리가 없다면 병원에서 확인해 봐요. 생리가 불규칙하거나 없으면 1년을 기다리지 말고 더 일찍 상담하도록 안내해요 (NICE).',
    },
  },
  /** 15 days or more past the range, not answered yet: a missed log is the likelier story. */
  missedLog: {
    title: '혹시 기록을 빠뜨렸나요?',
    body: (lastStart: string) => `마지막 기록은 ${day(lastStart)}이에요. 그 뒤에 생리가 있었다면 기록해 주세요.`,
    stillWaiting: '아직 안 왔어요',
  },
} as const
