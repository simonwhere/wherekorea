import { communityUser, createCommunityClient } from '@/lib/supabase-server'
import { getCommunityConfig } from '@/lib/community-config'
import { communityError, communityJson, HttpError } from '@/lib/community-http'

export async function GET() {
  try {
    const config = getCommunityConfig()
    const client = await createCommunityClient()
    const empty = { configured: config.configured, googleEnabled: config.googleEnabled, guestEnabled: false, postingEnabled: false, meetupsReady: false, meetupPostingEnabled: false, user: null, profileReady: false, moderator: false }
    if (!client) return communityJson(empty)
    const { data: state, error: stateError } = await client.rpc('community_status')
    if (stateError) throw new HttpError(503, 'The community connection is not ready. You can still keep a draft.', 'unavailable')
    const postingEnabled = config.postingEnabled && state?.postingEnabled === true
    const guestEnabled = config.guestEnabled && state?.guestEnabled === true && state?.guestSchemaVersion === 1
    const meetupsReady = state?.meetupSchemaVersion === 1
    const meetupOpen = meetupsReady && state?.meetupPostingEnabled === true
    const user = await communityUser(client)
    if (!user) return communityJson({ ...empty, guestEnabled, meetupsReady, meetupPostingEnabled: postingEnabled && guestEnabled && meetupOpen, postingEnabled: postingEnabled && guestEnabled })
    const { data: profile, error: profileError } = await client.rpc('community_get_profile')
    if (profileError) throw new HttpError(503, 'Your community profile could not be loaded. Try again.', 'unavailable')
    const isGuest = user.is_anonymous === true
    const canPost = postingEnabled && !profile?.banned && (!isGuest || guestEnabled)
    return communityJson({ configured: true, googleEnabled: config.googleEnabled, guestEnabled, postingEnabled: canPost, meetupsReady, meetupPostingEnabled: canPost && meetupOpen, user: { id: user.id, displayName: profile?.displayName || null, isGuest }, profileReady: !!profile?.acceptedGuidelines && !profile?.banned, moderator: !isGuest && profile?.moderator === true })
  } catch (error) { return communityError(error) }
}
