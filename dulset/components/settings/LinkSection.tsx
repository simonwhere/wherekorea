'use client'

// 설정 › 연결 (Next A ①): the link she sends so the partner sees his page
// without installing anything — make it, send it (the share sheet, 카카오톡
// is on it; else copy), see when it expires (it renews itself while 둘셋 is
// in use on this phone and stops after LINK_DAYS unopened — lib/useLinkSync
// renewLinkOnTransport; his opens never move it), replace it, stop it, and
// whether the cover photo rides along (the one choice that changes what he
// sees). Below it, the prototype's ⇄ switch and the simulated 초대 코드.
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
import { coverOnLink, setCoverOnLink } from '@/lib/logic/prefs'
import { linkPartner, unlinkPartner } from '@/lib/logic/settings'
import { stampOn } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import type { MemberId } from '@/lib/types'
import {
  LINK_DAYS,
  linkDaysLeft,
  linkShownStatus,
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
import { askCoverAfterLink } from '@/components/onboarding/coverAskAfterLink'

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
  const { state, update, today, me, partner, cycleOwner, setViewer } = useApp()
  const toast = useToast()
  const link = useLinkRecord()
  const sync = useLinkSyncStatus()
  const now = stampOn(today)
  const status = linkStatus(link, now)
  // What the box says: a link her phone revoked because it had expired still reads as stopped (not as 해제).
  const shown = linkShownStatus(link, now)
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
      toast.show(had ? '새 링크로 바꿨어요. 이전 링크는 이제 열리지 않아요' : '링크를 만들었어요')
    } finally {
      setBusy(false)
    }
  }, [status, now, toast])

  const hasCover = !!state.couple.cover
  const send = useCallback(async () => {
    if (!url) return
    const r = await shareLink(url, shareText(other.name))
    // After the link went out, 오늘 asks once about a cover photo (N27 — never before the link).
    if (r === 'shared' || r === 'copied') askCoverAfterLink(hasCover)
    if (r === 'shared') toast.show('보냈어요')
    else if (r === 'copied') toast.show('링크를 복사했어요. 카톡에 붙여 넣어 주세요')
    else toast.show('보내지 못했어요. 링크를 직접 복사해 주세요')
  }, [url, other.name, toast, hasCover])

  const copy = useCallback(async () => {
    if (!url) return
    const ok = await copyText(url)
    if (ok) askCoverAfterLink(hasCover)
    toast.show(ok ? '링크를 복사했어요' : '복사하지 못했어요. 링크를 길게 눌러 복사해 주세요')
  }, [url, toast, hasCover])

  const stop = useCallback(async () => {
    setBusy(true)
    try {
      await revokeLink(now)
      setAskRevoke(false)
      toast.show('링크를 해제했어요')
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
  const toggleCover = (on: boolean) => {
    update((s) => setCoverOnLink(s, me.id, on))
    toast.show(on ? '표지 사진을 링크에도 보내요' : '표지 사진을 링크로 보내지 않아요')
  }

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
    <SettingsSection id="link" title="연결">
      <Card aria-label={isOwner ? `${other.name}님에게 보낼 링크` : '링크'}>
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Icon name="link" className="h-[18px] w-[18px] text-ink-2" />
          {isOwner ? `${other.name}님에게 보낼 링크` : '링크'}
        </p>

        {!isOwner ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-surface-2 p-3" role="status">
            <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0 text-ink-2" />
            <p className="text-xs leading-relaxed text-ink-2">링크는 {cycleOwner.name}님 폰에서 만들어요.</p>
          </div>
        ) : (
          <>
            <div
              className={cx('mt-3 flex items-start gap-2.5 rounded-xl p-3', shown === 'active' ? 'bg-ok-soft' : 'bg-surface-2')}
              role="status"
              data-link-status={shown}
            >
              <Icon name={shown === 'active' ? 'link' : 'clock'} className="mt-0.5 h-5 w-5 shrink-0 text-ink-2" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {shown === 'active' ? (
                    <>
                      링크가 열려 있어요 · {isISODate(expiresOn) ? formatKo(expiresOn, { weekday: false }) : ''}까지{' '}
                      <span className="whitespace-nowrap">(D-{daysLeft})</span>
                    </>
                  ) : shown === 'expired' ? (
                    // The same word as his screen (components/link/model.ts noticeCopy).
                    '링크가 만료됐어요'
                  ) : shown === 'revoked' ? (
                    '링크를 해제했어요'
                  ) : orphan ? (
                    '전에 만든 링크는 이 폰에서 쓸 수 없어요'
                  ) : (
                    '아직 링크가 없어요'
                  )}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-2 empty:hidden">
                  {shown === 'active'
                    ? sync.publishedAt
                      ? `마지막 전송 ${timeKo(sync.publishedAt)}`
                      : '첫 화면을 준비하고 있어요'
                    : shown === 'revoked'
                      ? null
                      : orphan || shown === 'expired'
                        ? `새 링크를 만들어 ${other.name}님에게 다시 보내 주세요.`
                        : `${LINK_DAYS}일 동안 둘셋을 안 열면 링크가 만료돼요.`}
                </p>
                {shown === 'active' ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-2" data-link-renew>
                    {LINK_DAYS}일 동안 둘셋을 안 열면 링크가 만료돼요.
                  </p>
                ) : null}
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
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">링크가 있는 사람은 누구나 이 화면을 볼 수 있어요.</p>
                {askRevoke ? (
                  <div className="mt-2 rounded-xl bg-surface-2 p-3">
                    <p className="text-sm font-semibold text-ink">링크를 해제할까요?</p>
                    <p className="mt-0.5 text-xs text-ink-2">{other.name}님 화면에는 ‘링크가 만료됐어요’가 보여요.</p>
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

        {isOwner ? (
          <div className="mt-3 border-t border-line/70">
            <Toggle
              checked={sendsCover}
              onChange={toggleCover}
              label="링크에 표지 사진 보내기"
              description={`켜면 ${other.name}님 화면에도 우리 표지 사진이 보여요.`}
            />
          </div>
        ) : null}
      </Card>

      {isOwner ? <PartnerPreview name={other.name} id={other.id} /> : null}

      <Card className="mt-3" aria-label="화면 바꿔 보기">
        <Button
          full
          variant="secondary"
          onClick={() => {
            setViewer(partner.id)
            toast.show(`지금부터 ${partner.name}님 화면이에요`)
          }}
        >
          <span aria-hidden>⇄</span> {partner.name}님 화면으로 보기
        </Button>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line/70 pt-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-3">초대 코드</p>
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
