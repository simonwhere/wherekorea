import 'server-only'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getCommunityConfig } from './community-config'
import { HttpError } from './community-http'

/** Only Route Handlers use this client. There is no browser Supabase client. */
export async function createCommunityClient() {
  const config = getCommunityConfig()
  if (!config.configured) return null
  const jar = await cookies()
  return createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://') === true, path: '/' },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: values => { for (const { name, value, options } of values) jar.set(name, value, { ...options, httpOnly: true, sameSite: 'lax' }) },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000) }) },
  })
}

export async function requireCommunityUser() {
  const client = await createCommunityClient()
  if (!client) return null
  const user = await communityUser(client)
  return user ? { client, user } : null
}

export async function communityUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser()
  if (error) {
    if (error.name === 'AuthSessionMissingError' || error.status === 401 || error.status === 403 || error.code === 'bad_jwt' || error.code === 'refresh_token_not_found') return null
    throw new HttpError(503, 'Your browser profile could not be checked. Try again shortly.', 'auth_unavailable')
  }
  if (!data.user) return null
  // Only the verified Auth response determines guest status, never user_metadata.
  if (data.user.is_anonymous !== true && !data.user.email_confirmed_at) throw new HttpError(403, 'Verify your email before continuing.', 'email_required')
  return data.user
}
