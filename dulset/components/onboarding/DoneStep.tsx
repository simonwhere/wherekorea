'use client'

// ④ 초대·설치: the partner link that is still to come (카톡으로 링크 보내기 —
// 준비 중, so the button says so instead of pretending), how the prototype
// shows the partner's screen meanwhile (⇄), and a one-picture "홈 화면에 추가"
// with this phone's own steps — Safari drops a tab's storage after 7 days
// without a visit, a home-screen app keeps it (lib/persist INSTALL_STEPS).

import { useEffect, useState } from 'react'
import { INSTALL_STEPS, currentInstallPlatform, isStandalone, type InstallPlatform } from '@/lib/persist'

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

export default function DoneStep({ code, partner }: { code: string; partner: string }) {
  // Browser-only facts (display mode, user agent) are read after mount.
  const [platform, setPlatform] = useState<InstallPlatform | null>(null)
  const [installed, setInstalled] = useState(false)
  useEffect(() => {
    setPlatform(currentInstallPlatform())
    setInstalled(isStandalone())
  }, [])

  return (
    <div className="space-y-4">
      <section aria-label={`${partner}님 초대`} className="rounded-xl2 border border-brand/20 bg-brand-soft p-4 shadow-card">
        <p className="text-sm font-bold text-ink">
          <span aria-hidden>💌 </span>
          {partner}님 초대하기
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-2">
          실제 연결은 준비 중이에요. 두 폰을 잇는 링크가 생기면 여기서 바로 보낼 수 있어요.
        </p>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="mt-3 inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-surface text-sm font-semibold text-ink-3 ring-1 ring-line disabled:cursor-not-allowed"
        >
          카톡으로 링크 보내기 <span className="text-xs font-medium">(준비 중)</span>
        </button>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
          초대 코드 <span className="font-mono font-bold tracking-widest text-ink-2">{code}</span> · 지금은 위쪽 ⇄ 버튼으로 {partner}님
          화면을 볼 수 있어요. 탭을 두 개 열면 두 폰처럼 움직여요.
        </p>
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
