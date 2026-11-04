import { communityUser, createCommunityClient } from '@/lib/supabase-server'
import { communityError, communityJson, HttpError, readCommunityJson } from '@/lib/community-http'

export async function POST(request: Request) {
  try {
    const input = await readCommunityJson(request)
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
    const token = typeof input.token === 'string' ? input.token.trim() : ''
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(token)) throw new HttpError(400, 'Enter your email and the six-digit code.')
    const client = await createCommunityClient()
    if (!client) throw new HttpError(503, 'Email sign-in is not connected yet.', 'unavailable')
    if ((await communityUser(client))?.is_anonymous === true) throw new HttpError(409, 'Use a separate browser profile for moderator sign-in. This keeps your guest questions and replies here.', 'guest_session_active')
    const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' })
    if (error?.status === 429) throw new HttpError(429, 'Too many code attempts. Wait before trying again.', 'rate_limited')
    if (error && (!error.status || error.status >= 500 || error.name === 'AuthRetryableFetchError')) throw new HttpError(503, 'Sign-in could not be reached. Keep your code and try again shortly.', 'auth_unavailable')
    if (error || !data.user?.email_confirmed_at || !data.session) throw new HttpError(400, 'This code is invalid or has expired. Request another code.', 'invalid_code')
    return communityJson({ ok: true })
  } catch (error) { return communityError(error) }
}
