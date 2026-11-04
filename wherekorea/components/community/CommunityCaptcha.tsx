'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'

type Turnstile = {
  render: (target: HTMLElement, options: Record<string, unknown>) => string
  remove: (id: string) => void
}
declare global { interface Window { turnstile?: Turnstile } }

/** Token is handed to Supabase Auth for verification, never logged or persisted. */
export default function CommunityCaptcha({ onToken, resetKey }: { onToken: (token: string) => void; resetKey: number }) {
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const target = useRef<HTMLDivElement>(null)
  const callback = useRef(onToken)
  callback.current = onToken
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!ready || !sitekey || !target.current || !window.turnstile) return
    callback.current('')
    setFailed(false)
    const widget = window.turnstile.render(target.current, {
      // Fits nested preview forms on narrow phones without horizontal scrolling.
      sitekey, theme: 'dark', size: 'compact',
      callback: (token: string) => callback.current(token),
      'expired-callback': () => callback.current(''),
      'error-callback': () => { callback.current(''); setFailed(true) },
    })
    return () => { window.turnstile?.remove(widget) }
  }, [ready, sitekey, resetKey])
  if (!sitekey) return null
  return <div>
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setReady(true)} onError={() => setFailed(true)} />
    <div ref={target} />
    {failed && <p role="alert">The security check could not load. Reload this page to try again.</p>}
  </div>
}
