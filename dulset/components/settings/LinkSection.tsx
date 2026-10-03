'use client'

// 설정 › 연결 (Next A ①): the link she sends so the partner sees his page
// without installing anything — make it, send it (the share sheet, 카카오톡
// is on it; else copy), see when it expires, replace it, stop it — and, in
// plain words, what the link carries and what never leaves this phone
// (lib/logic/partnerSnapshot). Below it, the prototype's own ways to see
// the other person's screen (⇄, two tabs) and the simulated 초대 코드.
//
// The link is made on the cycle owner's phone only: the snapshot is built
// here, through her lenses (lib/useLinkSync). The partner's screen says so.
//
// '민수님 화면 미리보기' (N23): the owner can open the partner's page exactly as
// the link draws it today — a snapshot built on this phone
// (partnerSnapshot.buildPartnerSnapshot, the same lenses) rendered by the
// link's own components (components/link/LinkPreview, inert) — nothing is
// published or sent. The '링크 연 날' research counter (transport.linkOpenDays)
// is deliberately not shown here or anywhere on her screens: it would be a
// read receipt (docs/positioning.md §6 and §7).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Toggle, cx, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { formatKo, isISODate } from '@/lib/dates'
import { buildPartnerSnapshot } from '@/lib/logic/partnerSnapshot'
import { coverOnLink, setCoverOnLink, shareLevelOf } from '@/lib/logic/prefs'
import { linkPartner, unlinkPartner } from '@/lib/logic/settings'
import { stampOn } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import type { MemberId } from '@/lib/types'
import { TRANSPORT_LABEL } from '@/lib/sync/transport'
import {
  LINK_DAYS,
  linkDaysLeft,
  linkStatus,
  revokeLink,
  rotateLink,
  shareLink,
  shareText,
  shareURL,
  useLinkRecord,
  useLinkSyncStatus,
} from '@/lib/useLinkSync'
import { SettingsSection } from './bits'
import { timeKo } from '@/components/link/bits'
import LinkPreview from '@/components/link/LinkPreview'

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

const row = 'flex items-start gap-2 text-xs leading-relaxed text-ink-2'

export default function LinkSection() {
  const { state, update, today, me, partner, cycleOwner, setViewer } = useApp()
  const toast = useToast()
  const link = useLinkRecord()
  const sync = useLinkSyncStatus()
  const now = stampOn(today)
  const status = linkStatus(link, now)
  const isOwner = me.id === cycleOwner.id
  // The link is always for the person who does not track the cycle.
  const other = state.couple.members.find((m) => m.id !== cycleOwner.id) ?? partner
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  const url = link && origin ? shareURL(origin, link.token) : ''
  const [busy, setBusy] = useState(false)
  const [askRevoke, setAskRevoke] = useState(false)

  const make = useCallback(async () => {
    setBusy(true)
    try {
      const had = status === 'active'
      await rotateLink(now)
      toast.show(had ? '새 링크로 바꿨어요. 이전 링크는 더 이상 열리지 않아요' : '링크를 만들었어요')
    } finally {
      setBusy(false)
    }
  }, [status, now, toast])

  const send = useCallback(async () => {
    if (!url) return
    const r = await shareLink(url, shareText(other.name))
    if (r === 'shared') toast.show('보냈어요')
    else if (r === 'copied') toast.show('링크를 복사했어요. 카톡에 붙여 넣어 주세요')
    else toast.show('보내지 못했어요. 링크를 직접 복사해 주세요')
  }, [url, other.name, toast])

  const copy = useCallback(async () => {
    if (!url) return
    toast.show((await copyText(url)) ? '링크를 복사했어요' : '복사하지 못했어요. 링크를 길게 눌러 복사해 주세요')
  }, [url, toast])

  const stop = useCallback(async () => {
    setBusy(true)
    try {
      await revokeLink(now)
      setAskRevoke(false)
      toast.show(`링크를 해제했어요. ${other.name}님 화면에는 더 이상 보이지 않아요`)
    } finally {
      setBusy(false)
    }
  }, [now, other.name, toast])

  const expiresOn = link ? link.expiresAt.slice(0, 10) : ''
  const daysLeft = link ? linkDaysLeft(link, now) : 0
  // The couple's copy (couple.link: the hash, never the token) says a link was
  // made, but this phone has no record for it — a restore on another phone, a
  // cleared browser. Only a new link made here can publish again.
  const stateLink = state.couple.link
  const orphan = isOwner && !link && !!stateLink && !stateLink.revokedAt && linkStatus(stateLink, now) === 'active'
  const sendsCover = coverOnLink(state.settings)
  // 날짜 없음 (N23): the band and its ideas never go on the link.
  const sendsBand = shareLevelOf(state) !== 'none'
  const toggleCover = (on: boolean) => {
    update((s) => setCoverOnLink(s, me.id, on))
    toast.show(on ? `표지 사진을 링크에도 보내요. ${other.name}님 화면에 다음 전송부터 보여요` : '표지 사진은 이제 링크로 가지 않아요')
  }
  // The same words 설정 › 데이터 shows (lib/sync/transport TRANSPORT_LABEL — docs/next-a-setup.md §5 reads them).
  const transportLine =
    sync.kind === 'mock'
      ? `${TRANSPORT_LABEL.mock} · 브라우저 탭 두 개가 두 폰이에요. 이 기기 밖으로 나가지 않아요`
      : `${TRANSPORT_LABEL.supabase} · 링크 화면 한 장만 서버를 거쳐요`

  // ── Prototype: the simulated join (couple.linkedAt) ───────
  const code = state.couple.inviteCode
  const linkedAt = typeof state.couple.linkedAt === 'string' ? state.couple.linkedAt : undefined
  const linkedDate = linkedAt?.slice(0, 10)
  const linked = !!linkedAt
  const join = () => {
    update((s) => linkPartner(s, stampOn(today)))
    toast.show(`${partner.name}님과 연결됐어요`)
  }
  const unjoin = () => {
    update(unlinkPartner)
    toast.show('연결 전 상태로 되돌렸어요')
  }

  return (
    <SettingsSection id="link" title="연결" sub={`${other.name}님이 설치 없이 보는 링크, 그리고 두 탭으로 흉내 내는 두 폰`}>
      <Card aria-label={`${other.name}님에게 보낼 링크`}>
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Icon name="link" className="h-[18px] w-[18px] text-ink-2" />
          {other.name}님에게 보낼 링크
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-2">
          {other.name}님은 앱을 설치하지 않고도 이 링크로 우리의 주간, 이번 달 할 일, 오늘 체크, 신호를 보고 답할 수 있어요.
        </p>

        {!isOwner ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-surface-2 p-3" role="status">
            <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0 text-ink-2" />
            <p className="text-xs leading-relaxed text-ink-2">
              링크는 {cycleOwner.name}님 폰에서 만들어요. 화면이 {cycleOwner.name}님의 기록을 거쳐 만들어지기 때문이에요. 위쪽 ⇄로{' '}
              {cycleOwner.name}님 화면으로 가면 여기서 만들 수 있어요.
            </p>
          </div>
        ) : (
          <>
            <div
              className={cx('mt-3 flex items-start gap-2.5 rounded-xl p-3', status === 'active' ? 'bg-ok-soft' : 'bg-surface-2')}
              role="status"
              data-link-status={status}
            >
              <Icon name={status === 'active' ? 'link' : 'clock'} className="mt-0.5 h-5 w-5 shrink-0 text-ink-2" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {status === 'active'
                    ? `링크가 열려 있어요 · ${isISODate(expiresOn) ? formatKo(expiresOn, { weekday: false }) : ''}까지 (D-${daysLeft})`
                    : status === 'expired'
                      ? '링크가 만료됐어요'
                      : status === 'revoked'
                        ? '링크를 해제했어요'
                        : orphan
                          ? '이 폰에는 링크 토큰이 없어요'
                          : '아직 링크가 없어요'}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-2">
                  {status === 'active'
                    ? sync.publishedAt
                      ? `마지막 전송 ${timeKo(sync.publishedAt)}${sync.pulledAt ? ` · 마지막 확인 ${timeKo(sync.pulledAt)}` : ''}`
                      : '첫 화면을 준비하고 있어요'
                    : orphan
                      ? `전에 만든 링크가 있지만(${isISODate(stateLink.expiresAt.slice(0, 10)) ? formatKo(stateLink.expiresAt.slice(0, 10), { weekday: false }) : ''}까지) 이 폰에서는 쓸 수 없어요. 새 링크를 만들어 ${other.name}님에게 다시 보내 주세요.`
                      : `링크는 ${LINK_DAYS}일 동안 열리고, 언제든 바꾸거나 해제할 수 있어요.`}
                </p>
                {sync.error ? <p className="mt-0.5 text-xs text-warn">{sync.error}</p> : null}
              </div>
            </div>

            {status === 'active' && url ? (
              <>
                <p
                  className="mt-3 break-all rounded-xl border border-line bg-surface px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink-2"
                  data-link-url
                >
                  {url}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button full onClick={send} className="flex-1">
                    카톡으로 보내기
                  </Button>
                  <Button variant="secondary" onClick={copy} ariaLabel="링크 복사">
                    복사
                  </Button>
                </div>
                {askRevoke ? (
                  <div className="mt-2 rounded-xl bg-surface-2 p-3">
                    <p className="text-sm font-semibold text-ink">링크를 해제할까요?</p>
                    <p className="mt-0.5 text-xs text-ink-2">
                      {other.name}님 화면에는 ‘링크가 만료됐어요’가 보여요. 새 링크는 언제든 다시 만들 수 있어요.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button variant="danger" className="flex-1" onClick={stop} disabled={busy}>
                        해제하기
                      </Button>
                      <Button variant="secondary" className="flex-1" onClick={() => setAskRevoke(false)}>
                        그대로 두기
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <Button variant="ghost" size="sm" className="min-h-[44px] flex-1" onClick={make} disabled={busy}>
                      새 링크로 바꾸기
                    </Button>
                    <Button variant="ghost" size="sm" className="min-h-[44px] flex-1" onClick={() => setAskRevoke(true)} disabled={busy}>
                      링크 해제
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <Button full className="mt-3" onClick={make} disabled={busy}>
                {status === 'none' ? '링크 만들기' : '새 링크 만들기'}
              </Button>
            )}
          </>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-ink-3">{transportLine}</p>

        <div className="mt-3 rounded-xl border border-dashed border-line p-3">
          <p className="text-xs font-semibold text-ink">링크로 보내지는 것</p>
          <ul className="mt-1.5 space-y-1">
            {[
              '두 사람의 이름과 이모지, 함께한 지 D+N',
              `지금 상황 카드의 문장 — ${other.name}님 화면에 보이는 그대로`,
              ...(sendsBand ? ['우리의 주간 띠(이번 주·다음 주)와 데이트 아이디어 2개'] : []),
              `${other.name}님의 이번 달 할 일과 오늘 체크`,
              `이번 주 우리 둘 — ${other.name}님이 고를 것 셋, 내 준비 한 줄, 내가 보낸 고마워요`,
              `답할 신호와 답장 선택지, 콕·응원`,
              `${cycleOwner.name}님의 오늘 체크 개수(항목 이름은 빼고)`,
              `표지 사진 — ${sendsCover ? '보내요' : `안 보내요 (${isOwner ? '아래에서 켤 수 있어요' : `${cycleOwner.name}님이 정해요`})`}`,
            ].map((t) => (
              <li key={t} className={row}>
                <Icon name="check" className="mt-[3px] h-3.5 w-3.5 shrink-0 text-ok" strokeWidth={2.6} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          {isOwner ? (
            <div className="mt-2 border-t border-line/70">
              <Toggle
                checked={sendsCover}
                onChange={toggleCover}
                label="링크에 표지 사진"
                description={`켜면 ${other.name}님 화면에도 우리 표지 사진이 보여요. 꺼 두면 그림만 보여요.`}
              />
            </div>
          ) : null}
          <p className="mt-3 text-xs font-semibold text-ink">절대 가지 않는 것</p>
          <ul className="mt-1.5 space-y-1">
            {[
              '생리·배란테스트기·임신테스트 기록과 주기 날짜',
              ...(sendsBand ? [] : ['우리의 주간 띠와 날짜 (공유 범위: 날짜 없음)']),
              '컨디션, 나만 보기 메모, 관계일',
              '병원 메모와 시술 기록, 일기와 사진(표지 빼고)',
              '앱의 기록 전체 — 링크는 화면 한 장이지 백업이 아니에요',
            ].map((t) => (
              <li key={t} className={row}>
                <Icon name="ban" className="mt-[3px] h-3.5 w-3.5 shrink-0 text-ink-3" strokeWidth={2.2} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
            이 링크는 {other.name}님에게만 보내요. 링크가 있는 사람은 만료 전까지 이 화면을 볼 수 있어요.
          </p>
        </div>
      </Card>

      {isOwner ? <PartnerPreview name={other.name} id={other.id} /> : null}

      <Card className="mt-3" aria-label="프로토타입에서 두 폰 흉내 내기">
        <p className="text-xs font-semibold text-ink">프로토타입에서는 이렇게 연결돼요</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-ink-2">
          <li>
            위쪽 ⇄ 버튼을 누르면 한 기기에서 {me.name}님과 {partner.name}님 화면을 바꿔 볼 수 있어요.
          </li>
          <li>
            브라우저 탭을 두 개 열면 두 사람의 휴대폰처럼 쓸 수 있어요. 위 링크를 다른 탭에서 열면 {other.name}님의 설치 없는 화면이에요.
          </li>
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

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line/70 pt-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-3">초대 코드 (시뮬레이션)</p>
            <p className="mt-0.5 font-mono text-lg font-bold tracking-[0.2em] text-ink">{code}</p>
            <p className="mt-0.5 text-[11px] text-ink-3">
              {linked
                ? `${linkedDate && isISODate(linkedDate) ? `${formatKo(linkedDate)}부터 ` : ''}${partner.name}님과 연결됐어요`
                : '아직 연결 전이에요'}
            </p>
          </div>
          {linked ? (
            <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={unjoin}>
              되돌리기
            </Button>
          ) : (
            <Button variant="secondary" onClick={join}>
              연결
            </Button>
          )}
        </div>
      </Card>
    </SettingsSection>
  )
}

/**
 * '민수님 화면 미리보기' (N23): his page for today, built on this phone through
 * the same lenses as the link (buildPartnerSnapshot) and drawn by the link's
 * own components, read-only. Built only while open; nothing is published,
 * stored or sent — with or without a link.
 */
function PartnerPreview({ name, id }: { name: string; id: MemberId }) {
  const { state, today } = useApp()
  const [open, setOpen] = useState(false)
  const snapshot = useMemo(() => (open ? buildPartnerSnapshot(state, today, id) : null), [open, state, today, id])
  return (
    <Card className="mt-3" aria-label={`${name}님 화면 미리보기`}>
      <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
        <Icon name="phone" className="h-[18px] w-[18px] text-ink-2" />
        {name}님 화면 미리보기
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-2">
        오늘 {name}님 링크에 보이는 화면 그대로예요. 이 폰에서만 그려 보고, 아무것도 보내지 않아요.
      </p>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-4 text-sm font-semibold text-ink transition-colors hover:bg-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {open ? '미리보기 닫기' : '미리보기 열기'}
        <Icon name="chev" className={cx('h-4 w-4 transition-transform', open && 'rotate-180')} strokeWidth={2.2} />
      </button>
      {open ? (
        snapshot ? (
          <div
            data-partner-preview
            className="mt-3 max-h-[70vh] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-bg px-3 pb-3 pt-3"
          >
            <LinkPreview snapshot={snapshot} today={today} />
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">지금은 미리 볼 화면이 없어요.</p>
        )
      ) : null}
    </Card>
  )
}
