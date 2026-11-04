import { communityUser, createCommunityClient } from '@/lib/supabase-server'
import { communityError, communityJson, HttpError, readCommunityJson } from '@/lib/community-http'

export async function POST(request: Request) {
  try {
    const input = await readCommunityJson(request)
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.')
    const captchaToken = typeof input.captchaToken === 'string' ? input.captchaToken : undefined
    if (captchaToken && captchaToken.length > 4096) throw new HttpError(400, 'Complete the sign-in security check again.')
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken) throw new HttpError(400, 'Complete the sign-in security check.', 'captcha_required')
    const client = await createCommunityClient()
    if (!client) throw new HttpError(503, 'Email sign-in is not connected yet.', 'unavailable')
    if ((await communityUser(client))?.is_anonymous === true) throw new HttpError(409, 'Use a separate browser profile for moderator sign-in. This keeps your guest questions and replies here.', 'guest_session_active')
    const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true, ...(captchaToken ? { captchaToken } : {}) } })
    if (error) throw new HttpError(error.status === 429 ? 429 : 503, error.status === 429 ? 'Please wait before requesting another code.' : 'A code could not be sent. Please try again later.', 'sign_in_unavailable')
    return communityJson({ ok: true })
  } catch (error) { return communityError(error) }
}
