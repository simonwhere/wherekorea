import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCommunityConfig } from '@/lib/community-config'
import { HttpError } from '@/lib/community-http'
import { createCommunityClient, requireCommunityUser } from '@/lib/supabase-server'

const DATABASE_ERRORS: Record<string, [number, string, string]> = {
  WK_AUTH_REQUIRED: [401, 'Set up a browser profile before continuing.', 'sign_in_required'],
  WK_EMAIL_REQUIRED: [403, 'Confirm your email address before continuing.', 'email_required'],
  WK_DISABLED: [503, 'Public posting is not open yet. Your draft has not been published.', 'posting_closed'],
  WK_GUEST_DISABLED: [503, 'Guest posting is paused. Your text has not been published.', 'guest_unavailable'],
  WK_PROFILE_REQUIRED: [409, 'Add a display name and accept the guidelines first.', 'profile_required'],
  WK_FORBIDDEN: [403, 'This action is not available for this account.', 'forbidden'],
  WK_NOT_FOUND: [404, 'This question or comment is no longer available.', 'not_found'],
  WK_INVALID: [400, 'Check the fields and try again.', 'invalid_request'],
  WK_RATE_LIMIT: [429, 'Too many requests. Wait a while before trying again.', 'rate_limited'],
  WK_CONFLICT: [409, 'This request has already been used. Reload before submitting new content.', 'conflict'],
}

/** Never expose database SQL, schemas, identity claims or request bodies in an error. */
export async function rpcCommunity<T>(client: SupabaseClient, name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args)
  if (error) {
    const known = DATABASE_ERRORS[error.message]
    if (known) throw new HttpError(...known)
    throw new HttpError(503, 'Community storage is unavailable. Nothing has been confirmed as saved; try again with the same draft.', 'community_unavailable')
  }
  return data as T
}

export async function liveCommunityReader() {
  const client = await createCommunityClient()
  if (!client) throw new HttpError(503, 'The community is not connected yet.', 'community_unconfigured')
  return client
}

export async function requireLiveCommunity(options: { posting?: boolean } = {}) {
  const config = getCommunityConfig()
  if (!config.configured) throw new HttpError(503, 'The community is not connected yet.', 'community_unconfigured')
  if (options.posting && !config.postingEnabled) throw new HttpError(503, 'Public posting is not open yet. Your draft has not been published.', 'posting_closed')
  const session = await requireCommunityUser()
  if (!session) throw new HttpError(401, 'Set up a browser profile before continuing.', 'sign_in_required')
  if (options.posting && session.user.is_anonymous === true && !config.guestEnabled) throw new HttpError(503, 'Guest posting is paused. Your text has not been published.', 'guest_unavailable')
  return session
}
