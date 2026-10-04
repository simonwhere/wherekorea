'use client'

// ④ 초대·설치: the partner link (Next A ①) — one tap makes the link and hands
// it to the share sheet (카카오톡 is on it; without a sheet it is copied), how
// the prototype shows the partner's screen meanwhile (⇄), and a one-picture
// "홈 화면에 추가" with this phone's own steps — Safari drops a tab's storage
// after 7 days without a visit, a home-screen app keeps it (lib/persist
// INSTALL_STEPS). The link's page fills in after 시작하기, when this phone
// publishes its first snapshot (lib/useLinkSync).

import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/icons'
import { localNowISO } from '@/lib/logic/notifications'
import { stampOn } from '@/lib/logic/today'
import { INSTALL_STEPS, currentInstallPlatform, isStandalone, type InstallPlatform } from '@/lib/persist'
import { useStore } from '@/lib/store'
import { LINK_DAYS, linkStatus, readLink, rotateLink, shareLink, shareText, shareURL, type LinkRecord } from '@/lib/useLinkSync'

/** A phone whose share sheet adds 둘셋 to the home screen (decorative; the steps are text). */
function InstallArt() {
  return (
    <svg viewBox="0 0 220 120" width="220" height="120" aria-hidden="true" focusable="false" className="mx-auto block max-w-full">
      {/* phone */}
      <rect x="18" y="8" width="64" height="104" rx="12" fill="rgb(var(--surface))" stroke="rgb(var(--line))" strokeWidth="2" />
      <rect x="40" y="14" width="20" height="4" rx="2" fill="rgb(var(--line))" />
      {/* app grid */}
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}${c}`} x={28 + c * 16} y={28 + r * 16} width="11" height="11" rx="3" fill="rgb(var(--surface-2))" />
        )),
      )}
      {/* the new 둘셋 tile: two circles and the glow dot, like the app icon */}
      <rect x="28" y="76" width="11" height="11" rx="3" fill="rgb(var(--brand-soft))" />
      <circle cx="32" cy="82.5" r="3" fill="rgb(var(--him))" opacity=".85" />
      <circle cx="35.5" cy="82.5" r="3" fill="rgb(var(--her))" opacity=".8" />
      <circle cx="38" cy="78.5" r="1.4" fill="rgb(var(--glow))" />
      {/* share sheet */}
      <rect x="112" y="40" width="90" height="56" rx="10" fill="rgb(var(--surface))" stroke="rgb(var(--line))" strokeWidth="2" />
      <rect x="122" y="50" width="52" height="5" rx="2.5" fill="rgb(var(--line))" />
      <rect x="122" y="62" width="70" height="7" rx="3.5" fill="rgb(var(--brand-soft))" />
      <rect x="126" y="64" width="3" height="3" rx="1" fill="rgb(var(--brand))" />
      <rect x="126" y="64" width="3" height="3" rx="1" fill="rgb(var(--brand))" />
      <text x="134" y="68.4" fontSize="6.2" fontWeight="700" fill="rgb(var(--brand-ink))" fontFamily="system-ui, sans-serif">
        홈 화면에 추가
      </text>
      <rect x="122" y="76" width="44" height="5" rx="2.5" fill="rgb(var(--line))" />
      {/* share icon: box with an arrow up */}
      <g stroke="rgb(var(--brand))" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M98 70 v8 a3 3 0 0 0 3 3 h0" />
        <path d="M92 60 l6 -6 l6 6" />
        <path d="M98 54 v18" />
        <path d="M89 66 h-1 a3 3 0 0 0 -3 3 v9 a3 3 0 0 0 3 3 h20 a3 3 0 0 0 3 -3 v-9 a3 3 0 0 0 -3 -3 h-1" />
      </g>
      {/* arrow phone → sheet */}
      <path d="M84 60 h14" stroke="rgb(var(--ink-3))" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
    </svg>
  )
}

export default function DoneStep({
  code,
  partner,
  ownerIsMe = true,
  onSent,
}: {
  code: string
  partner: string
  /** The person onboarding tracks the cycle: this phone publishes the link's page. Else the link is made on the partner's phone. */
  ownerIsMe?: boolean
  /** The link went out (shared or copied) — the home then asks about a cover photo once (N27). */
  onSent?: () => void
}) {
  const { today } = useStore()
  // Browser-only facts (display mode, user agent, the link kept on this phone) are read after mount.
  const [platform, setPlatform] = useState<InstallPlatform | null>(null)
  const [installed, setInstalled] = useState(false)
  const [link, setLink] = useState<LinkRecord | null>(null)
  const [origin, setOrigin] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => {
    setPlatform(currentInstallPlatform())
    setInstalled(isStandalone())
    setOrigin(window.location.origin)
    const kept = readLink()
    if (kept && linkStatus(kept, localNowISO()) === 'active') setLink(kept)
  }, [])

  const url = link && origin ? shareURL(origin, link.token) : ''

  const sendLink = async () => {
    if (busy) return
    setBusy(true)
    try {
      // One link for this flow: a second tap shares the same address.
      const l = link ?? (await rotateLink(stampOn(today)))
      setLink(l)
      const r = await shareLink(shareURL(origin || window.location.origin, l.token), shareText(partner))
      if (r === 'shared' || r === 'copied') onSent?.()
      setNote(
        r === 'shared'
          ? `보냈어요. ${partner}님 화면은 아래 시작하기를 누르면 준비돼요.`
          : r === 'copied'
            ? `링크를 복사했어요. 카톡에 붙여 넣어 주세요. ${partner}님 화면은 아래 시작하기를 누르면 준비돼요.`
            : '보내지 못했어요. 아래 링크를 길게 눌러 복사해 주세요.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <section aria-label={`${partner}님 초대`} className="rounded-xl2 border border-brand/20 bg-brand-soft p-4 shadow-card">
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Icon name="mail" className="h-[18px] w-[18px] text-ink-2" />
          {ownerIsMe ? `${partner}님 초대하기` : `${partner}님과 함께 쓰기`}
        </p>
        {ownerIsMe ? (
          <>
            <p className="mt-1 text-xs leading-relaxed text-ink-2">
              {partner}님은 앱을 설치하지 않아도 돼요. 링크 하나로 우리의 주간, 이번 달 할 일, 오늘 체크, 신호를 보고 답할 수 있어요. 기록은
              이 폰에만 있고, 링크로는 화면 한 장만 가요.
            </p>
            <button
              type="button"
              onClick={sendLink}
              disabled={busy}
              className="mt-3 inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-brand text-sm font-semibold text-white transition-colors hover:bg-brand/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
            >
              <Icon name="link" className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {link ? '카톡으로 다시 보내기' : '카톡으로 링크 보내기'}
            </button>
            {note ? (
              <p role="status" className="mt-2 text-xs leading-relaxed text-ink">
                {note}
              </p>
            ) : null}
            {url ? (
              <p
                className="mt-2 break-all rounded-xl border border-line bg-surface px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-2"
                data-link-url
              >
                {url}
              </p>
            ) : null}
            <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
              링크는 {LINK_DAYS}일 동안 열리고 설정 › 연결에서 언제든 바꾸거나 해제할 수 있어요 · 초대 코드{' '}
              <span className="font-mono font-bold tracking-widest text-ink-2">{code}</span> · 지금은 위쪽 ⇄ 버튼으로도 {partner}님 화면을
              볼 수 있어요.
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-xs leading-relaxed text-ink-2">
              주기는 {partner}님이 기록하니, 설치 없이 보는 링크는 {partner}님이 앱을 쓰는 폰에서 만들어요(설정 › 연결). 링크로는 화면 한
              장만 가고, 기록은 기록한 폰에만 있어요.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
              초대 코드 <span className="font-mono font-bold tracking-widest text-ink-2">{code}</span> · 지금은 위쪽 ⇄ 버튼으로 {partner}님
              화면을 볼 수 있어요.
            </p>
          </>
        )}
      </section>

      <section aria-label="홈 화면에 추가" className="rounded-xl2 border border-line bg-surface p-4 shadow-card">
        <InstallArt />
        <p className="mt-2 text-sm font-bold text-ink">{installed ? '홈 화면에서 열었어요' : '홈 화면에 추가해 두세요'}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-2">
          {installed
            ? '이렇게 열면 사파리의 7일 삭제를 피할 수 있어요. 알림은 앱이 열려 있을 때만 와요.'
            : '홈 화면에 추가하면 사파리의 7일 삭제를 피할 수 있어요. 알림은 앱이 열려 있을 때만 와요.'}
        </p>
        {!installed && platform ? <p className="mt-1.5 text-xs leading-relaxed text-ink-3">{INSTALL_STEPS[platform]}</p> : null}
        <p className="mt-2 text-[11px] leading-relaxed text-ink-3">기록은 이 폰에만 있어요. 설정에서 언제든 백업 파일을 받을 수 있어요.</p>
      </section>
    </div>
  )
}
