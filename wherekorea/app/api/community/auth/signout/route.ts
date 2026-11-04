import { communityUser, createCommunityClient } from '@/lib/supabase-server'
import { communityError, communityJson, HttpError, readCommunityJson } from '@/lib/community-http'

export async function POST(request: Request) {
  try {
    const input = await readCommunityJson(request)
    const client = await createCommunityClient()
    if (!client) return communityJson({ ok: true })
    const user = await communityUser(client)
    if ((user?.id ?? null) !== input.expectedUserId) throw new HttpError(409, 'Your browser profile changed. Check it before continuing.', 'session_changed')
    if (user?.is_anonymous === true && input.confirmation !== 'FORGET THIS BROWSER PROFILE') throw new HttpError(400, 'Confirm that you will lose access to your questions and replies.', 'confirmation_required')
    const { error } = await client.auth.signOut({ scope: 'local' })
    if (error) throw new HttpError(503, 'Sign-out could not be completed. Try again.', 'sign_out_failed')
    return communityJson({ ok: true })
  } catch (error) { return communityError(error) }
}
