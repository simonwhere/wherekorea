'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { communityHref } from '@/lib/community'
import { accountReturnPath, communityRequest, useCommunitySession } from './CommunitySession'
import styles from './Community.module.css'
import CommunityCaptcha from './CommunityCaptcha'
import CommunityGuestSetup from './CommunityGuestSetup'

export default function CommunityAccount() {
  const params = useSearchParams()
  const router = useRouter()
  const { session, loading, error: sessionError, refresh } = useCommunitySession()
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [sent, setSent] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const needsCaptcha = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
  const pending = useRef(false)
  const back = accountReturnPath(params.get('returnTo'), communityHref('/community', params.toString()))
  useEffect(() => { setDisplayName(session?.user?.displayName || '') }, [session?.user?.displayName])
  useEffect(() => {
    // Consents and destructive confirmations belong to one account, never the next sign-in.
    setAccepted(false); setDeleteOpen(false); setDeleteConfirmation('')
    setEmail(''); setToken(''); setSent(false); setEmailOpen(false)
    setError(''); setStatus(''); setCaptchaToken('')
    setCaptchaResetKey(value => value + 1)
  }, [session?.user?.id])

  async function requestCode(event: FormEvent) {
    event.preventDefault(); if (pending.current || (needsCaptcha && !captchaToken)) return
    pending.current = true
    setBusy(true); setError(''); setStatus('')
    try { await communityRequest('/auth/request', { method: 'POST', body: { email: email.trim(), captchaToken } }); setSent(true); setToken(''); setStatus('Check your email for a sign-in code. If it has not arrived, check spam or try again later.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The code could not be requested.') }
    finally { pending.current = false; setBusy(false); setCaptchaToken(''); setCaptchaResetKey(value => value + 1) }
  }
  async function verify(event: FormEvent) {
    event.preventDefault(); if (pending.current) return
    pending.current = true
    setBusy(true); setError(''); setStatus('')
    try {
      if (!navigator.locks) throw new Error('Update your browser before signing in. This keeps an existing guest profile from being replaced.')
      await navigator.locks.request('wherekorea-community-guest', async () => {
        const current = await refresh()
        if (!current) throw new Error('Your browser profile could not be checked. Try again.')
        if (current.user) throw new Error('This browser already has a community profile. Use a separate browser profile for moderator sign-in; guest posts will not be transferred.')
        await communityRequest('/auth/verify', { method: 'POST', body: { email: email.trim(), token: token.trim() } })
        setToken(''); setEmail(''); setSent(false); await refresh(); setStatus('Signed in. Nothing has been posted.')
      })
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The code could not be verified.') }
    finally { pending.current = false; setBusy(false) }
  }
  async function saveProfile(event: FormEvent) {
    event.preventDefault(); if (pending.current) return
    if (!accepted) { setError('Read and accept the community guidelines before continuing.'); return }
    pending.current = true; setBusy(true); setError(''); setStatus('')
    try {
      await communityRequest('/profile', { method: 'POST', body: { displayName: displayName.trim(), acceptedGuidelines: true, expectedUserId: session?.user?.id } })
      const next = await refresh()
      setStatus('Your display name is saved. Nothing has been posted.')
      if (params.has('returnTo') && next?.profileReady) router.push(back)
    }
    catch (cause) { await refresh(); setError(cause instanceof Error ? cause.message : 'Your display name could not be saved.') }
    finally { pending.current = false; setBusy(false) }
  }
  async function signOut() {
    if (pending.current || session?.user?.isGuest) return
    pending.current = true; setBusy(true); setError(''); setStatus('')
    try { await communityRequest('/auth/signout', { method: 'POST', body: { expectedUserId: session?.user?.id || null } }); await refresh(); setStatus('Signed out. Browser drafts remain on this device.') }
    catch (cause) { await refresh(); setError(cause instanceof Error ? cause.message : 'Sign-out failed. Please try again.') }
    finally { pending.current = false; setBusy(false) }
  }
  async function deleteCommunityData(event: FormEvent) {
    event.preventDefault(); if (pending.current || deleteConfirmation !== 'DELETE MY COMMUNITY DATA') return
    pending.current = true; setBusy(true); setError(''); setStatus('')
    try { await communityRequest('/profile', { method: 'DELETE', body: { confirmation: deleteConfirmation, expectedUserId: session?.user?.id } }); await refresh(); setDeleteOpen(false); setDeleteConfirmation(''); setStatus('Your community data has been removed. Browser drafts and the browser identity have not been deleted.') }
    catch (cause) { setDeleteOpen(false); setDeleteConfirmation(''); await refresh(); setError(cause instanceof Error ? cause.message : 'Your community data could not be removed.') }
    finally { pending.current = false; setBusy(false) }
  }

  return <div className={styles.content}>
    <p className={styles.eyebrow}>Community</p><h1 className={styles.title}>Your browser profile</h1>
    <p className={styles.intro}>Questions and comments use a public nickname. No Google account or email is needed to participate as a guest. My questions and Replies are available in the same browser.</p>
    {params.get('signIn') === 'retry' && !session?.user && <p className={styles.notice} role="status">Sign-in was not completed. Your saved draft has not been posted. Try again from here.</p>}
    {(error || sessionError) && <p className={styles.error} role="alert" style={{ marginTop: 20 }}>{error || sessionError}</p>}
    {status && <p className={styles.status} role="status" style={{ marginTop: 20 }}>{status}</p>}
    {loading && !session ? <p className={styles.skeleton} role="status">Checking browser profile…</p> : !session ? <button className={styles.button} onClick={() => void refresh()}>Try again</button> : !session.configured ? <p className={styles.notice}>Guest posting is not connected yet. You can write and save drafts on this browser.</p> : session.user ? <>
      {session.user.isGuest && <p className={styles.notice}>Keep this browser’s cookies to manage your posts and check replies. Clearing cookies, closing a private browsing session or changing devices loses that access. Your public posts remain visible. There is no guest profile recovery or account linking yet.</p>}
      <form className={styles.form} onSubmit={saveProfile} style={{ marginTop: 28 }}>
        <label className={styles.field}>Public nickname<input autoComplete="nickname" value={displayName} onChange={event => setDisplayName(event.target.value)} minLength={2} maxLength={40} disabled={busy} required /><span className={styles.help}>Choose a nickname for your questions and comments. Do not include an email address or contact handle.</span></label>
        <label className={styles.check}><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={busy} required /><span>I have read and accept the <Link href={communityHref('/community/guidelines', params.toString())} target="_blank">community guidelines</Link>.</span></label>
        <div className={styles.actions}><button className={styles.primary} disabled={busy} type="submit">{busy ? 'Saving…' : params.has('returnTo') ? 'Save name and continue' : 'Save nickname'}</button>{!session.user.isGuest && <button className={styles.button} disabled={busy} type="button" onClick={signOut}>Sign out</button>}</div>
      </form>
      {session.profileReady && <div className={styles.actions} style={{ marginTop: 24 }}><Link className={styles.primary} href={back}>Continue where you left off</Link><Link className={styles.button} href={communityHref('/community/account/blocked', params.toString())}>Blocked accounts</Link>{session.moderator && <Link className={styles.button} href={communityHref('/community/moderation', params.toString())}>Review reports</Link>}</div>}
      <section className={styles.box} style={{ marginTop: 30 }}><h2>Remove your community data</h2><p>This removes your community profile, questions and their reply threads, your comments, reports and blocks. It does not delete browser drafts or the browser identity. Records needed to enforce a posting restriction may be retained.</p>
        {!deleteOpen ? <button className={`${styles.button} ${styles.danger}`} onClick={() => setDeleteOpen(true)}>Delete community data…</button> : <form className={styles.form} onSubmit={deleteCommunityData}>
          <label className={styles.field}>Type DELETE MY COMMUNITY DATA to confirm<input value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} disabled={busy} autoComplete="off" /></label><div className={styles.actions}><button className={`${styles.button} ${styles.danger}`} disabled={busy || deleteConfirmation !== 'DELETE MY COMMUNITY DATA'} type="submit">{busy ? 'Removing…' : 'Permanently remove community data'}</button><button className={styles.button} disabled={busy} type="button" onClick={() => { setDeleteOpen(false); setDeleteConfirmation('') }}>Cancel</button></div>
        </form>}
      </section>
    </> : <>
      <CommunityGuestSetup onPrepared={() => setStatus('Your browser profile is ready. Nothing has been posted.')} />
      <button type="button" className={styles.quiet} disabled={busy} aria-expanded={emailOpen} aria-controls="community-email-sign-in" onClick={() => setEmailOpen(value => !value)} style={{ marginTop: 18 }}>{emailOpen ? 'Hide moderator sign-in' : 'Moderator sign-in'}</button>
      {emailOpen && <div id="community-email-sign-in"><p className={styles.help}>For appointed moderators only. An email code does not grant moderator access or recover a lost guest profile. Ordinary questions and comments do not need this step.</p>{!sent ? <form className={styles.form} onSubmit={requestCode} style={{ marginTop: 20 }}><label className={styles.field}>Email address<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} disabled={busy} required /></label><CommunityCaptcha onToken={setCaptchaToken} resetKey={captchaResetKey} /><button className={styles.primary} disabled={busy || (needsCaptcha && !captchaToken)} type="submit">{busy ? 'Requesting code…' : 'Email me a code'}</button></form> : <form className={styles.form} onSubmit={verify} style={{ marginTop: 20 }}>
        <p className={styles.help}>Enter the six-digit code from your email. It will not appear in the page address.</p><label className={styles.field}>Sign-in code<input inputMode="numeric" autoComplete="one-time-code" value={token} onChange={event => setToken(event.target.value.replace(/\s/g, ''))} pattern="[0-9]{6}" minLength={6} maxLength={6} disabled={busy} required /></label>
        <div className={styles.actions}><button className={styles.primary} disabled={busy} type="submit">{busy ? 'Checking code…' : 'Sign in'}</button><button type="button" className={styles.button} disabled={busy} onClick={() => { setSent(false); setToken(''); setStatus(''); setError('') }}>Use another email or request a new code</button></div>
      </form>}</div>}
    </>}
    <p className={styles.help} style={{ marginTop: 25 }}>Preparing a browser profile never publishes a saved draft. Only the nickname you choose is public. Anyone using this browser profile may access its drafts, questions and replies. <Link href={communityHref('/community/guidelines', params.toString())}>Read the community guidelines</Link> before posting.</p>
    <Link className={styles.quiet} href={back}>← Return without posting</Link>
  </div>
}
