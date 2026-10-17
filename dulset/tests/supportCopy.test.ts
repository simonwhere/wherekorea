// lib/content/supportCopy — the one wording for [같이 할게요] (founder decision
// 2026-10-17, "추천대로 1~3번 다 진행해줘" — 3): the app's SupportButton, the
// link's SupportToggle and both toasts take their words from here.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { supportToast } from '@/components/link/model'
import { ROADMAP } from '@/lib/content/roadmap'
import {
  SUPPORT_CANCEL,
  SUPPORT_LABEL,
  SUPPORT_PRESSED,
  SUPPORT_TOAST_OFF,
  supportAriaLabel,
  supportCancelAriaLabel,
  supportToastAppOn,
  supportToastLinkOn,
} from '@/lib/content/supportCopy'
import { shortTitle } from '@/lib/logic/together'

const ROOT = join(__dirname, '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const BANNED = /숙제|실패|노력|오늘 꼭|관계를 가져야|기한 지남|안 했어요/

describe('supportCopy', () => {
  it('the words', () => {
    expect(SUPPORT_LABEL).toBe('같이 할게요')
    expect(SUPPORT_PRESSED).toBe('같이 하기로 했어요')
    expect(SUPPORT_CANCEL).toBe('취소')
    expect(SUPPORT_TOAST_OFF).toBe('같이 하기를 취소했어요')
    expect(supportAriaLabel('NT(목덜미 투명대)')).toBe('‘NT(목덜미 투명대)’ 같이 할게요')
    expect(supportCancelAriaLabel('NT(목덜미 투명대)')).toBe('‘NT(목덜미 투명대)’ 같이 하기 취소')
    expect(supportToastAppOn('지은')).toBe('같이 하기로 했어요 · 지은님 화면에도 보여요')
    expect(supportToastLinkOn('국민행복카드', '지은님')).toBe('‘국민행복카드’ 같이 하기로 했어요. 지은님에게 전해져요')
  })

  it('the link toast is built from it: said reads like the app, taking it back is one line for both', () => {
    for (const t of ROADMAP) {
      const short = shortTitle(t.title)
      expect(supportToast(t.title, true, '지은님'), t.id).toBe(supportToastLinkOn(short, '지은님'))
      expect(supportToast(t.title, true, '지은님'), t.id).toContain(SUPPORT_PRESSED)
      expect(supportToast(t.title, false, '지은님'), t.id).toBe(SUPPORT_TOAST_OFF)
      for (const s of [supportToast(t.title, true, '지은님'), supportAriaLabel(short), supportCancelAriaLabel(short)]) {
        expect(s, t.id).not.toMatch(BANNED)
      }
    }
    for (const s of [SUPPORT_LABEL, SUPPORT_PRESSED, SUPPORT_CANCEL, SUPPORT_TOAST_OFF, supportToastAppOn('지은')]) {
      expect(s).not.toMatch(BANNED)
    }
  })

  it('has no imports, so the /link bundle stays small', () => {
    expect(read('lib/content/supportCopy.ts')).not.toMatch(/^\s*import\b|\brequire\(|\bimport\(/m)
  })

  it('every surface takes its words from it — no copy of them left in the components', () => {
    for (const f of ['components/plan/SupportButton.tsx', 'components/link/LinkTogether.tsx', 'components/link/model.ts']) {
      const src = read(f)
      expect(src, f).toContain("from '@/lib/content/supportCopy'")
      // Comments may name the words; code may not spell them out again.
      const code = src
        .split('\n')
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join('\n')
      expect(code, f).not.toMatch(/같이 하기로 했어요|같이 하기를 취소했어요|거뒀어요|같이 챙길게요/)
    }
  })
})
