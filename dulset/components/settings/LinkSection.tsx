'use client'

import { Button, Card, cx, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { formatKo, isISODate } from '@/lib/dates'
import { linkPartner, unlinkPartner } from '@/lib/logic/settings'
import { stampOn } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import { SettingsSection } from './bits'

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    el.remove()
    return ok
  } catch {
    return false
  }
}

export default function LinkSection() {
  const { state, update, today, me, partner, setViewer } = useApp()
  const toast = useToast()
  const code = state.couple.inviteCode
  const linkedAt = typeof state.couple.linkedAt === 'string' ? state.couple.linkedAt : undefined
  const linkedDate = linkedAt?.slice(0, 10)
  const linked = !!linkedAt

  const copy = async () => {
    const ok = await copyText(code)
    toast.show(ok ? '초대 코드를 복사했어요' : '복사하지 못했어요. 코드를 직접 알려 주세요')
  }

  const link = () => {
    // stampOn keeps the date on the app's `today` (?today= demos), like the 오늘 tab.
    update((s) => linkPartner(s, stampOn(today)))
    toast.show(`${partner.name}님과 연결됐어요`)
  }

  const unlink = () => {
    update(unlinkPartner)
    toast.show('연결 전 상태로 되돌렸어요')
  }

  return (
    <SettingsSection id="link" title="연결" sub="두 사람이 같은 공간을 함께 써요">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-3">초대 코드</p>
            <p className="mt-0.5 font-mono text-2xl font-bold tracking-[0.2em] text-ink">
              {code}
            </p>
          </div>
          <Button variant="secondary" onClick={copy} ariaLabel="초대 코드 복사">
            복사
          </Button>
        </div>

        <div
          className={cx('mt-3 flex items-start gap-2.5 rounded-xl p-3', linked ? 'bg-ok-soft' : 'bg-surface-2')}
          role="status"
        >
          <Icon name={linked ? 'link' : 'clock'} className="mt-0.5 h-5 w-5 text-ink-2" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {linked ? `${partner.name}님과 연결됐어요` : '아직 연결 전이에요'}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-2">
              {linked
                ? `${linkedDate && isISODate(linkedDate) ? `${formatKo(linkedDate)}부터 ` : ''}체크, 일정, 알림을 함께 받아요.`
                : `${partner.name}님이 둘셋에서 초대 코드를 입력하면 연결돼요.`}
            </p>
          </div>
        </div>

        {linked ? (
          <Button full variant="ghost" size="sm" className="mt-2 min-h-[44px]" onClick={unlink}>
            연결 전 상태로 되돌리기 (시뮬레이션)
          </Button>
        ) : (
          <Button full className="mt-3" onClick={link}>
            {partner.name}님 연결 (시뮬레이션)
          </Button>
        )}

        <div className="mt-3 rounded-xl border border-dashed border-line p-3">
          <p className="text-xs font-semibold text-ink">프로토타입에서는 이렇게 연결돼요</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-ink-2">
            <li>
              위쪽 ⇄ 버튼을 누르면 한 기기에서 {me.name}님과 {partner.name}님 화면을 바꿔 볼 수 있어요.
            </li>
            <li>브라우저 탭을 두 개 열면 두 사람의 휴대폰처럼 쓸 수 있어요. 한쪽 탭에서 ⇄로 사람을 바꿔 두면, 한쪽의 변경이 다른 탭에 바로 반영돼요.</li>
            <li>실제 앱에서는 서버(예: Supabase) + 푸시 알림으로 연결돼요.</li>
          </ul>
          <Button
            full
            variant="secondary"
            className="mt-3"
            onClick={() => {
              setViewer(partner.id)
              toast.show(`지금부터 ${partner.name}님 화면이에요`)
            }}
          >
            <span aria-hidden>⇄</span> {partner.name}님 화면으로 보기
          </Button>
        </div>
      </Card>
    </SettingsSection>
  )
}
