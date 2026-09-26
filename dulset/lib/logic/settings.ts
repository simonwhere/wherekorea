// Settings-tab state changes and view helpers (pure).
//
// Every state change here returns a new AppState and keeps the couple's
// invariants: exactly one member tracks the cycle, cycle numbers stay in a
// plausible range, and nothing touches history (periods, diary, checks).

import { addMonths, formatKo, isISODate, parts } from '../dates'
import {
  MEMBER_IDS,
  type AlertStyle,
  type AppState,
  type BabySex,
  type CycleSettings,
  type ISODate,
  type Member,
  type MemberId,
  type Role,
  type Settings,
  type Stage,
} from '../types'
import { DEFAULT_CYCLE_LENGTH, DEFAULT_PERIOD_LENGTH, ROLE_EMOJI, ROLE_LABEL, otherMember } from '../initial'
import type { CycleStats } from './cycle'
import { confirmPregnancy } from './today'
import { updatePregnancy } from './pregnancy'

// ── Members ─────────────────────────────────────────────────

export const NAME_MAX = 12

/** Small, friendly avatar set for the member edit sheet (2 rows of 6). */
export const MEMBER_EMOJIS: readonly string[] = [
  ROLE_EMOJI.wife,
  ROLE_EMOJI.husband,
  ROLE_EMOJI.partner,
  '👱‍♀️',
  '🧔',
  '🐰',
  '🐻',
  '🦊',
  '🐱',
  '🐶',
  '🌷',
  '🌻',
]

/** The picker set, with the member's current emoji first if it isn't in it. */
export function emojiChoices(current: string): string[] {
  return MEMBER_EMOJIS.includes(current) ? [...MEMBER_EMOJIS] : [current, ...MEMBER_EMOJIS.slice(0, -1)]
}

export const ROLES: readonly Role[] = ['wife', 'husband', 'partner']

export type MemberPatch = Partial<Pick<Member, 'name' | 'role' | 'emoji' | 'birthYear'>>

/** Birth years the edit sheet accepts (about 14–80 years old). */
export function birthYearBounds(today: ISODate): { min: number; max: number } {
  const year = parts(today).year
  return { min: year - 80, max: year - 14 }
}

export function isValidBirthYear(value: number, today: ISODate): boolean {
  const b = birthYearBounds(today)
  return Number.isInteger(value) && value >= b.min && value <= b.max
}

/**
 * Edit a member's profile. `tracksCycle` and `id` can't be changed here (use
 * setCycleOwner). An empty name falls back to the role label; `birthYear:
 * undefined` clears it; a non-integer year is ignored.
 */
export function updateMember(state: AppState, id: MemberId, patch: MemberPatch): AppState {
  const members = state.couple.members.map((m) => {
    if (m.id !== id) return m
    const next: Member = { ...m }
    if (patch.role && ROLES.includes(patch.role)) next.role = patch.role
    if (patch.name !== undefined) {
      const name = patch.name.trim().slice(0, NAME_MAX)
      next.name = name || ROLE_LABEL[next.role]
    }
    if (patch.emoji !== undefined && patch.emoji.trim()) next.emoji = patch.emoji.trim()
    if ('birthYear' in patch) {
      const y = patch.birthYear
      if (y === undefined) delete next.birthYear
      else if (Number.isInteger(y) && y > 1900) next.birthYear = y
    }
    return next
  }) as [Member, Member]
  return { ...state, couple: { ...state.couple, members } }
}

/** Make `id` the one member whose cycle is tracked (the other one never is). */
export function setCycleOwner(state: AppState, id: MemberId): AppState {
  const members = state.couple.members.map((m) => ({ ...m, tracksCycle: m.id === id })) as [Member, Member]
  return { ...state, couple: { ...state.couple, members } }
}

// ── Linking (simulated in the prototype) ────────────────────

export function linkPartner(state: AppState, nowISO: string): AppState {
  return { ...state, couple: { ...state.couple, linkedAt: nowISO } }
}

export function unlinkPartner(state: AppState): AppState {
  const couple = { ...state.couple }
  delete couple.linkedAt
  return { ...state, couple }
}

// ── Settings ────────────────────────────────────────────────

export const ALERT_STYLES: readonly AlertStyle[] = ['explicit', 'soft', 'off']

export function setAlertStyle(state: AppState, id: MemberId, style: AlertStyle): AppState {
  if (!ALERT_STYLES.includes(style)) return state
  return {
    ...state,
    settings: { ...state.settings, alertStyle: { ...state.settings.alertStyle, [id]: style } },
  }
}


export function setSetting<K extends keyof Settings>(state: AppState, key: K, value: Settings[K]): AppState {
  return { ...state, settings: { ...state.settings, [key]: value } }
}

export const CYCLE_LENGTH_RANGE = { min: 15, max: 60 } as const
export const PERIOD_LENGTH_RANGE = { min: 1, max: 14 } as const

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** Patch the fallback cycle numbers; values are rounded and clamped, NaN is ignored. */
export function setCycle(state: AppState, patch: Partial<CycleSettings>): AppState {
  const cycle = { ...state.cycle }
  if (patch.cycleLength !== undefined && Number.isFinite(patch.cycleLength)) {
    cycle.cycleLength = clampInt(patch.cycleLength, CYCLE_LENGTH_RANGE.min, CYCLE_LENGTH_RANGE.max)
  }
  if (patch.periodLength !== undefined && Number.isFinite(patch.periodLength)) {
    cycle.periodLength = clampInt(patch.periodLength, PERIOD_LENGTH_RANGE.min, PERIOD_LENGTH_RANGE.max)
  }
  return { ...state, cycle }
}

/** How far back "함께 준비를 시작한 날" can go. */
export const TTC_MAX_YEARS = 20

export function ttcBounds(today: ISODate): { min: ISODate; max: ISODate } {
  return { min: addMonths(today, -12 * TTC_MAX_YEARS), max: today }
}

/**
 * Error for a typed "함께 준비를 시작한 날", or null when it can be saved.
 * The lower bound also rejects the half-typed years a desktop date field
 * reports while typing ('0002-…', '0202-…'), which would otherwise be saved
 * and trigger a "see a doctor" notice for thousands of months of trying.
 */
export function validateTtcStart(value: string, today: ISODate): string | null {
  if (!isISODate(value)) return '날짜를 선택해 주세요.'
  if (value > today) return '오늘 이후 날짜는 고를 수 없어요.'
  if (value < ttcBounds(today).min) return `최근 ${TTC_MAX_YEARS}년 안의 날짜를 골라 주세요.`
  return null
}

/**
 * When the couple started trying. Empty/undefined clears it; an invalid or
 * implausibly old date is ignored; a future date is pulled back to `today`.
 */
export function setTtcStart(state: AppState, date: string | undefined, today: ISODate): AppState {
  const settings = { ...state.settings }
  if (!date) {
    delete settings.ttcStart
    return { ...state, settings }
  }
  if (!isISODate(date) || date < ttcBounds(today).min) return state
  settings.ttcStart = date > today ? today : date
  return { ...state, settings }
}

/** The line under "주기 설정" explaining which numbers predictions use right now. */
export function cycleSourceNote(stats: Pick<CycleStats, 'source'>, periodCount: number): string {
  if (stats.source === 'logs')
    return '생리 기록이 쌓여서 지금은 기록 평균으로 예상해요. 아래 주기 길이는 기록이 부족할 때만 쓰여요.'
  if (periodCount >= 2)
    return '기록 사이 간격이 15~60일일 때만 평균에 넣어요. 그런 기록이 생기기 전까지는 아래 값으로 예상해요.'
  return '생리 시작일을 두 번 이상 기록하면 기록으로 평균을 계산해요. 그 전까지는 아래 값으로 예상해요.'
}

// ── Alert preview ───────────────────────────────────────────

export const ALERT_STYLE_OPTIONS: ReadonlyArray<{ value: AlertStyle; label: string; hint: string }> = [
  { value: 'explicit', label: '가임기라고 알려 주세요', hint: '예상 날짜와 함께 알려 드려요' },
  { value: 'soft', label: '‘우리의 주간’처럼 은근하게', hint: '건강 용어 없이, 둘만의 시간으로' },
  { value: 'off', label: '받지 않을래요', hint: '가임기 알림만 쉬어요' },
]

export function alertStyleLabel(style: AlertStyle): string {
  return ALERT_STYLE_OPTIONS.find((o) => o.value === style)?.label ?? ''
}

export interface AlertPreview {
  /** null when no fertile-window notification would be sent. */
  message: { title: string; body: string } | null
  note: string
}

/**
 * What the fertile-window heads-up would look like for this viewer. Mirrors the
 * wording in lib/logic/notifications.ts so the preview never over-promises.
 */
export function alertPreview(
  style: AlertStyle,
  opts: { lowPressure: boolean; isCycleOwner: boolean; window?: { fertileStart: ISODate; fertileEnd: ISODate } },
): AlertPreview {
  if (opts.lowPressure) {
    return {
      message: null,
      note: '부담 없이 모드라 두 사람 모두 가임기 알림과 카운트다운 없이 지내요. 체크·응원 알림은 그대로 와요.',
    }
  }
  if (style === 'off') {
    return {
      message: null,
      note: opts.isCycleOwner
        ? '가임기 알림은 오지 않아요. 달력의 예상 표시는 그대로 볼 수 있어요.'
        : '가임기 알림은 오지 않고, 달력에서도 예상 가임기 표시가 숨겨져요. 체크·응원 알림은 그대로 와요.',
    }
  }
  if (style === 'soft') {
    return {
      message: {
        title: '💞 이번 주는 우리의 주간이에요',
        body: '둘만의 시간을 챙겨 볼까요? 데이트 탭에 아이디어를 골라 뒀어요.',
      },
      note: '우리의 주간이 시작되기 하루 전에 한 번만, 건강 용어 없이 알려 드려요.',
    }
  }
  const w = opts.window
  return {
    message: {
      title: '💞 가임기가 다가왔어요',
      body: w
        ? `${formatKo(w.fertileStart)}부터 ${formatKo(w.fertileEnd)}까지가 예상 가임기예요. 예상치라 LH 배란테스트로 확인하면 더 정확해요.`
        : '예상 가임기 날짜를 알려 드려요. 예상치라 LH 배란테스트로 확인하면 더 정확해요.',
    },
    note: '예상 가임기 하루 전과, 가능성이 가장 높은 날들에 알려 드려요.',
  }
}

/** Lock-screen version of a notification (discreet mode hides the content). */
export function lockScreenText(message: { title: string; body: string }, discreet: boolean): { title: string; body: string } {
  return discreet ? { title: '둘셋', body: '새 알림이 있어요 💌' } : message
}

// ── Stage ───────────────────────────────────────────────────

export const STAGE_INFO: Record<Stage, { icon: string; label: string; body: string }> = {
  preparing: { icon: '🌱', label: '임신 준비 중', body: '두 사람의 체크, 달력, 데이트를 함께 챙기고 있어요.' },
  pregnant: { icon: '🤰', label: '임신 중', body: '주수와 검사 일정, 태교일기를 함께 챙기고 있어요.' },
  parenting: { icon: '👶', label: '육아 중', body: '아기의 하루하루와 기념일을 함께 기록하고 있어요.' },
}

/**
 * Switch to the pregnancy stage (same as the 오늘 tab's confirmation, so the
 * partner gets one "기쁜 소식" notice however it was recorded) and apply an
 * optional doctor-given due date.
 */
export function markPregnant(
  state: AppState,
  input: { lmp: ISODate; dueDate?: ISODate },
  today: ISODate,
  from: MemberId,
  nowISO: string,
): AppState {
  const next = confirmPregnancy(state, input.lmp, today, from, otherMember(from), nowISO)
  return input.dueDate ? updatePregnancy(next, { dueDateOverride: input.dueDate }) : next
}

// ── Programs ────────────────────────────────────────────────

/** '2025-01-01' → '2025.1.1'; free text ('지자체별 운영') is kept as is. */
export function formatDot(value: string): string {
  if (!isISODate(value)) return value
  const { year, month, day } = parts(value)
  return `${year}.${month}.${day}`
}

/** Program "effective" line: '2025-01-01' → '2025.1.1 시행'; free text as is. */
export function effectiveLabel(effective: string): string {
  return isISODate(effective) ? `${formatDot(effective)} 시행` : effective
}

// ── Backup / reset ──────────────────────────────────────────

export const BACKUP_FILENAME = 'dulset-backup.json'
/** Backups are plain JSON (no photos); anything bigger is not ours. */
export const BACKUP_MAX_BYTES = 5 * 1024 * 1024

export interface BackupSummary {
  names: string
  stage: string
  periods: number
  diary: number
  photos: number
  checkDays: number
  createdAt?: ISODate
}

/** What a backup contains — shown before it replaces the current data. */
export function backupSummary(state: AppState): BackupSummary {
  const created = typeof state.createdAt === 'string' ? state.createdAt.slice(0, 10) : undefined
  return {
    names: state.couple.members.map((m) => m.name).join(' · '),
    stage: STAGE_INFO[state.stage]?.label ?? state.stage,
    periods: state.periods.length,
    diary: state.diary.length,
    photos: state.diary.filter((d) => d.photoId).length,
    checkDays: Object.keys(state.checkLog).length,
    createdAt: isISODate(created) ? created : undefined,
  }
}

export const STAGES: readonly Stage[] = ['preparing', 'pregnant', 'parenting']
const SEXES: readonly BabySex[] = ['girl', 'boy', 'unknown']

type Loose = Record<string, unknown>
const isObj = (v: unknown): v is Loose => !!v && typeof v === 'object' && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isMemberId = (v: unknown): v is MemberId => v === 'a' || v === 'b'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function cleanMember(raw: Loose, id: MemberId): Member {
  const role: Role = ROLES.includes(raw.role as Role) ? (raw.role as Role) : 'partner'
  const m = { ...raw } as unknown as Member
  m.id = id
  m.role = role
  m.name = isStr(raw.name) && raw.name.trim() ? raw.name : ROLE_LABEL[role]
  m.emoji = isStr(raw.emoji) && raw.emoji.trim() && raw.emoji.length <= 16 ? raw.emoji : ROLE_EMOJI[role]
  m.tracksCycle = raw.tracksCycle === true
  const y = raw.birthYear
  if (!(isNum(y) && Number.isInteger(y) && y > 1900 && y < 2200)) delete m.birthYear
  return m
}

/**
 * Checks a parsed backup (lib/storage parseState only checks the outline) and
 * repairs what the screens rely on, so a hand-edited or damaged file can't
 * crash the app after it replaces this device's data. Returns null when it
 * doesn't look like a 둘셋 couple at all (unknown stage, members other than
 * 'a' and 'b', no invite code). Unknown extra fields are kept.
 */
export function sanitizeBackup(input: AppState): AppState | null {
  if (!STAGES.includes(input.stage)) return null
  if (!isObj(input.couple) || !isStr(input.couple.inviteCode)) return null
  const byId = new Map<MemberId, Member>()
  for (const raw of input.couple.members as unknown[]) {
    if (!isObj(raw) || !isMemberId(raw.id) || byId.has(raw.id)) return null
    byId.set(raw.id, cleanMember(raw, raw.id))
  }
  const a = byId.get('a')
  const b = byId.get('b')
  if (!a || !b) return null

  let members: [Member, Member] = [a, b]
  const owners = members.filter((m) => m.tracksCycle)
  if (owners.length !== 1) {
    const owner = owners[0]?.id ?? 'a'
    members = members.map((m) => ({ ...m, tracksCycle: m.id === owner })) as [Member, Member]
  }
  const ownerId = members.find((m) => m.tracksCycle)!.id

  const couple: AppState['couple'] = { ...input.couple, members }
  if (!isStr(couple.linkedAt)) delete couple.linkedAt

  const c: Loose = isObj(input.cycle) ? input.cycle : {}
  const cycle: CycleSettings = {
    cycleLength: isNum(c.cycleLength)
      ? clampInt(c.cycleLength, CYCLE_LENGTH_RANGE.min, CYCLE_LENGTH_RANGE.max)
      : DEFAULT_CYCLE_LENGTH,
    periodLength: isNum(c.periodLength)
      ? clampInt(c.periodLength, PERIOD_LENGTH_RANGE.min, PERIOD_LENGTH_RANGE.max)
      : DEFAULT_PERIOD_LENGTH,
  }

  const st: Loose = isObj(input.settings) ? input.settings : {}
  const styles: Loose = isObj(st.alertStyle) ? st.alertStyle : {}
  const styleFor = (id: MemberId): AlertStyle =>
    ALERT_STYLES.includes(styles[id] as AlertStyle) ? (styles[id] as AlertStyle) : id === ownerId ? 'explicit' : 'soft'
  const settings: Settings = {
    ...(st as unknown as Settings),
    discreet: st.discreet === true,
    browserNotifications: st.browserNotifications === true,
    lowPressure: st.lowPressure === true,
    alertStyle: { a: styleFor('a'), b: styleFor('b') },
  }
  if (!isISODate(settings.ttcStart)) delete settings.ttcStart

  const list = <T>(v: unknown, ok: (x: Loose) => boolean): T[] =>
    Array.isArray(v) ? (v.filter((x) => isObj(x) && ok(x)) as T[]) : []

  const periods = list<AppState['periods'][number]>(input.periods, (p) => isISODate(p.start)).map((p) =>
    p.end === undefined || (isISODate(p.end) && p.end >= p.start) ? p : { start: p.start },
  )

  const checkLog: AppState['checkLog'] = {}
  if (isObj(input.checkLog)) {
    for (const [date, day] of Object.entries(input.checkLog)) if (isISODate(date) && isObj(day)) checkLog[date] = day
  }

  const next: AppState = {
    ...input,
    couple,
    cycle,
    settings,
    periods,
    checkLog,
    lhTests: list(input.lhTests, (t) => isISODate(t.date) && (t.result === 'positive' || t.result === 'negative')),
    checkItems: list(input.checkItems, (i) => isStr(i.id) && isMemberId(i.owner) && isStr(i.label)),
    notifications: list(
      input.notifications,
      (n) => isStr(n.id) && isMemberId(n.to) && isStr(n.title) && isStr(n.body) && isStr(n.createdAt),
    ),
    datePlans: list(input.datePlans, (d) => isStr(d.id) && isISODate(d.date) && isStr(d.title)),
    diary: list(input.diary, (d) => isStr(d.id) && isISODate(d.date) && isStr(d.text) && isMemberId(d.author)),
    growth: list(input.growth, (g) => isStr(g.id) && isISODate(g.date)),
    milestones: list(input.milestones, (m) => isStr(m.key) && isISODate(m.date)),
  }

  const p: unknown = input.pregnancy
  if (isObj(p) && isISODate(p.lmp)) {
    const pregnancy: NonNullable<AppState['pregnancy']> = {
      ...(p as unknown as NonNullable<AppState['pregnancy']>),
      confirmedAt: isISODate(p.confirmedAt) ? p.confirmedAt : p.lmp,
    }
    if (!isISODate(pregnancy.dueDateOverride)) delete pregnancy.dueDateOverride
    next.pregnancy = pregnancy
  } else delete next.pregnancy

  const baby: unknown = input.baby
  if (isObj(baby) && isISODate(baby.birthDate)) {
    next.baby = {
      ...(baby as unknown as NonNullable<AppState['baby']>),
      name: isStr(baby.name) && baby.name.trim() ? baby.name : '아기',
      sex: SEXES.includes(baby.sex as BabySex) ? (baby.sex as BabySex) : 'unknown',
    }
  } else delete next.baby

  return next
}

/** localStorage keys the "delete everything" action removes besides the main state. */
export function extraStorageKeys(keys: string[], stateKey: string): string[] {
  return keys.filter((k) => k.startsWith('dulset:') && k !== stateKey)
}

/** Member ids in display order: the viewer first. */
export function membersViewerFirst(state: AppState, viewer: MemberId): Member[] {
  return [...state.couple.members].sort((a, b) => (a.id === viewer ? -1 : b.id === viewer ? 1 : 0))
}

/** Every member id always has an alert style (older data may lack one). */
export function alertStyleOf(state: AppState, id: MemberId): AlertStyle {
  const owner = state.couple.members.find((m) => m.tracksCycle)?.id ?? MEMBER_IDS[0]
  return state.settings.alertStyle?.[id] ?? (id === owner ? 'explicit' : 'soft')
}
