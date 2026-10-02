// (e) The four-screen onboarding, happy path: 우리 둘 → 주기 → 동의 + 공유 → 초대,
// ending in a saved, onboarded state on the first person's "phone".

import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Onboarding from '@/components/Onboarding'
import { addDays } from '@/lib/dates'
import { VIEWER_KEY } from '@/lib/storage'
import type { ISODate } from '@/lib/types'
import { renderApp, stateProbe } from '../setup'

const T0: ISODate = '2026-10-02'

const pressed = (el: HTMLElement) => el.getAttribute('aria-pressed') === 'true'
const next = () => fireEvent.click(screen.getByRole('button', { name: '다음' }))

describe('Onboarding · four screens', () => {
  it('지은 sets up the couple, her cycle and the consents, then starts', () => {
    const probe = stateProbe()
    renderApp(
      <>
        <Onboarding />
        <probe.Probe />
      </>,
      { state: null, viewer: 'a', today: T0 },
    )
    expect(probe.current.hydrated).toBe(true)
    expect(probe.current.state).toBeNull()

    // Welcome → ①
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))
    expect(screen.getByRole('heading', { level: 1, name: '우리 둘을 소개해 주세요' })).toBeTruthy()
    expect(screen.getByText('4단계 중 1단계')).toBeTruthy()
    const nextButton = screen.getByRole('button', { name: '다음' }) as HTMLButtonElement
    expect(nextButton.disabled).toBe(true)

    const me = screen.getByRole('group', { name: '나' })
    fireEvent.change(within(me).getByLabelText(/이름 또는 애칭/), { target: { value: '지은' } })
    fireEvent.click(within(me).getByRole('button', { name: '아내' }))
    const other = screen.getByRole('group', { name: '함께하는 사람' })
    fireEvent.change(within(other).getByLabelText(/이름 또는 애칭/), { target: { value: '민수' } })
    // The partner's role follows mine (아내 → 남편), and so does who records the cycle (나).
    expect(pressed(within(other).getByRole('button', { name: '남편' }))).toBe(true)
    const owner = screen.getByRole('group', { name: '주기를 기록할 사람' })
    expect(pressed(within(owner).getByRole('button', { name: '지은 (나)' }))).toBe(true)
    expect(nextButton.disabled).toBe(false)
    next()

    // ② 주기: last start one week ago, LH strips in use
    expect(screen.getByRole('heading', { level: 1, name: '주기를 알려 주세요' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^1주 전/ }))
    const dateInput = screen.getByLabelText('마지막 생리 시작일') as HTMLInputElement
    expect(dateInput.value).toBe(addDays(T0, -7))
    fireEvent.click(within(screen.getByRole('group', { name: '배란테스트기 사용' })).getByRole('button', { name: '써요' }))
    next()

    // ③ 동의 + 공유: the default keeps the details private; both consents are required
    expect(screen.getByRole('heading', { level: 1, name: '기록은 이렇게 지켜요' })).toBeTruthy()
    const share = screen.getByRole('radio', { name: /우리의 주간만/ }) as HTMLInputElement
    expect(share.checked).toBe(true)
    const consent = screen.getByRole('button', { name: '동의하고 계속하기' }) as HTMLButtonElement
    expect(consent.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /개인정보 수집·이용에 동의해요/ }))
    expect(consent.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /민감정보/ }))
    expect(consent.disabled).toBe(false)
    fireEvent.click(consent)

    // ④ 초대 · 설치 → 시작하기
    expect(screen.getByRole('heading', { level: 1, name: /준비됐어요/ })).toBeTruthy()
    expect(screen.getByText(/민수님 초대하기/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))

    const s = probe.current.state
    expect(s).not.toBeNull()
    expect(s!.onboarded).toBe(true)
    expect(s!.stage).toBe('preparing')
    expect(s!.couple.members.map((m) => [m.name, m.role, m.tracksCycle])).toEqual([
      ['지은', 'wife', true],
      ['민수', 'husband', false],
    ])
    expect(s!.periods.map((p) => p.start)).toEqual([addDays(T0, -7)])
    expect(s!.settings.usesLH).toBe(true)
    expect(s!.settings.shareCycleDetails).toBe(false)
    // The default voices: explicit for the owner, soft for the partner.
    expect(s!.settings.alertStyle).toEqual({ a: 'explicit', b: 'soft' })
    // This phone is 지은's, and the state is saved for the next open.
    expect(window.sessionStorage.getItem(VIEWER_KEY)).toBe('a')
    expect(window.localStorage.getItem('dulset:state:v1')).toContain('"onboarded":true')
  })
})
