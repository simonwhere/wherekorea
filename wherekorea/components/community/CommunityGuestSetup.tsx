'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { communityHref } from '@/lib/community'
import { communityRequest, useCommunitySession } from './CommunitySession'
import CommunityCaptcha from './CommunityCaptcha'
import styles from './Community.module.css'

/** Prepares a browser identity only after an explicit click. Never publishes content. */
export default function CommunityGuestSetup({ beforePrepare, onPrepared, onSettled }: {
  beforePrepare?: () => boolean
  onPrepared?: (userId: string) => void
  onSettled?: () => void
}) {
  const params = useSearchParams()
  const { session, refresh } = useCommunitySession()
  const [displayName, setDisplayName] = useState(session?.user?.displayName || '')
  const [accepted, setAccepted] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const pending = useRef(false)
  const needsCaptcha = !session?.user
  const hasCaptcha = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
  useEffect(() => {
    if (pending.current) return
    setDisplayName(session?.user?.displayName || ''); setAccepted(false)
    setCaptchaToken(''); setCaptchaResetKey(value => value + 1)
  }, [session?.user?.id, session?.user?.displayName])

  async function prepare() {
    if (pending.current || !session || (!session.user && (!session.guestEnabled || !captchaToken || !hasCaptcha))) return
    if (!accepted || displayName.trim().length < 2) { setError('Choose a nickname and accept the community guidelines.'); return }
    if (beforePrepare && !beforePrepare()) return
    const expectedUserId = session.user?.id || null
    pending.current = true; setBusy(true); setError(''); setStatus('')
    const run = async () => {
      // Another tab may have prepared a profile while this tab waited for the lock.
      const current = await refresh()
      if (!current) throw new Error('Your browser profile could not be checked. Nothing has been posted. Try again.')
      if ((current.user?.id || null) !== expectedUserId) throw new Error('The browser profile changed in another tab. Check the name shown here before continuing. Nothing has been posted.')
      const result = await communityRequest<{ ok: boolean; userId: string }>('/auth/guest', {
        method: 'POST', body: { displayName: displayName.trim(), acceptedGuidelines: true, captchaToken, expectedUserId },
      })
      const next = await refresh()
      if (!next?.profileReady || next.user?.id !== result.userId) throw new Error('Your browser profile could not be confirmed. Nothing has been posted. Check this page and try again.')
      onPrepared?.(result.userId)
      setStatus('Your name is ready. Review your text and choose Publish to share it.')
    }
    try {
      if (navigator.locks) await navigator.locks.request('wherekorea-community-guest', run)
      else if (expectedUserId) await run()
      else throw new Error('This browser cannot safely prepare a guest profile. Update your browser and try again. Your text has not been posted.')
    } catch (cause) {
      // Identity creation can succeed even when the subsequent profile save fails.
      await refresh()
      setError(cause instanceof Error ? cause.message : 'Your browser profile could not be prepared. Nothing has been posted.')
    } finally {
      pending.current = false; setBusy(false); setCaptchaToken(''); setCaptchaResetKey(value => value + 1)
      onSettled?.()
    }
  }

  if (!session?.user && !session?.guestEnabled) return <p className={styles.notice}>Guest posting is not ready on this site yet. You can keep writing and save a draft on this browser.</p>
  return <div className={styles.compactForm} aria-label="Guest posting setup">
    <p><strong>{session?.user ? 'Choose your public name' : 'Post as a guest'}</strong><br />Choose a nickname. No sign-up or email needed.</p>
    <label className={styles.field}>Public nickname<input autoComplete="nickname" value={displayName} onChange={event => setDisplayName(event.target.value)} minLength={2} maxLength={40} disabled={busy} /><span className={styles.help}>Use 2–40 characters. Leave out contact details and website addresses.</span></label>
    <p className={styles.help}>Use this browser to find your posts and replies. If you clear its cookies or close a private window, your posts stay public but you lose access to them.</p>
    <label className={styles.check}><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={busy} /><span>I agree to the <Link href={communityHref('/community/guidelines', params.toString())} target="_blank" rel="noopener">community guidelines</Link>.</span></label>
    {needsCaptcha && (hasCaptcha ? <CommunityCaptcha onToken={setCaptchaToken} resetKey={captchaResetKey} /> : <p className={styles.error} role="alert">The security check is not configured. Guest posting is unavailable.</p>)}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {status && <p className={styles.status} role="status">{status}</p>}
    <button type="button" className={styles.primary} disabled={busy || !accepted || displayName.trim().length < 2 || (needsCaptcha && (!hasCaptcha || !captchaToken))} onClick={() => void prepare()}>{busy ? 'Preparing…' : session?.user ? 'Save nickname' : 'Continue as guest'}</button>
    <p className={styles.help}>Review your text before posting.</p>
  </div>
}
