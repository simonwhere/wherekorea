import { describe, expect, it } from 'vitest'
import { addDays, addMonths } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { addAnniversary, setCoupleDates } from '@/lib/logic/anniversary'
import {
  COVER_CAPTION_MAX,
  COVER_WORDS,
  captionLength,
  cleanCover,
  clearCover,
  copula,
  coverCaptionProblem,
  coverView,
  heroLine,
  releasableCoverPhoto,
  setCover,
  setCoverFocus,
  setHideCover,
} from '@/lib/logic/cover'
import { createDemoState } from '@/lib/demo'
import { addEntry } from '@/lib/logic/diary'
import { deletePhoto, getPhotoBlob, getPhotoURL, isBuiltinPhoto, savePhoto } from '@/lib/photos'
import { parseState } from '@/lib/storage'
import { BUILTIN_PHOTO_IDS } from '@/lib/content/demoPhotos'
import { addLHTest, addPregnancyTest } from '@/lib/logic/logs'
import { activeDailyItems } from '@/lib/logic/checks'
import { notifyCompleted, sendCheer, sendNudge } from '@/lib/logic/notifications'
import { toggleWithCompletion } from '@/lib/logic/today'
import { setPersonalPref } from '@/lib/logic/prefs'
import { QUIET_DAYS_AFTER_END, backToPreparing, startPregnancy } from '@/lib/logic/pregnancy'
import { sendSignal } from '@/lib/logic/signals'
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
    let s = setCoupleDates(fresh(), { marriedDate: '2024-09-14' }) // 결혼 2주년 on 09-14 (D-3)
    expect(heroLine(s, TODAY, PARTNER, EVENING)).toEqual({ kind: 'anniversary', text: '💍 결혼 2주년까지 D-3', target: 'diary' })
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

  it('says today’s anniversary with the right ending, and looks 7 days ahead', () => {
    const s = addAnniversary(fresh(), { title: '프러포즈', date: TODAY, yearly: false })
    expect(heroLine(s, TODAY, OWNER, EVENING).text).toBe('오늘은 프러포즈예요')
    const met = setCoupleDates(fresh(), { metDate: addDays(TODAY, -1099) }) // 1,100일 today
    expect(heroLine(met, TODAY, OWNER, EVENING).text).toBe('오늘은 만난 지 1,100일이에요')
    const week = addAnniversary(fresh(), { title: '첫 캠핑', date: addDays(TODAY, 7), yearly: false })
    expect(heroLine(week, TODAY, OWNER, EVENING).text).toBe('💍 첫 캠핑까지 D-7')
    const far = addAnniversary(fresh(), { title: '첫 캠핑', date: addDays(TODAY, 8), yearly: false })
    expect(heroLine(far, TODAY, OWNER, EVENING).kind).toBe('greeting')
  })

  it('skips anniversaries with health words and uses the next one', () => {
    let s = addAnniversary(fresh(), { title: '임신 확인한 날', date: addDays(TODAY, 1), yearly: false })
    expect(heroLine(s, TODAY, OWNER, EVENING).kind).toBe('greeting')
    s = addAnniversary(s, { title: '첫 여행', date: addMonths(addDays(TODAY, 4), -12), yearly: true })
    expect(heroLine(s, TODAY, OWNER, EVENING).text).toBe('💍 첫 여행 1주년까지 D-4')
    // A yearly one keeps its words in the title ('… 1주년').
    const yearly = addAnniversary(fresh(), { title: '임신 확인한 날', date: addMonths(TODAY, -12), yearly: true })
    expect(heroLine(yearly, TODAY, OWNER, EVENING).kind).toBe('greeting')
  })

  it('skipped titles never hide an allowed anniversary later in the week', () => {
    // Three health-word days first (more than the old "next 3 events" window), then an allowed one on day 5.
    let s = fresh()
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
    const s = addAnniversary(fresh(), { title: '우리 여행 2', date: TODAY, yearly: false })
    expect(heroLine(s, TODAY, OWNER, EVENING).text).toBe('오늘은 우리 여행 2예요')
  })

  it('quiet days: no “done”, no anniversary — a signal or cheer still shows', () => {
    let s = afterLoss('2026-09-01')
    s = setCoupleDates(s, { marriedDate: '2024-09-14' })
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
    const s = setCoupleDates(fresh(), { metDate: addMonths(addDays(TODAY, 2), -60) })
    const line = heroLine(s, TODAY, OWNER, EVENING)
    expect(line.text).toBe('💍 만난 지 5주년까지 D-2')
    expect(line.text).not.toContain('🎉')
    const today = setCoupleDates(fresh(), { metDate: addMonths(TODAY, -60) })
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
      out.push({ name: 'positive-pending', state: markPositivePending(positive.state, '2026-09-27', positive.test.id), day: '2026-09-28' })
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
      return [
        s,
        sendSignal(s, p, viewer, 'not-this-month', day, at(day, '18')),
        sendSignal(s, p, viewer, 'clinic', day, at(day, '18')),
        sendSignal(s, p, viewer, 'no-baby-talk', day, at(day, '18')),
        sendSignal(s, p, viewer, 'comfort', day, at(day, '18')),
        notifyCompleted(s, p, viewer, day, at(day, '12')),
        finishDay(s, p, day, at(day, '12')),
        sendCheer(s, p, viewer, at(day, '12'), '오늘 생리 시작했다며, 푹 쉬어요'),
        withAnniv,
        setCoupleDates(withAnniv, { metDate: addDays(day, -99) }),
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
                      shareCycleDetails: share,
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
