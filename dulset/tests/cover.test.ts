import { describe, expect, it } from 'vitest'
import { addDays, addMonths } from '@/lib/dates'
import { SETTINGS_DEFAULTS, createInitialState } from '@/lib/initial'
import { addAnniversary, anniversaryAlertsEnabled, anniversaryNotices, setCoupleDates } from '@/lib/logic/anniversary'
import { setAnniversaryAlerts } from '@/lib/logic/settings'
import {
  COVER_CAPTION_MAX,
  COVER_WORDS,
  MEMORY_YEARS,
  captionLength,
  cleanCover,
  clearCover,
  copula,
  coverCaptionProblem,
  coverView,
  heroLine,
  memoryFor,
  memoryLineText,
  releasableCoverPhoto,
  setCover,
  setCoverFocus,
  setHideCover,
} from '@/lib/logic/cover'
import { PERIOD_EARLY_DAYS, tellPartnerPeriod } from '@/lib/logic/ttcFlow'
import { createDemoState } from '@/lib/demo'
import { addEntry } from '@/lib/logic/diary'
import { deletePhoto, getPhotoBlob, getPhotoURL, isBuiltinPhoto, savePhoto } from '@/lib/photos'
import { parseState } from '@/lib/storage'
import { BUILTIN_PHOTO_IDS } from '@/lib/content/demoPhotos'
import { addLHTest, addPregnancyTest } from '@/lib/logic/logs'
import { setEntryPrivacy } from '@/lib/logic/personalLog'
import { activeDailyItems } from '@/lib/logic/checks'
import { notifyCompleted, sendCheer, sendNudge } from '@/lib/logic/notifications'
import { toggleWithCompletion } from '@/lib/logic/today'
import { setPersonalPref } from '@/lib/logic/prefs'
import { QUIET_DAYS_AFTER_END, backToPreparing, startPregnancy } from '@/lib/logic/pregnancy'
import { endPregnancy } from '@/lib/logic/today'
import { markBleeding } from '@/lib/logic/positiveBleeding'
import { ALL_SIGNALS, sendSignal } from '@/lib/logic/signals'
import { markPositivePending, startRestCycle } from '@/lib/logic/ttc'
import type { AlertStyle, AppState, ISODate, MemberId } from '@/lib/types'

// 'a' = 민수 (partner), 'b' = 지은 (tracks the cycle). Last period 2026-09-01,
// 28-day cycle → window 09-10…09-15, next period 09-29.
const OWNER = 'b' as const
const PARTNER = 'a' as const
const TODAY = '2026-09-11'

function fresh(over: Partial<AppState> = {}): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband', birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: 1993 },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-01',
      ttcStart: '2026-06-01',
    },
    new Date(2026, 8, 1, 9, 0),
  )
  return { ...s, ...over }
}

const at = (day: ISODate, hh = '09') => `${day}T${hh}:00:00+09:00`
const other = (m: MemberId): MemberId => (m === 'a' ? 'b' : 'a')

/** Check every daily item of `member` on `day` the way the app does (the last one sends the 'complete:' notice). */
function finishDay(s: AppState, member: MemberId, day: ISODate, nowISO: string): AppState {
  let next = s
  for (const item of activeDailyItems(s, member)) {
    next = toggleWithCompletion(next, member, other(member), day, item.id, nowISO).state
  }
  return next
}

/** 기념일 알림 turned on by the couple (unset is off while preparing — N27). */
const annivOn = (s: AppState): AppState => setAnniversaryAlerts(s, true)

/** The same couple, pregnant (LMP 08-20, confirmed 09-10): the stage that still looks a week ahead. */
const pregnantOf = (s: AppState): AppState => startPregnancy(s, '2026-08-20', '2026-09-10')

/** Pregnant from 07-01, confirmed 08-05, back to preparing on `endedAt`. */
function afterLoss(endedAt: ISODate, base = fresh()): AppState {
  return backToPreparing(startPregnancy(base, '2026-07-01', '2026-08-05'), endedAt)
}

// ── State changes ───────────────────────────────────────────

describe('setCover / setCoverFocus / clearCover', () => {
  it('stores the id, clamped focus, trimmed caption, who and when — without touching the input', () => {
    const s = fresh()
    const before = JSON.stringify(s)
    const next = setCover(s, { photoId: 'p1', focusY: 140.6, caption: '  9.20 · 한강 산책  ' }, OWNER, TODAY)
    expect(next.couple.cover).toEqual({ photoId: 'p1', focusY: 100, caption: '9.20 · 한강 산책', setBy: OWNER, setAt: TODAY })
    expect(JSON.stringify(s)).toBe(before)
    expect(s.couple.cover).toBeUndefined()
    expect(setCover(s, { photoId: 'p1', focusY: -3 }, PARTNER, TODAY).couple.cover!.focusY).toBe(0)
    expect(setCover(s, { photoId: 'p1', focusY: 33.4 }, PARTNER, TODAY).couple.cover!.focusY).toBe(33)
    expect(setCover(s, { photoId: 'p1', focusY: Number.NaN }, PARTNER, TODAY).couple.cover!.focusY).toBe(50)
  })

  it('drops an empty or not-allowed caption and ignores an unusable id', () => {
    const s = fresh()
    for (const caption of ['   ', '가임기 첫날', '이 캡션은 열여섯 글자를 훌쩍 넘어가요 정말로']) {
      const c = setCover(s, { photoId: 'p1', focusY: 50, caption }, OWNER, TODAY).couple.cover!
      expect('caption' in c).toBe(false)
    }
    expect(setCover(s, { photoId: '', focusY: 50 }, OWNER, TODAY)).toBe(s)
    expect(setCover(s, { photoId: 'x'.repeat(201), focusY: 50 }, OWNER, TODAY)).toBe(s)
  })

  it('moves the focus only when there is a cover, and keeps who set it', () => {
    const s = setCover(fresh(), { photoId: 'p1', focusY: 40 }, OWNER, '2026-09-01')
    const moved = setCoverFocus(s, 72.2)
    expect(moved.couple.cover).toMatchObject({ focusY: 72, setBy: OWNER, setAt: '2026-09-01' })
    expect(setCoverFocus(s, 40)).toBe(s)
    expect(setCoverFocus(s, Number.NaN)).toBe(s)
    const none = fresh()
    expect(setCoverFocus(none, 20)).toBe(none)
  })

  it('clears the cover for both people', () => {
    const s = setCover(fresh(), { photoId: 'p1', focusY: 40 }, OWNER, TODAY)
    const cleared = clearCover(s)
    expect('cover' in cleared.couple).toBe(false)
    expect(s.couple.cover).toBeDefined()
    expect(clearCover(cleared)).toBe(cleared)
  })
})

describe('setHideCover', () => {
  it('is each person’s own choice (true / false / automatic)', () => {
    const s = fresh()
    const hid = setHideCover(s, PARTNER, true)
    expect(hid.settings.personal?.a?.hideCover).toBe(true)
    expect(hid.settings.personal?.b).toBeUndefined()
    expect(s.settings.personal).toBeUndefined()
    const shown = setHideCover(hid, PARTNER, false)
    expect(shown.settings.personal?.a?.hideCover).toBe(false)
    const auto = setHideCover(shown, PARTNER, undefined)
    expect(auto.settings.personal?.a && 'hideCover' in auto.settings.personal.a).toBe(false)
    expect(setHideCover(hid, PARTNER, true)).toBe(hid)
    expect(setHideCover(auto, PARTNER, undefined)).toBe(auto)
  })

  it('keeps the other personal prefs', () => {
    const s = setHideCover(setPersonalPref(fresh(), PARTNER, 'lowPressure', true), PARTNER, true)
    expect(s.settings.personal?.a).toEqual({ lowPressure: true, hideCover: true })
  })
})

describe('coverCaptionProblem', () => {
  it('allows short everyday captions (and an empty one)', () => {
    for (const ok of ['', '9.20 · 한강 산책', '우리 첫 캠핑 🏕️', 'x'.repeat(COVER_CAPTION_MAX)]) {
      expect(coverCaptionProblem(ok)).toBeNull()
    }
    // Spaces around it don't count; an emoji is one character.
    expect(coverCaptionProblem(`  ${'가'.repeat(16)}  `)).toBeNull()
    expect(captionLength('🏕️🏕️')).toBeLessThanOrEqual(4)
  })

  it('asks for 16 characters or fewer', () => {
    expect(coverCaptionProblem('가'.repeat(17))).toBe('16자 이내로 적어 주세요')
  })

  it('keeps health and clinic words off the cover', () => {
    const msg = '표지에는 건강·병원 이야기를 넣지 않아요. 다른 말로 적어 주세요.'
    for (const bad of ['가임기 시작', '배란일', 'LH 양성', 'lh 양성', '생리 끝', '테스트 두 줄', '임신 12주', '임테기', '병원 가는 길', '시험관 1차', '난임 센터', '유산', '초음파 사진', '주사 맞은 날']) {
      expect(coverCaptionProblem(bad), bad).toBe(msg)
    }
  })
})

describe('cleanCover (stored data)', () => {
  const good = { photoId: 'p1', focusY: 62.4, caption: '한강 산책', setBy: 'b', setAt: '2026-09-01' }
  it('keeps a usable cover, clamps focus and drops only a bad caption', () => {
    expect(cleanCover(good)).toEqual({ ...good, focusY: 62 })
    expect(cleanCover({ ...good, focusY: 400 })!.focusY).toBe(100)
    expect(cleanCover({ ...good, caption: '배란 테스트' })).toEqual({ photoId: 'p1', focusY: 62, setBy: 'b', setAt: '2026-09-01' })
    expect(cleanCover({ ...good, caption: 7 })).toEqual({ photoId: 'p1', focusY: 62, setBy: 'b', setAt: '2026-09-01' })
  })
  it('drops a cover it cannot show', () => {
    for (const bad of [
      null,
      'p1',
      [],
      { ...good, photoId: '' },
      { ...good, photoId: 'x'.repeat(201) },
      { ...good, photoId: 3 },
      { ...good, focusY: Number.NaN },
      { ...good, focusY: '50' },
      { ...good, setBy: 'c' },
      { ...good, setAt: '2026-13-01' },
    ]) {
      expect(cleanCover(bad)).toBeUndefined()
    }
  })
})

// ── View ────────────────────────────────────────────────────

describe('coverView', () => {
  const withCover = (setAt: ISODate, base = fresh()) => setCover(base, { photoId: 'p1', focusY: 30, caption: '한강' }, OWNER, setAt)

  it('shows the photo with the together count', () => {
    const s = setCoupleDates(withCover('2026-09-01'), { metDate: '2021-05-14' })
    const v = coverView(s, PARTNER, TODAY)
    expect(v).toEqual({
      photo: { photoId: 'p1', focusY: 30, caption: '한강' },
      mode: 'photo',
      quiet: false,
      autoHidden: false,
      hidden: false,
      together: 1947,
      decorate: true,
    })
  })

  it('without a cover: the default art', () => {
    const v = coverView(fresh(), OWNER, TODAY)
    expect(v.mode).toBe('art')
    expect('photo' in v).toBe(false)
  })

  it('has no together count without a (valid, past) met day', () => {
    expect(coverView(fresh(), OWNER, TODAY).together).toBeNull()
    expect(coverView(setCoupleDates(fresh(), { metDate: '2026-12-01' }), OWNER, TODAY).together).toBeNull()
    const broken = fresh()
    broken.couple = { ...broken.couple, metDate: 'soon' }
    expect(coverView(broken, OWNER, TODAY).together).toBeNull()
    expect(coverView(setCoupleDates(fresh(), { metDate: TODAY }), OWNER, TODAY).together).toBe(1)
  })

  it('hideCover true shows the art on my phone only', () => {
    const s = setHideCover(withCover('2026-09-01'), PARTNER, true)
    expect(coverView(s, PARTNER, TODAY)).toMatchObject({ mode: 'art', hidden: true })
    expect(coverView(s, OWNER, TODAY)).toMatchObject({ mode: 'photo', hidden: false })
  })

  it('quiet days: no together count, no decoration', () => {
    const s = setCoupleDates(afterLoss('2026-09-01', withCover('2026-06-01')), { metDate: '2021-05-14' })
    const v = coverView(s, OWNER, TODAY)
    expect(v).toMatchObject({ quiet: true, together: null, decorate: false, mode: 'photo', autoHidden: false })
    // After 42 days everything is back.
    const later = addDays('2026-09-01', QUIET_DAYS_AFTER_END)
    expect(coverView(s, OWNER, later)).toMatchObject({ quiet: false, decorate: true, together: expect.any(Number) })
  })

  it('quiet days hide a photo hung on or after the pregnancy was confirmed', () => {
    for (const setAt of ['2026-08-05', '2026-08-20']) {
      const s = withCover(setAt, afterLoss('2026-09-01'))
      // setCover on a pregnant state keeps the stage; the loss happened after.
      const v = coverView(s, PARTNER, TODAY)
      expect(v).toMatchObject({ quiet: true, autoHidden: true, mode: 'art' })
      expect(v.photo?.photoId).toBe('p1')
    }
    // Hung before the confirmation: stays.
    const before = withCover('2026-08-04', afterLoss('2026-09-01'))
    expect(coverView(before, PARTNER, TODAY)).toMatchObject({ autoHidden: false, mode: 'photo' })
  })

  it('a photo hung AFTER the loss (a later quiet day) is never hidden automatically', () => {
    // Ended 09-01 (confirmed 08-05). The day it ended still counts as the
    // pregnancy's; a photo chosen on 09-02 or later is this couple's choice now.
    const onEndDay = withCover('2026-09-01', afterLoss('2026-09-01'))
    expect(coverView(onEndDay, OWNER, TODAY)).toMatchObject({ quiet: true, autoHidden: true, mode: 'art' })
    for (const setAt of ['2026-09-02', TODAY]) {
      const s = withCover(setAt, afterLoss('2026-09-01'))
      for (const viewer of [OWNER, PARTNER]) {
        expect(coverView(s, viewer, TODAY), `${setAt} ${viewer}`).toMatchObject({
          quiet: true,
          autoHidden: false,
          hidden: false,
          mode: 'photo',
          decorate: false,
          together: null,
        })
      }
    }
  })

  it('no automatic hiding without a usable confirmation / end date', () => {
    const s = withCover('2026-08-20', afterLoss('2026-09-01'))
    // Still quiet (endedAt > ''), but with no confirmation day there is no "pregnancy photo" to hide.
    const noConfirm: AppState = { ...s, pregnancy: { ...s.pregnancy!, confirmedAt: '' } }
    expect(coverView(noConfirm, OWNER, TODAY)).toMatchObject({ quiet: true, autoHidden: false, mode: 'photo' })
  })

  it('hideCover false overrides the automatic hiding; true always hides', () => {
    const s = withCover('2026-08-20', afterLoss('2026-09-01'))
    expect(coverView(setHideCover(s, OWNER, false), OWNER, TODAY)).toMatchObject({ autoHidden: false, mode: 'photo' })
    expect(coverView(setHideCover(s, OWNER, true), OWNER, TODAY)).toMatchObject({ hidden: true, autoHidden: false, mode: 'art' })
    // Outside quiet days the automatic rule never applies.
    expect(coverView(s, OWNER, addDays('2026-09-01', QUIET_DAYS_AFTER_END)).autoHidden).toBe(false)
  })
})

// ── Hero line ───────────────────────────────────────────────

describe('heroLine', () => {
  const EVENING = 20

  it('greets by name when nothing else is going on', () => {
    expect(heroLine(fresh(), TODAY, PARTNER, EVENING)).toEqual({ kind: 'greeting', text: '민수님, 좋은 저녁이에요' })
    expect(heroLine(fresh(), TODAY, OWNER, 8).text).toBe('지은님, 좋은 아침이에요')
  })

  it('first match wins: signal → done → cheer → anniversary → greeting', () => {
    let s = annivOn(setCoupleDates(fresh(), { marriedDate: '2024-09-11' })) // 결혼 2주년 today
    expect(heroLine(s, TODAY, PARTNER, EVENING)).toEqual({ kind: 'anniversary', text: '오늘은 결혼 2주년이에요', target: 'diary' })
    s = sendCheer(s, OWNER, PARTNER, at(TODAY, '12'))
    expect(heroLine(s, TODAY, PARTNER, EVENING)).toEqual({ kind: 'cheer', text: '지은님이 응원을 보냈어요', avatar: OWNER, target: 'us' })
    s = finishDay(s, OWNER, TODAY, at(TODAY, '13'))
    expect(s.notifications.some((n) => n.key === `complete:${OWNER}:${TODAY}` && n.to === PARTNER)).toBe(true)
    expect(heroLine(s, TODAY, PARTNER, EVENING)).toEqual({ kind: 'done', text: '지은님이 오늘 할 일을 다 마쳤어요', avatar: OWNER, target: 'us' })
    s = sendSignal(s, OWNER, PARTNER, 'thanks', TODAY, at(TODAY, '14'))
    expect(heroLine(s, TODAY, PARTNER, EVENING)).toEqual({ kind: 'signal', text: '지은님이 신호를 보냈어요', avatar: OWNER, target: 'us' })
    // Once answered, the next rule shows again.
    s = sendSignal(s, PARTNER, OWNER, 'metoo', TODAY, at(TODAY, '15'))
    expect(heroLine(s, TODAY, PARTNER, EVENING).kind).toBe('done')
  })

  it('“다 마쳤어요” stays true to the checks: unchecking one takes it back', () => {
    const done = finishDay(fresh(), OWNER, TODAY, at(TODAY, '13'))
    expect(heroLine(done, TODAY, PARTNER, EVENING).kind).toBe('done')
    const first = activeDailyItems(done, OWNER)[0]!
    const undone = toggleWithCompletion(done, OWNER, PARTNER, TODAY, first.id, at(TODAY, '14')).state
    // The notice stays in the inbox, but the line above the photo no longer claims it.
    expect(undone.notifications.some((n) => n.key === `complete:${OWNER}:${TODAY}`)).toBe(true)
    expect(heroLine(undone, TODAY, PARTNER, EVENING).kind).toBe('greeting')
    // A bare notice without the checks (e.g. an old or restored inbox) says nothing either.
    expect(heroLine(notifyCompleted(fresh(), OWNER, PARTNER, TODAY, at(TODAY, '13')), TODAY, PARTNER, EVENING).kind).toBe('greeting')
  })

  it('only counts what the partner sent today, to me', () => {
    let s = sendCheer(fresh(), OWNER, PARTNER, at(addDays(TODAY, -1), '21'))
    s = notifyCompleted(s, OWNER, PARTNER, addDays(TODAY, -1), at(addDays(TODAY, -1), '21'))
    s = sendCheer(s, PARTNER, OWNER, at(TODAY, '10')) // mine, to them
    s = sendNudge(s, OWNER, PARTNER, TODAY, at(TODAY, '11')) // a 콕 is not a cheer
    expect(heroLine(s, TODAY, PARTNER, EVENING).kind).toBe('greeting')
    expect(heroLine(s, TODAY, OWNER, EVENING).kind).toBe('cheer')
  })

  it('a pending signal is always generic — even the sensitive ones', () => {
    for (const id of ['not-this-month', 'comfort', 'clinic', 'no-baby-talk', 'rest', 'dinner']) {
      const s = sendSignal(fresh(), OWNER, PARTNER, id, TODAY, at(TODAY, '18'))
      expect(heroLine(s, TODAY, PARTNER, EVENING), id).toEqual({
        kind: 'signal',
        text: '지은님이 신호를 보냈어요',
        avatar: OWNER,
        target: 'us',
      })
    }
  })

  it('says today’s anniversary with the right ending; while preparing only on the day itself (N27)', () => {
    const s = annivOn(addAnniversary(fresh(), { title: '프러포즈', date: TODAY, yearly: false }))
    expect(heroLine(s, TODAY, OWNER, EVENING).text).toBe('오늘은 프러포즈예요')
    const met = annivOn(setCoupleDates(fresh(), { metDate: addDays(TODAY, -1099) })) // 1,100일 today
    expect(heroLine(met, TODAY, OWNER, EVENING).text).toBe('오늘은 만난 지 1,100일이에요')
    // No 'D-N' while preparing — a day or a week ahead says nothing yet (and the day itself still does).
    for (const ahead of [1, 3, 7]) {
      const soon = annivOn(addAnniversary(fresh(), { title: '첫 캠핑', date: addDays(TODAY, ahead), yearly: false }))
      expect(heroLine(soon, TODAY, OWNER, EVENING).kind, `D-${ahead}`).toBe('greeting')
      expect(heroLine(soon, addDays(TODAY, ahead), OWNER, EVENING).text).toBe('오늘은 첫 캠핑이에요')
    }
  })

  it('after the preparing stage it still looks 7 days ahead', () => {
    const week = annivOn(pregnantOf(addAnniversary(fresh(), { title: '첫 캠핑', date: addDays(TODAY, 7), yearly: false })))
    expect(week.stage).toBe('pregnant')
    expect(heroLine(week, TODAY, OWNER, EVENING).text).toBe('💍 첫 캠핑까지 D-7')
    const far = annivOn(pregnantOf(addAnniversary(fresh(), { title: '첫 캠핑', date: addDays(TODAY, 8), yearly: false })))
    expect(heroLine(far, TODAY, OWNER, EVENING).kind).toBe('greeting')
    // Unset is on again once pregnant (anniversaryAlertsEnabled), so the line shows without a choice.
    const unset = pregnantOf(addAnniversary(fresh(), { title: '첫 캠핑', date: addDays(TODAY, 2), yearly: false }))
    expect(heroLine(unset, TODAY, OWNER, EVENING).text).toBe('💍 첫 캠핑까지 D-2')
  })

  it('skips anniversaries with health words and uses the next one', () => {
    let s = pregnantOf(addAnniversary(fresh(), { title: '임신 확인한 날', date: addDays(TODAY, 1), yearly: false }))
    expect(heroLine(s, TODAY, OWNER, EVENING).kind).toBe('greeting')
    s = addAnniversary(s, { title: '첫 여행', date: addMonths(addDays(TODAY, 4), -12), yearly: true })
    expect(heroLine(s, TODAY, OWNER, EVENING).text).toBe('💍 첫 여행 1주년까지 D-4')
    // A yearly one keeps its words in the title ('… 1주년').
    const yearly = annivOn(addAnniversary(fresh(), { title: '임신 확인한 날', date: addMonths(TODAY, -12), yearly: true }))
    expect(heroLine(yearly, TODAY, OWNER, EVENING).kind).toBe('greeting')
    // On the day itself while preparing: a health-word title is skipped for a clean one the same day.
    const sameDay = annivOn(addAnniversary(addAnniversary(fresh(), { title: '병원 첫 방문', date: TODAY, yearly: false }), { title: '이사한 날', date: TODAY, yearly: false }))
    expect(heroLine(sameDay, TODAY, OWNER, EVENING).text).toBe('오늘은 이사한 날이에요')
  })

  it('skipped titles never hide an allowed anniversary later in the week', () => {
    // Three health-word days first (more than the old "next 3 events" window), then an allowed one on day 5.
    let s = pregnantOf(fresh())
    for (const [title, d] of [['임신 확인한 날', 0], ['시험관 1차', 1], ['첫 초음파', 2], ['병원 첫 방문', 3]] as const) {
      s = addAnniversary(s, { title, date: addDays(TODAY, d), yearly: false })
    }
    s = addAnniversary(s, { title: '첫 캠핑', date: addDays(TODAY, 5), yearly: false })
    expect(heroLine(s, TODAY, OWNER, EVENING)).toEqual({ kind: 'anniversary', text: '💍 첫 캠핑까지 D-5', target: 'diary' })
    // The nearest allowed one wins; nothing past 7 days.
    s = addAnniversary(s, { title: '이사한 날', date: addDays(TODAY, 4), yearly: false })
    expect(heroLine(s, TODAY, OWNER, EVENING).text).toBe('💍 이사한 날까지 D-4')
  })

  it('says 예요 / 이에요 by how the last word is read (digits too)', () => {
    expect(copula('프러포즈')).toBe('예요')
    expect(copula('만난 지 1,100일')).toBe('이에요')
    expect(copula('결혼 2주년')).toBe('이에요')
    expect(copula('여행 2')).toBe('예요') // 이
    expect(copula('여행 3')).toBe('이에요') // 삼
    expect(copula('캠핑 D-7')).toBe('이에요') // 칠
    expect(copula('캠핑 D-9')).toBe('예요') // 구
    const s = annivOn(addAnniversary(fresh(), { title: '우리 여행 2', date: TODAY, yearly: false }))
    expect(heroLine(s, TODAY, OWNER, EVENING).text).toBe('오늘은 우리 여행 2예요')
  })

  it('quiet days: no “done”, no anniversary — a signal or cheer still shows', () => {
    let s = annivOn(afterLoss('2026-09-01'))
    s = setCoupleDates(s, { marriedDate: '2024-09-11' })
    s = finishDay(s, OWNER, TODAY, at(TODAY, '13'))
    expect(s.notifications.some((n) => n.key === `complete:${OWNER}:${TODAY}`)).toBe(true)
    expect(heroLine(s, TODAY, PARTNER, EVENING)).toEqual({ kind: 'greeting', text: '민수님, 좋은 저녁이에요' })
    s = sendCheer(s, OWNER, PARTNER, at(TODAY, '14'))
    expect(heroLine(s, TODAY, PARTNER, EVENING).kind).toBe('cheer')
    s = sendSignal(s, OWNER, PARTNER, 'comfort', TODAY, at(TODAY, '15'))
    expect(heroLine(s, TODAY, PARTNER, EVENING).kind).toBe('signal')
  })

  it('never says 🎉', () => {
    // Anniversaries whose own emoji is 🎉 (만난 지 N주년) still get 💍 or none.
    const s = pregnantOf(setCoupleDates(fresh(), { metDate: addMonths(addDays(TODAY, 2), -60) }))
    const line = heroLine(s, TODAY, OWNER, EVENING)
    expect(line.text).toBe('💍 만난 지 5주년까지 D-2')
    expect(line.text).not.toContain('🎉')
    const today = annivOn(setCoupleDates(fresh(), { metDate: addMonths(TODAY, -60) }))
    expect(heroLine(today, TODAY, OWNER, EVENING).text).toBe('오늘은 만난 지 5주년이에요')
  })

  // ── Property: whatever the phase, voice, sharing or inbox — no cycle words ──

  describe('never uses cycle, test or pregnancy words', () => {
    const CYCLE_WORDS = /가임기|배란|LH|생리|테스트|임신/
    const DAYS: ISODate[] = ['2026-09-02', '2026-09-04', '2026-09-08', '2026-09-11', '2026-09-14', '2026-09-20', '2026-09-29', '2026-10-02']

    /** Every TTC phase fixture: the cycle walk plus rest, a positive test, LH records, no data and after a loss. */
    function phases(): Array<{ name: string; state: AppState; day: ISODate }> {
      const out: Array<{ name: string; state: AppState; day: ISODate }> = []
      for (const day of DAYS) out.push({ name: `cycle ${day}`, state: fresh(), day })
      let lh = addLHTest(fresh(), { date: '2026-09-12', result: 'faint', time: '08:00', by: OWNER })
      lh = addLHTest(lh, { date: '2026-09-13', result: 'peak', time: '08:00', by: OWNER })
      out.push({ name: 'surge', state: lh, day: '2026-09-13' })
      out.push({ name: 'rest', state: startRestCycle(fresh(), '2026-09-05'), day: '2026-09-11' })
      const positive = addPregnancyTest(fresh(), { date: '2026-09-27', result: 'positive', time: '06:30', by: OWNER })
      out.push({ name: 'positive-pending', state: markPositivePending(positive.state, '2026-09-27', positive.test!.id), day: '2026-09-28' })
      out.push({ name: 'no-data', state: fresh({ periods: [] }), day: TODAY })
      out.push({ name: 'after-loss', state: afterLoss('2026-09-01'), day: '2026-09-11' })
      return out
    }

    /** Inbox variants: nothing, sensitive signals, a done notice, a cheer, anniversaries with health words. */
    function inboxes(s: AppState, day: ISODate, viewer: MemberId): AppState[] {
      const p = other(viewer)
      const withAnniv = addAnniversary(
        addAnniversary(
          addAnniversary(s, { title: '임신 확인한 날', date: addMonths(addDays(day, 1), -12), yearly: true }),
          { title: '첫 LH 양성', date: addDays(day, 2), yearly: false },
        ),
        { title: '테스트 두 줄 본 날', date: day, yearly: false },
      )
      // 'N년 전 오늘' on, with a clean entry and one with health words a year ago today (the line is generic either way).
      const memories: AppState = {
        ...s,
        settings: { ...s.settings, memories: true },
        diary: [
          ...s.diary,
          { id: 'm1', date: addMonths(day, -12), author: p, stage: 'preparing', text: '가임기 첫날 LH 양성 테스트', createdAt: at(addMonths(day, -12), '20') },
          { id: 'm2', date: addMonths(day, -24), author: viewer, stage: 'preparing', text: '한강 산책', createdAt: at(addMonths(day, -24), '20') },
        ],
      }
      return [
        s,
        memories,
        sendSignal(s, p, viewer, 'not-this-month', day, at(day, '18')),
        sendSignal(s, p, viewer, 'clinic', day, at(day, '18')),
        sendSignal(s, p, viewer, 'no-baby-talk', day, at(day, '18')),
        sendSignal(s, p, viewer, 'comfort', day, at(day, '18')),
        notifyCompleted(s, p, viewer, day, at(day, '12')),
        finishDay(s, p, day, at(day, '12')),
        sendCheer(s, p, viewer, at(day, '12'), '오늘 생리 시작했다며, 푹 쉬어요'),
        withAnniv,
        setCoupleDates(withAnniv, { metDate: addDays(day, -99) }),
        annivOn(withAnniv),
        annivOn(setCoupleDates(withAnniv, { metDate: addDays(day, -99) })),
      ]
    }

    const STYLES: AlertStyle[] = ['explicit', 'soft', 'off']

    it('for every phase × viewer × alert style × low-pressure × discreet × sharing × inbox', () => {
      let checked = 0
      for (const { name, state, day } of phases()) {
        for (const viewer of ['a', 'b'] as const) {
          for (const style of STYLES) {
            for (const lowPressure of [false, true]) {
              for (const discreet of [false, true]) {
                for (const share of [false, true]) {
                  const base: AppState = {
                    ...state,
                    settings: {
                      ...state.settings,
                      alertStyle: { ...state.settings.alertStyle, [viewer]: style },
                      personal: { [viewer]: { lowPressure, discreet } },
                      shareLevel: share ? 'details' : 'week',
                    },
                  }
                  for (const s of inboxes(base, day, viewer)) {
                    for (const hour of [3, 8, 14, 20]) {
                      const line = heroLine(s, day, viewer, hour)
                      expect(line.text, `${name} ${viewer} ${style}`).not.toMatch(CYCLE_WORDS)
                      expect(line.text).not.toMatch(COVER_WORDS)
                      expect(line.text).not.toContain('🎉')
                      checked++
                    }
                  }
                }
              }
            }
          }
        }
      }
      expect(checked).toBeGreaterThan(5000)
    })
  })
})

// ── Photos: copies, deletes, no IndexedDB, backups ─────────

describe('releasableCoverPhoto (what the cover may delete from this phone)', () => {
  const entry = (s: AppState, photoId: string) =>
    addEntry(s, { date: TODAY, author: OWNER, text: '서울숲', photoId, stage: 'preparing' }, at(TODAY, '21'))

  it('replacing or clearing the cover deletes only its previous COPY', () => {
    const before = setCover(fresh(), { photoId: 'copy-1', focusY: 50 }, OWNER, TODAY)
    const replaced = setCover(before, { photoId: 'copy-2', focusY: 50 }, OWNER, TODAY)
    expect(releasableCoverPhoto(replaced, 'copy-1')).toBe('copy-1')
    expect(releasableCoverPhoto(clearCover(before), 'copy-1')).toBe('copy-1')
  })

  it('never an album entry’s photo, never a built-in picture, never the photo still hung', () => {
    // A cover id that is also a diary photo (an old or hand-edited backup): the diary keeps it.
    const shared = entry(setCover(fresh(), { photoId: 'diary-1', focusY: 50 }, OWNER, TODAY), 'diary-1')
    expect(releasableCoverPhoto(clearCover(shared), 'diary-1')).toBeNull()
    expect(releasableCoverPhoto(clearCover(setCover(fresh(), { photoId: 'builtin:sea', focusY: 50 }, OWNER, TODAY)), 'builtin:sea')).toBeNull()
    // Only the focus or the line changed: same photo, nothing to delete.
    const moved = setCoverFocus(setCover(fresh(), { photoId: 'copy-1', focusY: 20 }, OWNER, TODAY), 70)
    expect(releasableCoverPhoto(moved, 'copy-1')).toBeNull()
    expect(releasableCoverPhoto(fresh(), undefined)).toBeNull()
  })
})

describe('photos without IndexedDB (node, private windows, the single-file demo)', () => {
  it('built-in pictures resolve; a stored id reads as missing; saving fails loudly; deleting is quiet', async () => {
    expect(typeof indexedDB).toBe('undefined')
    for (const id of BUILTIN_PHOTO_IDS) expect((await getPhotoBlob(id))?.type).toBe('image/svg+xml')
    // A cover restored on another phone: the id is there, the image is not → the home's 'missing' state.
    expect(isBuiltinPhoto('4b1d-uuid')).toBe(false)
    expect(await getPhotoBlob('4b1d-uuid')).toBeNull()
    expect(await getPhotoURL('4b1d-uuid')).toBeNull()
    // CoverSheet shows "이 브라우저에서는 사진을 저장할 수 없어요…" when this throws.
    await expect(savePhoto(new Blob(['x'], { type: 'image/jpeg' }))).rejects.toThrow()
    await expect(deletePhoto('4b1d-uuid')).resolves.toBeUndefined()
  })
})

describe('backups carry the cover id only', () => {
  it('a cover restored on another phone keeps its id (the home then asks for the photo again)', () => {
    let s = setCover(fresh(), { photoId: '4b1d-uuid', focusY: 35, caption: '9.20 · 한강 산책' }, OWNER, '2026-09-20')
    s = setHideCover(s, PARTNER, true)
    const restored = parseState(JSON.stringify(s))!
    expect(restored.couple.cover).toEqual(s.couple.cover)
    expect(restored.settings.personal).toEqual({ a: { hideCover: true } })
    // Mode stays 'photo': the screen tries the id, finds no image (getPhotoBlob → null)
    // and shows the drawing with "사진을 다시 골라 주세요" instead of breaking.
    expect(coverView(restored, OWNER, TODAY)).toMatchObject({ mode: 'photo', photo: { photoId: '4b1d-uuid', focusY: 35 } })
    expect(coverView(restored, PARTNER, TODAY)).toMatchObject({ mode: 'art', hidden: true })
    // No image data ever goes into the backup.
    expect(JSON.stringify(restored)).not.toMatch(/data:image|<svg/)
  })
})

// ── Demo fixtures ───────────────────────────────────────────

describe('the demo couple’s cover and line', () => {
  const NOW = (d: ISODate, h: number) => new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)), h, 30)
  const DAYS: ISODate[] = ['2026-09-29', '2026-10-03', '2026-01-31', '2026-12-31', '2028-02-29']

  it('every stage, day, viewer and hour: no health words, no 🎉, a target only with a reason', () => {
    for (const stage of ['preparing', 'pregnant', 'parenting'] as const) {
      for (const day of DAYS) {
        const s = createDemoState(day, NOW(day, 19), stage)
        for (const viewer of ['a', 'b'] as const) {
          expect(coverView(s, viewer, day)).toMatchObject({ mode: 'photo', quiet: false, decorate: true })
          for (const hour of [0, 7, 13, 19, 23]) {
            const line = heroLine(s, day, viewer, hour)
            expect(line.text, `${stage} ${day} ${viewer}`).not.toMatch(COVER_WORDS)
            expect(line.text).not.toContain('🎉')
            if (line.kind === 'greeting') expect(line).toEqual({ kind: 'greeting', text: expect.stringMatching(/님, 좋은 /) })
            if (line.avatar) expect(line.avatar).toBe(other(viewer))
          }
        }
      }
    }
  })

  it('after a loss in the pregnancy demo: the cover hung while pregnant waits behind the drawing, for both', () => {
    const day = '2026-09-29'
    const lost = backToPreparing(createDemoState(day, NOW(day, 19), 'pregnant'), day)
    // Hung 30 days ago — after the clinic confirmed it, before it ended.
    expect(lost.couple.cover!.setAt >= lost.pregnancy!.confirmedAt).toBe(true)
    for (const viewer of ['a', 'b'] as const) {
      expect(coverView(lost, viewer, day)).toMatchObject({ quiet: true, autoHidden: true, mode: 'art', together: null, decorate: false })
      const line = heroLine(lost, day, viewer, 19)
      expect(['greeting', 'signal', 'cheer']).toContain(line.kind)
      expect(line.text).not.toMatch(COVER_WORDS)
    }
    // "사진 다시 보기" is one person's choice; the other phone still waits.
    const shown = setHideCover(lost, 'b', false)
    expect(coverView(shown, 'b', day).mode).toBe('photo')
    expect(coverView(shown, 'a', day).mode).toBe('art')
    // 42 days on, everything is back for both.
    expect(coverView(lost, 'a', addDays(day, QUIET_DAYS_AFTER_END))).toMatchObject({ quiet: false, mode: 'photo', decorate: true })
  })
})

describe('Next B on the cover', () => {
  const CYCLE_WORDS = /가임기|배란|LH|생리|테스트|임신|출혈|병원/
  const DAYS: ISODate[] = ['2026-09-02', '2026-09-11', '2026-09-20', '2026-09-28', '2026-10-02']

  it('잠금화면 숨김을 홈 카드까지: the line over the photo stays neutral for that person (owner and partner), whatever the moment', () => {
    const bleeding = markBleeding(markPositivePending(fresh(), '2026-09-27'), '2026-09-28')
    const lost = endPregnancy(startPregnancy(fresh(), '2026-07-01', '2026-08-05'), '2026-09-01')
    for (const state of [fresh(), bleeding, lost]) {
      for (const viewer of ['a', 'b'] as const) {
        const s = setPersonalPref(state, viewer, 'homeDiscreet', true)
        for (const day of DAYS) {
          for (const hour of [8, 14, 21]) {
            expect(heroLine(s, day, viewer, hour).text).not.toMatch(CYCLE_WORDS)
          }
        }
      }
    }
  })

  it('the quiet after a loss started by endPregnancy is the cover’s quiet too — the same 42 days', () => {
    const lost = endPregnancy(startPregnancy(fresh(), '2026-07-01', '2026-08-05'), '2026-09-01')
    expect(lost.restCycle?.until).toBe(addDays('2026-09-01', QUIET_DAYS_AFTER_END - 1))
    expect(coverView(lost, OWNER, lost.restCycle!.until!).quiet).toBe(true)
    expect(coverView(lost, OWNER, addDays(lost.restCycle!.until!, 1)).quiet).toBe(false)
  })
})

// ── 'N년 전 오늘' · 기념일 알림 · signal chips (Next B, home polish) ──

describe("'N년 전 오늘' (settings.memories, off by default)", () => {
  const EVENING = 20
  const on = (s: AppState): AppState => ({ ...s, settings: { ...s.settings, memories: true } })
  const entry = (s: AppState, date: ISODate, text: string, over: { stage?: 'preparing' | 'pregnant' | 'parenting'; author?: MemberId } = {}) =>
    addEntry(s, { date, author: over.author ?? OWNER, text, stage: over.stage ?? 'preparing' }, at(date, '21'))
  const yearsAgo = (d: ISODate, n: number) => addMonths(d, -12 * n)

  it('off unless the couple turned it on (SETTINGS_DEFAULTS.memories = false): an entry from a year ago says nothing', () => {
    expect(SETTINGS_DEFAULTS.memories).toBe(false)
    const s = entry(fresh(), yearsAgo(TODAY, 1), '한강 산책')
    expect(memoryFor(s, TODAY, OWNER)).toBeUndefined()
    expect(heroLine(s, TODAY, OWNER, EVENING).kind).toBe('greeting')
    expect(memoryFor({ ...s, settings: { ...s.settings, memories: false } }, TODAY, OWNER)).toBeUndefined()
    expect(memoryFor(on(s), TODAY, OWNER)).toMatchObject({ date: yearsAgo(TODAY, 1), years: 1 })
  })

  it('on: an entry from exactly 1–3 years ago today, the nearest year first; the line opens 우리', () => {
    let s = on(fresh())
    for (const n of [1, 2, 3, 4]) s = entry(s, yearsAgo(TODAY, n), `${n}년 전`)
    const line = heroLine(s, PARTNER === 'a' ? TODAY : TODAY, PARTNER, EVENING)
    expect(line).toMatchObject({ kind: 'memory', text: '1년 전 오늘의 이야기 ›', target: 'diary' })
    expect(line.memory).toMatchObject({ date: yearsAgo(TODAY, 1), years: 1 })
    expect(line.avatar).toBeUndefined()
    expect(memoryLineText({ years: 3 })).toBe('3년 전 오늘의 이야기 ›')
    // Without the 1-year entry the 2-year one shows; four years is too far (MEMORY_YEARS).
    expect(MEMORY_YEARS).toEqual({ min: 1, max: 3 })
    const two = { ...s, diary: s.diary.filter((e) => e.date !== yearsAgo(TODAY, 1)) }
    expect(heroLine(two, TODAY, PARTNER, EVENING).text).toBe('2년 전 오늘의 이야기 ›')
    const four = { ...s, diary: s.diary.filter((e) => e.date === yearsAgo(TODAY, 4)) }
    expect(memoryFor(four, TODAY, PARTNER)).toBeUndefined()
    // The same month and day only — not the day before or after; the day's first entry when there are two.
    expect(memoryFor(entry(on(fresh()), addDays(yearsAgo(TODAY, 1), 1), 'x'), TODAY, OWNER)).toBeUndefined()
    expect(memoryFor(entry(on(fresh()), addDays(yearsAgo(TODAY, 1), -1), 'x'), TODAY, OWNER)).toBeUndefined()
    let twice = entry(on(fresh()), yearsAgo(TODAY, 1), '저녁')
    twice = addEntry(twice, { date: yearsAgo(TODAY, 1), author: PARTNER, text: '아침', stage: 'preparing' }, at(yearsAgo(TODAY, 1), '08'))
    const first = memoryFor(twice, TODAY, OWNER)!
    expect(twice.diary.find((e) => e.id === first.entryId)?.text).toBe('아침')
  })

  it('sits between the cheer and the anniversary: a cheer wins, an anniversary D-3 loses', () => {
    let s = entry(on(setCoupleDates(fresh(), { marriedDate: '2024-09-14' })), yearsAgo(TODAY, 1), '한강 산책')
    expect(heroLine(s, TODAY, PARTNER, EVENING).kind).toBe('memory')
    s = sendCheer(s, OWNER, PARTNER, at(TODAY, '12'))
    expect(heroLine(s, TODAY, PARTNER, EVENING).kind).toBe('cheer')
    s = sendSignal(s, OWNER, PARTNER, 'thanks', TODAY, at(TODAY, '14'))
    expect(heroLine(s, TODAY, PARTNER, EVENING).kind).toBe('signal')
  })

  it('hard filters: nothing written while pregnant, nothing from inside an ended pregnancy or its 42 quiet days', () => {
    const base = on(fresh())
    expect(memoryFor(entry(base, yearsAgo(TODAY, 1), '태동이 느껴져요', { stage: 'pregnant' }), TODAY, OWNER)).toBeUndefined()
    expect(memoryFor(entry(base, yearsAgo(TODAY, 1), '산책', { stage: 'parenting' }), TODAY, OWNER)).toBeDefined()
    // Pregnant from the 2025-07-01 period, confirmed 08-05, ended 09-20 (a year before today) → quiet to 2025-10-31.
    const lost = on(backToPreparing(startPregnancy(fresh(), '2025-07-01', '2025-08-05'), '2025-09-20'))
    expect(memoryFor(entry(lost, '2025-07-01', '산책'), '2026-07-01', OWNER)).toBeUndefined()
    expect(memoryFor(entry(lost, '2025-09-11', '산책'), '2026-09-11', OWNER)).toBeUndefined()
    expect(memoryFor(entry(lost, '2025-10-31', '산책'), '2026-10-31', OWNER)).toBeUndefined()
    expect(memoryFor(entry(lost, '2025-11-01', '산책'), '2026-11-01', OWNER)).toMatchObject({ date: '2025-11-01' })
    expect(memoryFor(entry(lost, '2025-06-30', '산책'), '2026-06-30', OWNER)).toMatchObject({ date: '2025-06-30' })
    // And no memory at all on today's quiet days (the cover is quiet).
    const quiet = entry(on(afterLoss('2026-09-01')), yearsAgo(TODAY, 1), '산책')
    expect(memoryFor(quiet, TODAY, OWNER)).toBeUndefined()
    expect(heroLine(quiet, TODAY, OWNER, EVENING).kind).toBe('greeting')
    expect(memoryFor(quiet, addDays('2026-09-01', QUIET_DAYS_AFTER_END), OWNER)).toBeUndefined() // a different month-day
  })

  it("hard filters: period days 1–3 and a negative test's day — the entry's day and today", () => {
    expect(PERIOD_EARLY_DAYS).toBe(3)
    const periods = [{ start: '2025-09-10' }, { start: '2026-09-01' }]
    const s = on(fresh({ periods }))
    // 2025-09-11 is day 2 of that period; 09-13 is day 4.
    expect(memoryFor(entry(s, '2025-09-11', '산책'), '2026-09-11', OWNER)).toBeUndefined()
    expect(memoryFor(entry(s, '2025-09-12', '산책'), '2026-09-12', OWNER)).toBeUndefined()
    expect(memoryFor(entry(s, '2025-09-13', '산책'), '2026-09-13', OWNER)).toMatchObject({ date: '2025-09-13' })
    // Today is day 2 of the 2026-09-01 period: nothing for her. N19 changed the
    // partner's side on purpose: without her details he skips only a period
    // she TOLD him about — a line that vanished on the day of an untold period
    // would tell it. With her details (he sees her period days) it is skipped too.
    const d2 = entry(s, '2025-09-02', '산책')
    expect(memoryFor(d2, '2026-09-02', OWNER)).toBeUndefined()
    expect(memoryFor(d2, '2026-09-02', PARTNER)).toBeDefined()
    expect(memoryFor(tellPartnerPeriod(d2, '2026-09-01', '2026-09-01T09:00:00+09:00'), '2026-09-02', PARTNER)).toBeUndefined()
    expect(memoryFor({ ...d2, settings: { ...d2.settings, shareLevel: 'details' } }, '2026-09-02', PARTNER)).toBeUndefined()
    expect(memoryFor(entry(s, '2025-09-04', '산책'), '2026-09-04', PARTNER)).toBeDefined()
    // A negative test on the entry's day, or today.
    const negThen = on(fresh({ pregnancyTests: [{ id: 't1', date: '2025-09-20', result: 'negative', by: OWNER }] }))
    expect(memoryFor(entry(negThen, '2025-09-20', '산책'), '2026-09-20', OWNER)).toBeUndefined()
    const negNow = on(fresh({ pregnancyTests: [{ id: 't2', date: '2026-09-20', result: 'negative', by: OWNER }] }))
    expect(memoryFor(entry(negNow, '2025-09-20', '산책'), '2026-09-20', OWNER)).toBeUndefined()
    // (N19) A negative test is never told: his line is the same as the day before.
    expect(memoryFor(entry(negNow, '2025-09-20', '산책'), '2026-09-20', PARTNER)).toBeDefined()
    expect(memoryFor(entry(negNow, '2025-09-19', '산책'), '2026-09-19', PARTNER)).toBeDefined()
    // A faint line is a test day that led nowhere too (cover.ts sadTestOn): nothing that day either.
    const faint = on(fresh({ pregnancyTests: [{ id: 't3', date: '2026-09-20', result: 'faint', by: OWNER }] }))
    expect(memoryFor(entry(faint, '2025-09-20', '산책'), '2026-09-20', OWNER)).toBeUndefined()
    expect(memoryFor(entry(faint, '2025-09-21', '산책'), '2026-09-21', OWNER)).toBeDefined()
  })

  it("hard filters: health words (COVER_WORDS) and the other's '나만 보기' entries", () => {
    const s = on(fresh())
    for (const text of ['가임기 첫날', 'LH 양성 나온 날', '병원 다녀온 날', '임신 테스트 음성', '초음파 보고 옴']) {
      expect(memoryFor(entry(s, yearsAgo(TODAY, 1), text), TODAY, OWNER), text).toBeUndefined()
    }
    // A later clean entry on the same day still shows (the filter skips, it doesn't block the day).
    const mixed = entry(entry(s, yearsAgo(TODAY, 1), '병원 다녀온 날'), yearsAgo(TODAY, 1), '한강 산책')
    expect(mixed.diary.find((e) => e.id === memoryFor(mixed, TODAY, OWNER)?.entryId)?.text).toBe('한강 산책')
    // '나만 보기': not a shared memory for anyone — 설정 › 첫 화면 promises '두 사람이 함께 남긴 기록만'.
    const mine = entry(s, yearsAgo(TODAY, 1), '혼자 쓴 날')
    const privateOne = setEntryPrivacy(mine, mine.diary[mine.diary.length - 1]!.id, OWNER, true)
    expect(memoryFor(mine, TODAY, OWNER)).toBeDefined()
    expect(memoryFor(privateOne, TODAY, OWNER)).toBeUndefined()
    expect(memoryFor(privateOne, TODAY, PARTNER)).toBeUndefined()
    expect(heroLine(privateOne, TODAY, PARTNER, EVENING).kind).toBe('greeting')
  })

  it('the demo couple, memories on: never a health word, and only a target with a reason', () => {
    for (const stage of ['preparing', 'pregnant', 'parenting'] as const) {
      for (const day of ['2026-09-29', '2026-10-03', '2027-06-14'] as ISODate[]) {
        const s = on(createDemoState(day, new Date(2026, 8, 29, 19, 30), stage))
        for (const viewer of ['a', 'b'] as const) {
          const line = heroLine(s, day, viewer, 19)
          expect(line.text).not.toMatch(COVER_WORDS)
          if (line.kind === 'memory') expect(line).toMatchObject({ target: 'diary', text: expect.stringMatching(/^[123]년 전 오늘의 이야기 ›$/) })
        }
      }
    }
  })
})

describe('기념일 알림 (settings.anniversaryAlerts): off by default while preparing, an explicit choice wins (N27)', () => {
  const EVENING = 20
  const off = (s: AppState): AppState => setAnniversaryAlerts(s, false)

  it('preparing, never chosen: no anniversary line and no anniv: notices — not on the day either', () => {
    expect(SETTINGS_DEFAULTS.anniversaryAlerts).toBe(true) // the later stages' value; preparing reads off
    const s = setCoupleDates(fresh(), { marriedDate: '2024-09-14' })
    expect(s.settings.anniversaryAlerts).toBeUndefined()
    expect(anniversaryAlertsEnabled(s)).toBe(false)
    expect(heroLine(s, '2026-09-14', PARTNER, EVENING)).toEqual({ kind: 'greeting', text: '민수님, 좋은 저녁이에요' })
    expect(anniversaryNotices(s, '2026-09-07')).toEqual([])
    expect(anniversaryNotices(s, '2026-09-14')).toEqual([])
  })

  it('preparing, turned on: the line and the notice on the day only — no D-7 notice, no D-N line', () => {
    const s = annivOn(setCoupleDates(fresh(), { marriedDate: '2024-09-14' }))
    expect(s.settings.anniversaryAlerts).toBe(true)
    expect(heroLine(s, TODAY, PARTNER, EVENING).kind).toBe('greeting') // D-3
    expect(heroLine(s, '2026-09-14', PARTNER, EVENING).text).toBe('오늘은 결혼 2주년이에요')
    expect(anniversaryNotices(s, '2026-09-07')).toEqual([])
    expect(anniversaryNotices(s, '2026-09-14').map((n) => n.key)).toEqual(['anniv:married-year:2:2026-09-14:0:a', 'anniv:married-year:2:2026-09-14:0:b'])
  })

  it('pregnant, never chosen: on, with the week-ahead notice and the D-N line as before', () => {
    const s = pregnantOf(setCoupleDates(fresh(), { marriedDate: '2024-09-14' }))
    expect(anniversaryAlertsEnabled(s)).toBe(true)
    expect(heroLine(s, TODAY, PARTNER, EVENING)).toEqual({ kind: 'anniversary', text: '💍 결혼 2주년까지 D-3', target: 'diary' })
    expect(anniversaryNotices(s, '2026-09-07').map((n) => n.key)).toEqual(['anniv:married-year:2:2026-09-14:7:a', 'anniv:married-year:2:2026-09-14:7:b'])
    expect(anniversaryNotices(s, '2026-09-14')).toHaveLength(2)
  })

  it('turned off: nothing in any stage, and the rest of the cover still works', () => {
    for (const base of [fresh(), pregnantOf(fresh())]) {
      const s = off(setCoupleDates(base, { marriedDate: '2024-09-14' }))
      expect(s.settings.anniversaryAlerts).toBe(false)
      expect(heroLine(s, TODAY, PARTNER, EVENING)).toEqual({ kind: 'greeting', text: '민수님, 좋은 저녁이에요' })
      expect(heroLine(s, '2026-09-14', PARTNER, EVENING).kind).toBe('greeting')
      expect(anniversaryNotices(s, '2026-09-07')).toEqual([])
      expect(anniversaryNotices(s, '2026-09-14')).toEqual([])
      expect(heroLine(sendCheer(s, OWNER, PARTNER, at(TODAY, '12')), TODAY, PARTNER, EVENING).kind).toBe('cheer')
    }
  })

  it('the choice made while preparing outlives the stage change (it is stored, not dropped as a default)', () => {
    const on = annivOn(setCoupleDates(fresh(), { marriedDate: '2024-09-14' }))
    expect(anniversaryAlertsEnabled(pregnantOf(on))).toBe(true)
    const offed = off(setCoupleDates(fresh(), { marriedDate: '2024-09-14' }))
    expect(anniversaryAlertsEnabled(pregnantOf(offed))).toBe(false)
    expect(anniversaryNotices(pregnantOf(offed), '2026-09-07')).toEqual([])
    // Same value again → the same object (no rewrite).
    expect(setAnniversaryAlerts(on, true)).toBe(on)
  })
})

describe('signal chips and the privacy sweep', () => {
  const EVENING = 20

  it('no chip text carries a cycle word; the two with 임신·병원 words never reach the cover line', () => {
    for (const sg of ALL_SIGNALS) expect(sg.text, sg.id).not.toMatch(/가임기|배란|LH|생리|테스트|임테기/)
    // COVER_WORDS is the cover's own list (임신, 병원 included): these two chips carry such a word by design —
    // '병원 같이 가 줄래요?' and '오늘은 임신 얘기 말고 쉬어요' — and only the person they were sent to reads them, in 우리 한 줄 and the inbox.
    // ('clinic-together' — his '병원 같이 갈게요', N30 — is the same kind of line, when the list has it.)
    const withWords = ALL_SIGNALS.filter((sg) => COVER_WORDS.test(sg.text)).map((sg) => sg.id)
    expect(withWords).toEqual(expect.arrayContaining(['clinic', 'no-baby-talk']))
    for (const id of withWords) expect(['clinic', 'no-baby-talk', 'clinic-together'], id).toContain(id)
    for (const sg of ALL_SIGNALS) {
      const s = sendSignal(fresh(), OWNER, PARTNER, sg.id, TODAY, at(TODAY, '18'))
      const line = heroLine(s, TODAY, PARTNER, EVENING)
      expect(line.text, sg.id).not.toContain(sg.text)
      expect(line.text).not.toMatch(COVER_WORDS)
    }
  })
})
