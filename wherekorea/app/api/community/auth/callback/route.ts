import { cookies } from 'next/headers'
import { communityUser, createCommunityClient } from '@/lib/supabase-server'
import { getCommunityConfig } from '@/lib/community-config'
import { communityJson } from '@/lib/community-http'
import { COMMUNITY_OAUTH_COOKIE, communityAccountHandoff, communityOAuthOrigin, readCommunityOAuthState } from '@/lib/community-oauth'

export async function GET(request: Request) {
  const origin = communityOAuthOrigin(request.url)
  if (!origin) return communityJson({ error: 'Sign-in is not configured on this site.' }, 503)
  const redirect = (path: string) => new Response(null, { status: 303, headers: {
    // An explicit empty fragment prevents OAuth provider error fragments being inherited.
    Location: new URL(path, origin).href + '#', 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', Vary: 'Cookie',
  } })
  const jar = await cookies()
  const state = readCommunityOAuthState(jar.get(COMMUNITY_OAUTH_COOKIE)?.value)
  const params = new URL(request.url).searchParams
  // The SSR client binds the code to this browser with its HttpOnly PKCE verifier.
  // Keeping the callback fixed allows one exact redirect allowlist entry.
  if (!state) return redirect(communityAccountHandoff('/community', true))
  const failure = () => redirect(communityAccountHandoff(state.returnTo, true))
  try {
    const code = params.get('code')
    if (!getCommunityConfig().googleEnabled || params.has('error') || !code || code.length > 2048 || /[\s\u0000-\u001f\u007f]/.test(code)) return failure()
    const client = await createCommunityClient()
    if (!client) return failure()
    if ((await communityUser(client))?.is_anonymous === true) return failure()
    const { data, error } = await client.auth.exchangeCodeForSession(code)
    if (error || !data.session || !data.user || !await communityUser(client)) return failure()
    // Failed or superseded PKCE exchanges must not consume the current return path.
    jar.set(COMMUNITY_OAUTH_COOKIE, '', { httpOnly: true, secure: origin.startsWith('https:'), sameSite: 'lax', path: '/api/community/auth', maxAge: 0 })
    const { data: profile, error: profileError } = await client.rpc('community_get_profile')
    if (profileError) return failure()
    // Never copy Google name/email/avatar metadata into the public community profile.
    return redirect(profile?.acceptedGuidelines && profile?.displayName && !profile?.banned ? state.returnTo : communityAccountHandoff(state.returnTo))
  } catch { return failure() }
}
