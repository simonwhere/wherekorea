import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { communityUser, createCommunityClient } from '@/lib/supabase-server'
import { getCommunityConfig } from '@/lib/community-config'
import { communityError, communityJson, HttpError, readCommunityJson } from '@/lib/community-http'
import { accountReturnPath, COMMUNITY_OAUTH_COOKIE, COMMUNITY_OAUTH_TTL_SECONDS, communityOAuthOrigin, isCommunityOAuthUrl } from '@/lib/community-oauth'

export async function POST(request: Request) {
  try {
    const body = await readCommunityJson(request)
    const config = getCommunityConfig()
    const origin = communityOAuthOrigin(request.url)
    if (!config.googleEnabled || !origin) throw new HttpError(503, 'Google sign-in is not available yet. Your draft is still saved in this browser.', 'google_unavailable')
    const client = await createCommunityClient()
    if (!client) throw new HttpError(503, 'Sign-in is not available yet.', 'unavailable')
    if ((await communityUser(client))?.is_anonymous === true) throw new HttpError(409, 'Account linking is not available. Keep this browser profile to manage your questions and replies.', 'guest_session_active')
    const nonce = randomBytes(32).toString('hex')
    const returnTo = accountReturnPath(typeof body.returnTo === 'string' ? body.returnTo : null)
    const redirectTo = new URL('/api/community/auth/callback', origin)
    const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo.href, skipBrowserRedirect: true } })
    if (error || !isCommunityOAuthUrl(data?.url, config.url)) throw new HttpError(503, 'Google sign-in could not be opened. Your draft is still here. Try again shortly.', 'google_unavailable')
    const jar = await cookies()
    jar.set(COMMUNITY_OAUTH_COOKIE, JSON.stringify({ nonce, returnTo, expiresAt: Date.now() + COMMUNITY_OAUTH_TTL_SECONDS * 1000 }), {
      httpOnly: true, secure: origin.startsWith('https:'), sameSite: 'lax', path: '/api/community/auth', maxAge: COMMUNITY_OAUTH_TTL_SECONDS,
    })
    return communityJson({ url: data.url })
  } catch (error) { return communityError(error) }
}
