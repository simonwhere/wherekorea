'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { COMMUNITY_DESTINATIONS, COMMUNITY_TYPES, communityHref, emptyDraft, koreaToday, newDraftId, parseCommunityState, validateDraft, type CommunityDraft } from '@/lib/community'
import { COMMUNITY_DRAFTS_KEY, loadDrafts, saveDraft } from '@/lib/community-storage'
import { track } from '@/lib/analytics'
import { CommunityNotice } from './CommunityNav'
import styles from './Community.module.css'
import { communityRequest, CommunityRequestError, useCommunitySession } from './CommunitySession'
import CommunityGuestSetup from './CommunityGuestSetup'

// In-memory recovery only: browser Back/Forward should not silently lose text.
// This is not a persisted save and disappears when the tab reloads or closes.
const unsavedDrafts = new Map<string, { draft: CommunityDraft; saved: string }>()

export default function CommunityComposer() {
  const params = useSearchParams()
  const router = useRouter()
  const { session, refresh } = useCommunitySession()
  const { type, city } = parseCommunityState(new URLSearchParams(params.toString()))
  const draftId = params.get('draft') || ''
  const returnToReview = params.get('review') === '1'
  const recoveryKey = draftId || `new:${type}:${city}`
  const [draft, setDraft] = useState<CommunityDraft | null>(null)
  const [saved, setSaved] = useState('')
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState(false)
  const [reload, setReload] = useState(0)
  const [today, setToday] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [sessionMismatchOwner, setSessionMismatchOwner] = useState('')
  const canPublish = draft?.type === 'meetups' ? session?.meetupPostingEnabled : draft?.type === 'questions' && session?.postingEnabled
  const publishingRef = useRef(false)
  const skipDraftReload = useRef('')
  const dirty = draft !== null && JSON.stringify(draft) !== saved
  const draftRef = useRef(draft)
  const dirtyRef = useRef(dirty)
  const bypassGuard = useRef(false)
  const currentUser = useRef(session?.user?.id)
  currentUser.current = session?.user?.id
  draftRef.current = draft
  dirtyRef.current = dirty


  const previousOwner = useRef(session?.user?.id)
  useEffect(() => {
    const owner = session?.user?.id
    if (previousOwner.current && owner !== previousOwner.current) setPreview(false)
    previousOwner.current = owner
  }, [session?.user?.id])

  useEffect(() => {
    // Saving as part of an explicit publish changes only the URL identifier.
    // Keep the already reviewed preview and any request error on that transition.
    if (draftId && skipDraftReload.current === draftId && draftRef.current?.id === draftId) { skipDraftReload.current = ''; return }
    const result = loadDrafts()
    setToday(koreaToday())
    setLoadError('')
    setError('')
    setErrors({})
    setPreview(false)
    const recovered = unsavedDrafts.get(recoveryKey)
    const persisted = draftId ? result.drafts.find(item => item.id === draftId) : undefined
    if (recovered && (!draftId || (persisted && !result.error))) {
      setDraft(recovered.draft)
      setSaved(recovered.saved)
      setStatus('Unsaved changes restored in this tab. Use Save draft to keep them on this browser.')
      if (result.error) setError(result.error)
      if (persisted && persisted.updatedAt !== recovered.draft.updatedAt) setError('The saved draft changed in another tab. Your unsaved text has been kept here. Copy it before reopening the saved version.')
      return
    }
    if (draftId && !persisted && !result.error) unsavedDrafts.delete(recoveryKey)
    if (draftId) {
      if (result.error) { setDraft(null); setLoadError(result.error); return }
      const found = persisted
      if (!found) { setDraft(null); setLoadError('This draft is not on this browser. It may have been removed, or saved on another browser.'); return }
      setDraft(found)
      setSaved(JSON.stringify(found))
      if (returnToReview && found.type === 'questions' && !Object.keys(validateDraft(found)).length) {
        setPreview(true)
        setStatus('Your saved draft is ready to review. Nothing has been posted.')
      }
    } else {
      const next = { ...emptyDraft(type, city), id: newDraftId() }
      setDraft(next)
      setSaved(JSON.stringify(next))
      if (result.error) setError(result.error)
    }
  }, [draftId, type, city, recoveryKey, reload, returnToReview])

  useEffect(() => () => {
    if (draftRef.current && dirtyRef.current) {
      if (unsavedDrafts.size >= 20) unsavedDrafts.delete(unsavedDrafts.keys().next().value!)
      unsavedDrafts.set(recoveryKey, { draft: draftRef.current, saved })
    }
  }, [recoveryKey, saved])

  useEffect(() => {
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    const guardNavigation = (event: MouseEvent) => {
      if (!dirtyRef.current || bypassGuard.current || !(event.target instanceof Element)) return
      const target = event.target.closest('a[href], header button, [data-community-leave]')
      if (!target) return
      if (target instanceof HTMLAnchorElement && (target.target === '_blank' || target.hasAttribute('download'))) return
      if (!window.confirm('Leave without saving your changes? Your last saved draft will stay on this browser.')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', warnBeforeLeave)
    document.addEventListener('click', guardNavigation, true)
    return () => {
      window.removeEventListener('beforeunload', warnBeforeLeave)
      document.removeEventListener('click', guardNavigation, true)
    }
  }, [])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== COMMUNITY_DRAFTS_KEY && event.key !== null) return
      const current = draftRef.current
      if (!current?.updatedAt) return
      const result = loadDrafts()
      if (result.error) { setError(result.error); return }
      const next = result.drafts.find(item => item.id === current.id)
      if (!next || next.updatedAt !== current.updatedAt) {
        if (dirtyRef.current || !next) {
          setError('This draft changed or was removed in another tab. Your text here has been kept. Copy it before reopening the saved draft.')
        } else {
          setDraft(next)
          setSaved(JSON.stringify(next))
          setStatus('Updated from the draft saved in another tab.')
        }
      }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  function change(field: keyof CommunityDraft, value: string) {
    setDraft(previous => previous ? { ...previous, [field]: value } : previous)
    setErrors(previous => { const next = { ...previous }; delete next[field]; return next })
    setStatus('')
  }

  const save = useCallback((navigate = true) => {
    if (!draft) return
    const result = saveDraft(draft)
    if (!result.ok) { setError(result.error || 'The draft could not be saved. Your text is still here.'); setStatus(''); return }
    const next = result.drafts.find(item => item.id === draft.id)!
    setDraft(next)
    setSaved(JSON.stringify(next))
    dirtyRef.current = false
    unsavedDrafts.delete(recoveryKey)
    setError('')
    setStatus('Saved in this browser only. Not published.')
    track('community_draft_saved', { type: next.type, city: next.city || 'all' })
    if (!draftId && navigate) {
      bypassGuard.current = true
      router.replace(communityHref(`/community/new?draft=${encodeURIComponent(next.id)}`, params.toString(), { type: next.type, city: next.city || 'all' }), { scroll: false })
      bypassGuard.current = false
    }
    return next
  }, [draft, draftId, params, recoveryKey, router])

  async function publish() {
    if (!draft || !preview || publishingRef.current || !canPublish || !session?.user || !session.profileReady) return
    const expectedUserId = session.user.id
    const nextErrors = validateDraft(draft)
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); setPreview(false); return }
    publishingRef.current = true; setPublishing(true); setError(''); setStatus('')
    if (!draftId) skipDraftReload.current = draft.id
    const keptDraft = save()
    if (!keptDraft) { skipDraftReload.current = ''; publishingRef.current = false; setPublishing(false); return }
    try {
      // A draft keeps the same publication id across retries, including a reload.
      const result = await communityRequest<{ question: { id: string; city: string } }>('/questions', { method: 'POST', body: { id: draft.id, city: draft.city, title: draft.title, body: draft.body, type: draft.type, ...(draft.type === 'meetups' ? { meetupDate: draft.meetupDate } : {}), expectedUserId } })
      if (currentUser.current !== expectedUserId || draftRef.current?.id !== draft.id) return
      dirtyRef.current = false; unsavedDrafts.delete(recoveryKey); bypassGuard.current = true
      router.push(communityHref(`/community/questions/${result.question.id}`, params.toString(), { type: draft.type, city: result.question.city }))
    } catch (cause) {
      if (currentUser.current !== expectedUserId || draftRef.current?.id !== draft.id) return
      if (cause instanceof CommunityRequestError && (cause.code === 'session_changed' || cause.code === 'sign_in_required')) {
        setSessionMismatchOwner(expectedUserId); setPreview(false)
        await refresh()
      }
      setError(cause instanceof Error ? cause.message : 'Publication was not confirmed. Your text is still here. Try posting it again.')
    }
    finally { publishingRef.current = false; setPublishing(false) }
  }

  function showPreview(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    const nextErrors = validateDraft(draft)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      setTimeout(() => document.getElementById(`community-${Object.keys(nextErrors)[0]}`)?.focus(), 0)
      return
    }
    setPreview(true)
    setTimeout(() => document.getElementById('community-preview-title')?.focus(), 0)
  }

  function reopen() {
    if (dirty && !window.confirm('Discard your unsaved changes and reopen the saved version?')) return
    unsavedDrafts.delete(recoveryKey)
    dirtyRef.current = false
    setStatus('')
    setReload(value => value + 1)
  }

  const fieldError = (field: string) => errors[field] ? <span id={`community-${field}-error`} className={styles.fieldError}>{errors[field]}</span> : null
  const fieldProps = (field: string) => ({ id: `community-${field}`, 'aria-invalid': !!errors[field], 'aria-describedby': errors[field] ? `community-${field}-error` : undefined })

  if (sessionMismatchOwner && session?.user?.id !== sessionMismatchOwner) return <div className={styles.content}>
    <h1 className={styles.title}>Check your browser profile before posting</h1>
    <p className={styles.notice} role="alert">Your browser profile changed or its cookies expired. Nothing was posted. Your post was saved in My drafts on this browser. Check the profile before reopening it.</p>
    <div className={styles.actions}><Link className={styles.primary} href={communityHref('/community/account', params.toString())}>Check browser profile</Link><Link className={styles.button} href={communityHref('/community/drafts', params.toString())}>My drafts</Link></div>
  </div>
  if (loadError) return <div className={styles.content}>
    <h1 className={styles.title}>Draft unavailable</h1><p className={styles.error} role="alert" style={{ margin: '20px 0' }}>{loadError}</p>
    <div className={styles.actions}><button type="button" className={styles.button} onClick={() => setReload(value => value + 1)}>Try again</button><Link href={communityHref('/community/drafts', params.toString())} className={styles.primary}>Open my drafts</Link></div>
  </div>
  if (!draft) return <p className={styles.skeleton} role="status">Loading your draft…</p>
  const config = COMMUNITY_TYPES.find(item => item.value === draft.type)!
  const destination = COMMUNITY_DESTINATIONS.find(item => item.slug === draft.city)?.name

  return <div className={styles.content}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>{config.label}</p>
      <h1>{preview ? 'Check your post' : draft.type === 'meetups' ? 'Find a travel buddy' : draft.type === 'questions' ? 'Ask other travellers' : 'Write a trip note'}</h1>
      <p className={styles.intro}>{draft.type === 'meetups' ? 'Pick a day and describe what you’d like to do together.' : draft.type === 'questions' ? 'Ask about a neighbourhood, a meal or getting around.' : 'Write down a place or a meal you remember.'}</p>
    </div></div>
    <CommunityNotice />
    {error && <div className={styles.error} role="alert" style={{ marginBottom: 20 }}><p>{error}</p>{draft.updatedAt && <button type="button" className={styles.quiet} onClick={reopen}>Reopen saved draft</button>}</div>}
    {status && <p className={styles.status} role="status" style={{ marginBottom: 20 }}>{status}</p>}
    {preview ? <section className={styles.preview} aria-label="Draft preview">
      <div className={styles.meta}><span className={styles.badge}>{destination}</span><span>Draft · not published</span></div>
      <h2 id="community-preview-title" tabIndex={-1}>{draft.title}</h2>
      {draft.type === 'notes' && draft.visitedMonth && <p className={styles.muted} style={{ marginBottom: 12 }}>Visited {draft.visitedMonth}</p>}
      {draft.type === 'meetups' && <p style={{ marginBottom: 18 }}>{draft.meetupDate} · Korea time</p>}
      {draft.type === 'meetups' && (draft.startTime || draft.endTime) && <p className={styles.help}>Your earlier draft listed {draft.startTime || '…'}–{draft.endTime || '…'} (Korea time). To share these hours, add them to your post.</p>}
      <p className={styles.body}>{draft.body}</p>
      <div className={styles.actions}><button className={styles.button} type="button" disabled={publishing} onClick={() => setPreview(false)}>Continue editing</button><button className={styles.button} type="button" disabled={publishing} onClick={() => save()}>Save draft</button></div>
      {canPublish && session && <div className={styles.compactForm}>
        {session.user && session.profileReady ? <>
          <p>Anyone can read this post and reply.</p>
          <button type="button" className={styles.primary} disabled={publishing} onClick={publish}>{publishing ? 'Posting…' : `Post as ${session.user.displayName}`}</button>
          <p className={styles.help}>A copy stays in My drafts on this browser.</p>
        </> : <CommunityGuestSetup beforePrepare={() => Boolean(save(false))} onPrepared={() => { setStatus('Your nickname is ready. Check your post and the name shown below. Nothing has been posted.') }} />}
      </div>}
    </section> : <form className={styles.form} noValidate onSubmit={showPreview}>
      {Object.keys(errors).length > 0 && <p className={styles.error} role="alert">Check the marked fields to preview this draft. You can still save it unfinished.</p>}
      <label className={styles.field}>Destination<select {...fieldProps('city')} value={draft.city} onChange={event => change('city', event.target.value)}><option value="">Choose a destination</option>{COMMUNITY_DESTINATIONS.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select>{fieldError('city')}</label>
      <label className={styles.field}>{draft.type === 'questions' ? 'Your question' : draft.type === 'notes' ? 'Title' : 'Activity'}<input {...fieldProps('title')} value={draft.title} maxLength={140} onChange={event => change('title', event.target.value)} placeholder={draft.type === 'questions' ? 'What would you like to check?' : draft.type === 'notes' ? 'What happened during your visit?' : 'A walk, a meal or another short activity'} />{fieldError('title')}<span className={styles.help}>{draft.title.length}/140 characters</span></label>
      {draft.type === 'notes' && <label className={styles.field}>Month of visit (optional)<input {...fieldProps('visitedMonth')} type="month" value={draft.visitedMonth} min="1900-01" max={today ? today.slice(0, 7) : undefined} onChange={event => change('visitedMonth', event.target.value)} />{fieldError('visitedMonth')}<span className={styles.help}>Leave this blank if you do not remember the month.</span></label>}
      {draft.type === 'meetups' && <label className={styles.field}>Meetup date (Korea time)<input {...fieldProps('meetupDate')} type="date" value={draft.meetupDate} min={today || undefined} onChange={event => change('meetupDate', event.target.value)} />{fieldError('meetupDate')}</label>}
      <label className={styles.field}>{draft.type === 'questions' ? 'Details' : draft.type === 'notes' ? 'Your trip note' : 'What’s the plan?'}<textarea {...fieldProps('body')} value={draft.body} maxLength={3000} rows={8} onChange={event => change('body', event.target.value)} />{fieldError('body')}<span className={styles.help}>{draft.body.length}/3,000 characters. Leave out contact details, booking references and accommodation addresses.</span></label>
      <div className={styles.actions}><button type="submit" className={styles.primary}>Preview</button><button type="button" className={styles.button} onClick={() => save()}>Save draft</button></div>
      <p className={styles.help}>{dirty ? 'You have unsaved changes.' : draft.updatedAt ? 'Saved in this browser only. Not published.' : 'You can save an unfinished draft.'} Drafts are not synced across browsers or devices.</p>
    </form>}
  </div>
}
