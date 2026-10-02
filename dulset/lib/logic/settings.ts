// Settings-tab state changes and view helpers (pure).
//
// Every state change here returns a new AppState and keeps the couple's
// invariants: exactly one member tracks the cycle, cycle numbers stay in a
// plausible range, and nothing touches history (periods, diary, checks).

import { addMonths, formatKo, isISODate, parts } from '../dates'
import { CUSTOM_TITLE_MAX } from './roadmap'
import {
  APPOINTMENT_KINDS,
  LH_SLOTS,
  MEMBER_IDS,
  REST_REASONS,
  type AlertStyle,
  type AppNotification,
  type AppState,
  type Appointment,
  type AppointmentKind,
  type BabySex,
  type CheckItem,
  type CheckKind,
  type CustomTask,
  type CycleNotes,
  type CycleSettings,
  type DatePlan,
  type DiaryEntry,
  type GrowthRecord,
  type LHSlot,
  type NotificationKind,
  type ISODate,
  type Member,
  type MemberId,
  type PersonalPrefs,
  type RestReason,
  type Role,
  type Settings,
  type Stage,
  type Treatment,
} from '../types'
import {
  CYCLE_RANGE_DEFAULT,
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  PERSONAL_DEFAULTS,
  ROLE_EMOJI,
  ROLE_LABEL,
  SETTINGS_DEFAULTS,
  cycleLengthRange,
  otherMember,
} from '../initial'
import { BUILTIN_PHOTO_IDS } from '../content/demoPhotos'
import { cleanCover } from './cover'
import { cleanIntimacy } from './intimacy'
import { cleanCoupleLink } from './partnerLink'
import { cleanPersonalLog } from './personalLog'
import { discreetFor } from './prefs'
import { cleanLeaveDays, cleanTreatments } from './treatments'
import { maxCycleLength, type CycleStats } from './cycle'
import { SOFT_FERTILE_TITLE, localNowISO, softFertileBody } from './notifications'
import { confirmPregnancy } from './today'
import { canStartPregnancy, updatePregnancy } from './pregnancy'
import { SCHEMA_VERSION, migrate, schemaVersionOf } from '../sync/migrations'
import { cleanDecisions, isStamp } from '../sync/model'

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

/**
 * Make `id` the one member whose cycle is tracked (the other one never is).
 * Whether the partner sees the details (settings.shareCycleDetails) was the
 * previous owner's choice about their own records: a new owner hasn't agreed
 * to anything, so it goes back to private ("우리의 주간만") unless `id` already
 * was the only owner.
 */
export function setCycleOwner(state: AppState, id: MemberId): AppState {
  const owners = state.couple.members.filter((m) => m.tracksCycle)
  const unchanged = owners.length === 1 && owners[0]!.id === id
  const members = state.couple.members.map((m) => ({ ...m, tracksCycle: m.id === id })) as [Member, Member]
  const next = { ...state, couple: { ...state.couple, members } }
  return unchanged || state.settings.shareCycleDetails !== true
    ? next
    : { ...next, settings: { ...state.settings, shareCycleDetails: false } }
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

// ── Next B switches: unset = the default (lib/initial.ts) ───

/** The three couple-wide Next B switches (설정 › 첫 화면). */
export type CoupleFlag = keyof typeof SETTINGS_DEFAULTS

/**
 * Turn one of them on or off. A value equal to its default (lib/initial.ts
 * SETTINGS_DEFAULTS) leaves the key unset, so a save that never left the
 * defaults stays byte-identical to an older one; the same value → the same
 * state object. (setSetting writes the boolean as given — either reads the
 * same through memoriesOn / anniversaryAlertsOn / showTryCountOn.)
 */
export function setCoupleFlag(state: AppState, key: CoupleFlag, value: boolean): AppState {
  const current = state.settings[key]
  const next = value === SETTINGS_DEFAULTS[key] ? undefined : value
  if (current === next) return state
  const settings = { ...state.settings }
  if (next === undefined) delete settings[key]
  else settings[key] = next
  return { ...state, settings }
}

/** 'N년 전 오늘' — off unless the couple turned it on. */
export function memoriesOn(settings: Pick<Settings, 'memories'>): boolean {
  return settings.memories ?? SETTINGS_DEFAULTS.memories
}

/** 기념일 D-7·당일 알림 — on unless turned off. */
export function anniversaryAlertsOn(settings: Pick<Settings, 'anniversaryAlerts'>): boolean {
  return settings.anniversaryAlerts ?? SETTINGS_DEFAULTS.anniversaryAlerts
}

/** '시도 N번째 주기' in the history — hidden (neutral wording) unless turned on. */
export function showTryCountOn(settings: Pick<Settings, 'showTryCount'>): boolean {
  return settings.showTryCount ?? SETTINGS_DEFAULTS.showTryCount
}

/** 콕 받기 — this person takes the partner's nudges unless they said no. */
export function acceptNudgesFor(settings: Pick<Settings, 'personal'>, member: MemberId): boolean {
  return settings.personal?.[member]?.acceptNudges ?? PERSONAL_DEFAULTS.acceptNudges
}

/**
 * 잠금화면 숨김을 홈 카드까지: the home's moment card and strip use the neutral
 * wording for this person — their own choice, else whatever their 잠금화면
 * 숨김 (discreetFor) says.
 */
export function homeDiscreetFor(settings: Pick<Settings, 'discreet' | 'personal'>, member: MemberId): boolean {
  return settings.personal?.[member]?.homeDiscreet ?? discreetFor(settings, member)
}

/** The default stepper range (15–60); with 긴 주기 on, read cycleLengthRangeFor(state.cycle) instead (15–90). */
export const CYCLE_LENGTH_RANGE = CYCLE_RANGE_DEFAULT
export const PERIOD_LENGTH_RANGE = { min: 1, max: 14 } as const

/** The cycle-length range these settings accept (lib/initial.ts cycleLengthRange): 15–90 with longCycles, 15–60 otherwise. */
export function cycleLengthRangeFor(cycle: Pick<CycleSettings, 'longCycles'>): { min: number; max: number } {
  return cycleLengthRange(cycle.longCycles)
}

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)))
}

/**
 * Patch the fallback cycle numbers; values are rounded and clamped, NaN is
 * ignored. `longCycles` ("45일 이상이거나 들쭉날쭉해요", N12) widens the accepted
 * length to 90; turning it off pulls a longer length back to 60. Stored only
 * when true (an older save has no field at all).
 */
export function setCycle(state: AppState, patch: Partial<CycleSettings>): AppState {
  const cycle = { ...state.cycle }
  if (typeof patch.longCycles === 'boolean') {
    if (patch.longCycles) cycle.longCycles = true
    else delete cycle.longCycles
  }
  const range = cycleLengthRangeFor(cycle)
  if (patch.cycleLength !== undefined && Number.isFinite(patch.cycleLength)) {
    cycle.cycleLength = clampInt(patch.cycleLength, range.min, range.max)
  } else if (Number.isFinite(cycle.cycleLength)) {
    cycle.cycleLength = clampInt(cycle.cycleLength, range.min, range.max)
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

/** The line under "주기 설정" explaining which numbers predictions use right now (the accepted gap follows 긴 주기: 15~90일). */
export function cycleSourceNote(stats: Pick<CycleStats, 'source'>, periodCount: number, cycle?: Pick<CycleSettings, 'longCycles'>): string {
  if (stats.source === 'logs') return '생리 기록이 쌓여서 지금은 기록 평균으로 예상해요. 아래 주기 길이는 기록이 부족할 때만 쓰여요.'
  if (periodCount >= 2)
    return `기록 사이 간격이 15~${maxCycleLength(cycle)}일일 때만 평균에 넣어요. 그런 기록이 생기기 전까지는 아래 값으로 예상해요.`
  return '생리 시작일을 두 번 이상 기록하면 기록으로 평균을 계산해요. 그 전까지는 아래 값으로 예상해요.'
}

// ── Alert preview ───────────────────────────────────────────

export const ALERT_STYLE_OPTIONS: ReadonlyArray<{ value: AlertStyle; label: string; hint: string }> = [
  { value: 'explicit', label: '가임기라고 알려 주세요', hint: '예상 날짜와 함께 알려 드려요' },
  { value: 'soft', label: '‘우리의 주간’처럼 은근하게', hint: '건강 용어 없이, 둘만의 시간으로' },
  { value: 'off', label: '받지 않을래요', hint: '가임기 알림만 쉬어요 · 생리 예정·병원 일정 알림은 그대로 와요' },
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
      // Low-pressure is each person's own choice (prefs.lowPressureFor).
      note: '부담 없이 모드라 날짜 알림과 카운트다운 없이 지내요. 내 화면과 알림에만 적용돼요. 체크·응원 알림은 그대로 와요.',
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
      message: { title: SOFT_FERTILE_TITLE, body: softFertileBody(opts.isCycleOwner) },
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
  preparing: { icon: '🌱', label: '임신 준비 중', body: '두 사람의 매일 체크, 주기 기록, 챙길 것을 함께 보고 있어요.' },
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
  if (!canStartPregnancy(state)) return state
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
const CHECK_KINDS: readonly CheckKind[] = ['supplement', 'medication', 'habit']
const NOTIFICATION_KINDS: readonly NotificationKind[] = [
  'fertile-start',
  'peak',
  'period-due',
  'nudge',
  'cheer',
  'date-idea',
  'milestone',
  'doctor',
  'system',
]

type Loose = Record<string, unknown>
const isObj = (v: unknown): v is Loose => !!v && typeof v === 'object' && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isMemberId = (v: unknown): v is MemberId => v === 'a' || v === 'b'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isTime = (v: unknown): v is string => isStr(v) && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

/**
 * cycleNotes[cycle start] = { stillWaiting? } — real dates only; a note with
 * nothing valid left is dropped, and so is an empty map.
 */
function cleanCycleNotes(raw: unknown): CycleNotes | undefined {
  if (!isObj(raw)) return undefined
  const out: CycleNotes = {}
  for (const [start, note] of Object.entries(raw)) {
    if (!isISODate(start) || !isObj(note)) continue
    if (isISODate(note.stillWaiting)) out[start] = { stillWaiting: note.stillWaiting }
  }
  return Object.keys(out).length ? out : undefined
}

function cleanMember(raw: Loose, id: MemberId): Member {
  const role: Role = ROLES.includes(raw.role as Role) ? (raw.role as Role) : 'partner'
  const m = { ...raw } as unknown as Member
  m.id = id
  m.role = role
  m.name = isStr(raw.name) && raw.name.trim() ? raw.name.trim().slice(0, NAME_MAX) : ROLE_LABEL[role]
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
export function sanitizeBackup(raw: AppState): AppState | null {
  // A state from before the current shape (a backup made by an older app, a
  // caller that skipped parseState) is brought up to date first — the same
  // ordered migrations lib/storage.ts runs; a current one is untouched.
  const input = schemaVersionOf(raw) < SCHEMA_VERSION ? migrate(raw) : raw
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
  if (!isISODate(couple.metDate)) delete couple.metDate
  if (!isISODate(couple.marriedDate)) delete couple.marriedDate
  // Cover photo: an id only (the image never travels in a backup). A built-in
  // id this version doesn't have would never resolve, so it goes too.
  const cover = cleanCover(couple.cover)
  const knownBuiltin = (id: string) => !id.startsWith('builtin:') || (BUILTIN_PHOTO_IDS as readonly string[]).includes(id)
  if (cover && knownBuiltin(cover.photoId)) couple.cover = cover
  else delete couple.cover
  // The partner link's facts (Next A ①): a couple id and the token's hash —
  // never the token. Well-formed or gone.
  const link = cleanCoupleLink(couple.link)
  if (link) couple.link = link
  else delete couple.link

  const c: Loose = isObj(input.cycle) ? input.cycle : {}
  // "45일 이상·들쭉날쭉" widens the accepted length to 90 (lib/initial.ts CYCLE_RANGE_LONG).
  const longCycles = typeof c.longCycles === 'boolean' ? c.longCycles : undefined
  const lengthRange = cycleLengthRange(longCycles)
  const cycle: CycleSettings = {
    cycleLength: isNum(c.cycleLength) ? clampInt(c.cycleLength, lengthRange.min, lengthRange.max) : DEFAULT_CYCLE_LENGTH,
    periodLength: isNum(c.periodLength)
      ? clampInt(c.periodLength, PERIOD_LENGTH_RANGE.min, PERIOD_LENGTH_RANGE.max)
      : DEFAULT_PERIOD_LENGTH,
    ...(longCycles !== undefined ? { longCycles } : {}),
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
  // 써요 / 안 써요 / 나중에 (N17) — anything else means the question wasn't asked.
  if (!(typeof st.usesLH === 'boolean' || st.usesLH === 'later')) delete settings.usesLH
  // Next B switches: a yes/no, or unset = the default (never filled in).
  for (const k of ['memories', 'anniversaryAlerts', 'showTryCount'] as const) {
    if (typeof st[k] !== 'boolean') delete settings[k]
  }
  // '링크에 표지 사진' (Next A ①): the owner's explicit yes, or unset = off.
  if (st.coverOnLink === true) settings.coverOnLink = true
  else delete settings.coverOnLink
  // Per-person prefs: only booleans for a/b, plus an 'HH:MM' LH test time.
  if (isObj(st.personal)) {
    const personal: NonNullable<Settings['personal']> = {}
    for (const id of MEMBER_IDS) {
      const p = (st.personal as Loose)[id]
      if (!isObj(p)) continue
      const out: PersonalPrefs = {}
      if (typeof p.lowPressure === 'boolean') out.lowPressure = p.lowPressure
      if (typeof p.discreet === 'boolean') out.discreet = p.discreet
      if (typeof p.hideCover === 'boolean') out.hideCover = p.hideCover
      if (isTime(p.lhTestTime)) out.lhTestTime = p.lhTestTime
      if (typeof p.acceptNudges === 'boolean') out.acceptNudges = p.acceptNudges
      if (typeof p.homeDiscreet === 'boolean') out.homeDiscreet = p.homeDiscreet
      personal[id] = out
    }
    settings.personal = personal
  } else delete settings.personal
  // Privacy by default (like storage.normalize and a new couple): only an
  // explicit opt-in by the cycle owner shares the details.
  settings.shareCycleDetails = st.shareCycleDetails === true

  const list = <T>(v: unknown, ok: (x: Loose) => boolean): T[] => (Array.isArray(v) ? (v.filter((x) => isObj(x) && ok(x)) as T[]) : [])
  /** Sync marks (lib/types.ts SyncMarks): a real stamp or nothing — a record is never dropped for them. */
  const marks = (o: Loose) => {
    for (const k of ['updatedAt', 'deletedAt']) if (o[k] !== undefined && !isStamp(o[k])) delete o[k]
  }

  const periods = list<Loose>(input.periods, (p) => isISODate(p.start)).map((raw) => {
    const p: Loose = { ...raw }
    if (!(isISODate(raw.end) && raw.end >= (raw.start as string))) delete p.end
    if (!isMemberId(raw.by)) delete p.by
    if (!isStr(raw.id)) delete p.id
    marks(p)
    return p as unknown as AppState['periods'][number]
  })

  // checkLog[date][member] must be a list of item ids — screens call .includes() on it.
  const checkLog: AppState['checkLog'] = {}
  if (isObj(input.checkLog)) {
    for (const [date, day] of Object.entries(input.checkLog)) {
      if (!isISODate(date) || !isObj(day)) continue
      const clean: Partial<Record<MemberId, string[]>> = {}
      for (const id of MEMBER_IDS) {
        const ids = day[id]
        if (Array.isArray(ids)) clean[id] = ids.filter(isStr)
      }
      checkLog[date] = clean
    }
  }

  const fallbackDay = isStr(input.createdAt) && isISODate(input.createdAt.slice(0, 10)) ? input.createdAt.slice(0, 10) : '2000-01-01'
  /** Optional text fields are rendered as-is, so anything but a string is dropped. */
  const optStr = (o: Loose, ...keys: string[]) => {
    for (const k of keys) if (o[k] !== undefined && !isStr(o[k])) delete o[k]
  }

  const checkItems = list<Loose>(input.checkItems, (i) => isStr(i.id) && isMemberId(i.owner) && isStr(i.label)).map((raw) => {
    const i: Loose = { ...raw }
    i.kind = CHECK_KINDS.includes(raw.kind as CheckKind) ? raw.kind : 'habit'
    i.active = raw.active !== false
    i.createdAt = isISODate(raw.createdAt) ? raw.createdAt : fallbackDay
    if (!isISODate(raw.archivedAt)) delete i.archivedAt
    if (!i.active && !i.archivedAt) i.archivedAt = i.createdAt
    optStr(i, 'note')
    if (raw.cadence !== 'daily' && raw.cadence !== 'weekly') delete i.cadence
    return i as unknown as CheckItem
  })

  const notifications = list<Loose>(
    input.notifications,
    (n) =>
      isStr(n.id) &&
      isMemberId(n.to) &&
      isStr(n.title) &&
      isStr(n.body) &&
      isStr(n.createdAt) &&
      (n.key === undefined || isStr(n.key)) &&
      (n.from === undefined || isMemberId(n.from)),
  ).map((raw) => {
    const n: Loose = { ...raw }
    n.kind = NOTIFICATION_KINDS.includes(raw.kind as NotificationKind) ? raw.kind : 'system'
    n.read = raw.read === true
    if (raw.dismissed === true) n.dismissed = true
    else delete n.dismissed
    return n as unknown as AppNotification
  })

  const datePlans = list<Loose>(input.datePlans, (d) => isStr(d.id) && isISODate(d.date) && isStr(d.title)).map((raw) => {
    const d: Loose = { ...raw, done: raw.done === true, createdBy: isMemberId(raw.createdBy) ? raw.createdBy : 'a' }
    if (!isMemberId(raw.acceptedBy)) delete d.acceptedBy
    optStr(d, 'ideaId', 'place', 'note')
    return d as unknown as DatePlan
  })

  const diary = list<Loose>(input.diary, (d) => isStr(d.id) && isISODate(d.date) && isStr(d.text) && isMemberId(d.author)).map((raw) => {
    const d: Loose = { ...raw }
    d.stage = STAGES.includes(raw.stage as Stage) ? raw.stage : input.stage
    d.createdAt = isStr(raw.createdAt) ? raw.createdAt : `${raw.date as string}T00:00:00`
    optStr(d, 'mood', 'photoId')
    // '나만 보기': a member id or nothing — anything else would hide it from everyone or no one.
    if (!isMemberId(raw.privateTo)) delete d.privateTo
    // Reactions: only {a|b: short string}.
    if (isObj(raw.reactions)) {
      const r: Record<string, string> = {}
      for (const id of MEMBER_IDS) {
        const v = (raw.reactions as Loose)[id]
        if (isStr(v) && v.length <= 8) r[id] = v
      }
      if (Object.keys(r).length) d.reactions = r
      else delete d.reactions
    } else delete d.reactions
    marks(d)
    return d as unknown as DiaryEntry
  })

  const growth = list<Loose>(input.growth, (g) => isStr(g.id) && isISODate(g.date)).map((raw) => {
    const g: Loose = { ...raw }
    for (const k of ['heightCm', 'weightKg', 'headCm']) if (g[k] !== undefined && !isNum(g[k])) delete g[k]
    return g as unknown as GrowthRecord
  })

  const next: AppState = {
    ...input,
    couple,
    cycle,
    settings,
    periods,
    checkLog,
    lhTests: list<AppState['lhTests'][number]>(
      input.lhTests,
      (t) => isISODate(t.date) && ['negative', 'faint', 'positive', 'peak'].includes(t.result as string),
    ).map((t) => {
      const out = { ...t }
      if (!(isStr(t.time) && /^([01]\d|2[0-3]):[0-5]\d$/.test(t.time))) delete out.time
      if (!LH_SLOTS.includes(t.slot as LHSlot)) delete out.slot
      if (!isMemberId(t.by)) delete out.by
      if (!isStr(t.id)) delete out.id
      marks(out as unknown as Loose)
      return out
    }),
    pregnancyTests: list<AppState['pregnancyTests'][number]>(
      input.pregnancyTests,
      (t) => isStr(t.id) && isISODate(t.date) && ['negative', 'faint', 'positive'].includes(t.result as string),
    ).map((t) => {
      const out = { ...t }
      if (!(isStr(t.time) && /^([01]\d|2[0-3]):[0-5]\d$/.test(t.time))) delete out.time
      if (!isMemberId(t.by)) delete out.by
      marks(out as unknown as Loose)
      return out
    }),
    checkItems,
    notifications,
    datePlans,
    diary,
    growth,
    milestones: list(input.milestones, (m) => isStr(m.key) && isISODate(m.date)),
    anniversaries: list<AppState['anniversaries'][number]>(
      input.anniversaries,
      (a) => isStr(a.id) && isStr(a.title) && isISODate(a.date),
    ).map((a) => {
      const out = { ...a, yearly: a.yearly === true }
      if (!(isStr(a.emoji) && a.emoji.length <= 8)) delete out.emoji
      return out
    }),
    // Rebuilt field by field (the list screen renders place/note as text and
    // reads done/createdBy): a bad optional field is dropped, unknown ones too.
    appointments: list<Loose>(
      input.appointments,
      (a) =>
        isStr(a.id) &&
        isStr(a.title) &&
        isISODate(a.date) &&
        (a.who === 'both' || isMemberId(a.who)) &&
        APPOINTMENT_KINDS.includes(a.kind as AppointmentKind) &&
        (a.time === undefined || (isStr(a.time) && /^([01]\d|2[0-3]):[0-5]\d$/.test(a.time))),
    ).map((raw) => {
      const a: Loose = {
        id: raw.id,
        date: raw.date,
        title: raw.title,
        who: raw.who,
        kind: raw.kind,
        createdBy: isMemberId(raw.createdBy) ? raw.createdBy : ownerId,
      }
      if (raw.time !== undefined) a.time = raw.time
      if (raw.done === true) a.done = true
      for (const k of ['place', 'note', 'taskId']) if (isStr(raw[k])) a[k] = raw[k]
      for (const k of ['updatedAt', 'deletedAt']) if (isStamp(raw[k])) a[k] = raw[k]
      return a as unknown as Appointment
    }),
    planDone: isObj(input.planDone)
      ? Object.fromEntries(
          Object.entries(input.planDone).filter(([, v]) => isObj(v) && isISODate(v.at) && (v.by === undefined || isMemberId(v.by))),
        )
      : {},
    customTasks: list<Loose>(
      input.customTasks,
      (c) =>
        isStr(c.id) &&
        isStr(c.title) &&
        ['preconception', 'pregnancy-1st', 'pregnancy-2nd', 'pregnancy-3rd', 'birth', 'postpartum'].includes(c.phase as string) &&
        (c.who === 'both' || isMemberId(c.who)) &&
        (c.due === undefined || isISODate(c.due)),
    ).map((raw) => {
      const c: Loose = { ...raw, title: (raw.title as string).trim().slice(0, CUSTOM_TITLE_MAX) }
      if (!isISODate(raw.doneAt)) delete c.doneAt
      if (!isMemberId(raw.doneBy)) delete c.doneBy
      if (!isMemberId(raw.createdBy)) c.createdBy = ownerId
      if (typeof raw.deadlineAlerts !== 'boolean') delete c.deadlineAlerts
      marks(c)
      return c as unknown as CustomTask
    }),
  }

  // A createdAt saved as UTC ('…Z', from an older version) reads as the day
  // before in Korea until 9am; the local form is what every screen expects.
  if (isStr(input.createdAt) && input.createdAt.endsWith('Z')) {
    const d = new Date(input.createdAt)
    if (!Number.isNaN(d.getTime())) next.createdAt = localNowISO(d)
  }

  // The two-tab rebase marks left the state at schema 3 (lib/storage.ts SYNC_KEY).
  delete (next as unknown as Loose).sync

  const p: unknown = input.pregnancy
  if (isObj(p) && isISODate(p.lmp)) {
    const pregnancy: NonNullable<AppState['pregnancy']> = {
      ...(p as unknown as NonNullable<AppState['pregnancy']>),
      confirmedAt: isISODate(p.confirmedAt) ? p.confirmedAt : p.lmp,
    }
    if (!isISODate(pregnancy.dueDateOverride)) delete pregnancy.dueDateOverride
    if (!isISODate(pregnancy.endedAt)) delete pregnancy.endedAt
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

  const rc: unknown = input.restCycle
  if (isObj(rc) && isISODate(rc.since) && REST_REASONS.includes(rc.reason as RestReason)) {
    // `until` (an optional end, Next B): a real day not before `since`, else gone.
    next.restCycle = {
      since: rc.since,
      reason: rc.reason as RestReason,
      ...(isISODate(rc.until) && rc.until >= rc.since ? { until: rc.until } : {}),
    }
  } else delete next.restCycle
  const pp: unknown = input.positivePending
  if (isObj(pp) && isISODate(pp.since)) {
    // bleedingSince (Next B): a real day not before the positive test, else gone.
    next.positivePending = {
      since: pp.since,
      ...(isStr(pp.testId) ? { testId: pp.testId } : {}),
      ...(isISODate(pp.bleedingSince) && pp.bleedingSince >= pp.since ? { bleedingSince: pp.bleedingSince } : {}),
    }
  } else delete next.positivePending

  // Next B lists: 난임 시술 회차, each person's 난임치료휴가 days, the owner's
  // 관계일 record — strict shapes (lib/logic/treatments.ts, intimacy.ts); an
  // empty or broken one is dropped, never kept as an empty container.
  const treatments = cleanTreatments(input.treatments)
  if (treatments) {
    // cleanTreatment rebuilds the attempt field by field; the sync marks ride
    // back in from the first raw record with that id (a stamp or nothing).
    const rawById = new Map<string, Loose>()
    for (const t of Array.isArray(input.treatments) ? input.treatments : []) {
      if (isObj(t) && isStr(t.id) && !rawById.has(t.id)) rawById.set(t.id, t)
    }
    next.treatments = treatments.map((t) => {
      const r = rawById.get(t.id)
      const out: Loose = { ...t }
      for (const k of ['updatedAt', 'deletedAt']) if (r && isStamp(r[k])) out[k] = r[k]
      return out as unknown as Treatment
    })
  } else delete next.treatments
  const leaveDays = cleanLeaveDays(input.leaveDays)
  if (leaveDays) next.leaveDays = leaveDays
  else delete next.leaveDays
  const intimacy = cleanIntimacy(input.intimacy)
  if (intimacy) next.intimacy = intimacy
  else delete next.intimacy

  // Each member's own log (본인만 보기) and the per-cycle notes: strict shapes, kept in a backup.
  const personalLog = cleanPersonalLog(input.personalLog)
  if (personalLog) next.personalLog = personalLog
  else delete next.personalLog
  const cycleNotes = cleanCycleNotes(input.cycleNotes)
  if (cycleNotes) next.cycleNotes = cycleNotes
  else delete next.cycleNotes

  // Shape version: current, or a newer app's number kept as it is (nothing
  // here knows how to go back). Answers that are not records: strict map.
  // Record ids are not filled in here: the v1 → v2 migration gives legacy
  // records theirs, writers give new ones uid(), and a reader that meets a
  // record without one derives it (lib/sync/model.ts periodIdOf / lhIdOf) —
  // so a state the app built stays byte-identical through parseState.
  next.schemaVersion = Math.max(schemaVersionOf(input), SCHEMA_VERSION)
  next.decisions = cleanDecisions(input.decisions)

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
