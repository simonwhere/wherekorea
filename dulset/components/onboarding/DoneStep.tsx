'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'

type CopyState = 'idle' | 'ok' | 'fail'

/**
 * Clipboard API first; the textarea fallback covers insecure origins (e.g. the
 * prototype opened on a phone over http://192.168.x.x), where it's undefined.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
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

export default function DoneStep({ code, partner }: { code: string; partner: string }) {
  const [copied, setCopied] = useState<CopyState>('idle')

  const copy = async () => {
    setCopied((await copyText(code)) ? 'ok' : 'fail')
  }

  return (
    <div className="space-y-4">
      <section
        aria-label="초대 코드"
        className="rounded-xl2 border border-brand/20 bg-brand-soft p-5 text-center shadow-card"
      >
        <p className="text-xs font-semibold text-brand-ink">초대 코드</p>
        <p aria-hidden className="mt-2 select-all font-mono text-4xl font-extrabold tracking-[0.25em] text-ink">
          {code}
        </p>
        <p className="sr-only">{code.split('').join(' ')}</p>
        <Button variant="secondary" className="mt-4" onClick={copy} ariaLabel="초대 코드 복사">
          <span aria-hidden>📋</span> 복사
        </Button>
        <p aria-live="polite" className="mt-2 min-h-[1rem] text-xs text-ink-2">
          {copied === 'ok' ? '복사했어요' : copied === 'fail' ? '복사하지 못했어요. 코드를 길게 눌러 복사해 주세요.' : ''}
        </p>
      </section>

      <ul className="space-y-2.5 text-sm leading-relaxed text-ink-2">
        <li className="flex gap-2.5 rounded-xl2 border border-line bg-surface p-3.5">
          <span aria-hidden>💌</span>
          <span>
            실제 앱에서는 이 코드를 <b className="text-ink">{partner}님</b>에게 보내면 두 폰이 연결돼요.
          </span>
        </li>
        <li className="flex gap-2.5 rounded-xl2 border border-line bg-surface p-3.5">
          <span aria-hidden>⇄</span>
          <span>지금은 프로토타입이라, 위쪽 이름 버튼(⇄)으로 {partner}님 화면을 볼 수 있어요.</span>
        </li>
        <li className="flex gap-2.5 rounded-xl2 border border-line bg-surface p-3.5">
          <span aria-hidden>🗂️</span>
          <span>
            브라우저 탭 두 개를 열면 두 사람 폰처럼 동기화돼요. 한쪽 탭에서 ⇄를 눌러 {partner}님 화면으로 바꿔 두세요.
          </span>
        </li>
      </ul>
    </div>
  )
}
