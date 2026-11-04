import { communityUser, createCommunityClient } from '@/lib/supabase-server'
import { getCommunityConfig } from '@/lib/community-config'
import { communityError, communityJson, HttpError, readCommunityJson } from '@/lib/community-http'
import { isCommunityUuid, validateProfileInput } from '@/lib/community-live'
import { rpcCommunity } from '@/lib/community-server'

export const dynamic = 'force-dynamic'

/** Explicit preparation only. This endpoint never publishes a question/comment. */
export async function POST(request: Request) {
  try {
    const input = await readCommunityJson(request)
    const profile = validateProfileInput(input)
    if (input.expectedUserId !== null && !isCommunityUuid(input.expectedUserId)) throw new HttpError(400, 'Reload your browser profile and try again.')
    const client = await createCommunityClient()
    if (!client) throw new HttpError(503, 'Guest posting is not connected yet.', 'guest_unavailable')
    let user = await communityUser(client)
    // Do not replace a guest (or moderator) when another tab changes the session.
    if ((user?.id ?? null) !== input.expectedUserId) throw new HttpError(409, 'Your browser profile changed. Check it before continuing.', 'session_changed')
    if (!user) {
      if (!getCommunityConfig().guestEnabled) throw new HttpError(503, 'Guest posting is not available yet. Your text is still here.', 'guest_unavailable')
      const state = await rpcCommunity<{ guestEnabled?: boolean; guestSchemaVersion?: number }>(client, 'community_status')
      if (state?.guestEnabled !== true || state?.guestSchemaVersion !== 1) throw new HttpError(503, 'Guest posting is not available yet. Your text is still here.', 'guest_unavailable')
      const captchaToken = typeof input.captchaToken === 'string' ? input.captchaToken.trim() : ''
      if (!captchaToken || captchaToken.length > 2048 || /\s/.test(captchaToken)) throw new HttpError(400, 'Complete the security check again.', 'captcha_required')
      // Supabase Auth must have Turnstile enabled. It verifies this one-use token;
      // consuming it separately here would make the provider verification fail.
      const { data, error } = await client.auth.signInAnonymously({ options: { captchaToken } })
      if (error?.status === 429) throw new HttpError(429, 'Too many attempts. Wait before trying again.', 'rate_limited')
      if (error?.code === 'captcha_failed') throw new HttpError(400, 'The security check expired or failed. Complete it again.', 'captcha_required')
      if (error || !data.user || data.user.is_anonymous !== true || !data.session) throw new HttpError(503, 'Your browser profile could not be prepared. Try again shortly.', 'guest_unavailable')
      user = data.user
    }
    await rpcCommunity(client, 'community_set_profile', { p_display_name: profile.displayName, p_accepted_guidelines: profile.acceptedGuidelines })
    // If profile saving fails the new cookie can already exist: the caller refreshes
    // session state and retries with that identity, not a new anonymous signup.
    return communityJson({ ok: true, userId: user.id })
  } catch (error) { return communityError(error) }
}
