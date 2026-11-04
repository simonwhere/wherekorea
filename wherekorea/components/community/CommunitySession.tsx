'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
export { accountReturnPath } from '@/lib/community-oauth'

export interface CommunitySessionData {
  configured: boolean
  googleEnabled: boolean
  guestEnabled: boolean
  postingEnabled: boolean
  user: { id: string; displayName: string | null; isGuest: boolean } | null
  profileReady: boolean
  moderator: boolean
}

export class CommunityRequestError extends Error {
  code: string
  constructor(message: string, code: unknown) {
    super(message)
    this.name = 'CommunityRequestError'
    this.code = typeof code === 'string' ? code : ''
  }
}

export async function communityRequest<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(`/api/community${path}`, {
      method: options?.method || 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      ...(options?.body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options.body) } : {}),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new CommunityRequestError(typeof data?.error === 'string' ? data.error : 'This request could not be completed. Please try again.', data?.code)
    if (!data || typeof data !== 'object') throw new Error('The response could not be read. Please try again.')
    return data as T
  } catch (cause) {
    if (controller.signal.aborted) throw new Error('The request took too long to confirm. Please try again.')
    if (cause instanceof TypeError) throw new Error('The request could not be confirmed. Check your connection and try again.')
    throw cause
  } finally { clearTimeout(timeout) }
}

const SessionContext = createContext<{
  session: CommunitySessionData | null; loading: boolean; error: string; refresh: () => Promise<CommunitySessionData | null>
}>({ session: null, loading: true, error: '', refresh: async () => null })

export function CommunitySessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<CommunitySessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const latestRequest = useRef(0)
  const refresh = useCallback(async () => {
    const request = ++latestRequest.current
    setLoading(true)
    try {
      const next = await communityRequest<CommunitySessionData>('/session')
      if (request !== latestRequest.current) return null
      setSession(next); setError(''); return next
    } catch (cause) {
      if (request !== latestRequest.current) return null
      setSession(null); setError(cause instanceof Error ? cause.message : 'Your browser profile could not be checked.'); return null
    } finally { if (request === latestRequest.current) setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  return <SessionContext.Provider value={{ session, loading, error, refresh }}>{children}</SessionContext.Provider>
}

export function useCommunitySession() { return useContext(SessionContext) }

