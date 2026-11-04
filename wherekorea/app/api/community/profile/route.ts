import { CommunityInputError, validateProfileInput } from '@/lib/community-live'
import { communityError, communityJson, HttpError, readCommunityJson } from '@/lib/community-http'
import { requireLiveCommunity, rpcCommunity } from '@/lib/community-server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await readCommunityJson(request)
    const input = validateProfileInput(body)
    const { client, user } = await requireLiveCommunity()
    if (body.expectedUserId !== user.id) throw new HttpError(409, 'Your browser profile changed. Check it before saving.', 'session_changed')
    const profile = await rpcCommunity(client, 'community_set_profile', { p_display_name: input.displayName, p_accepted_guidelines: input.acceptedGuidelines })
    return communityJson({ profile })
  } catch (error) { return communityError(error) }
}

export async function DELETE(request: Request) {
  try {
    const input = await readCommunityJson(request)
    if (input.confirmation !== 'DELETE MY COMMUNITY DATA') throw new CommunityInputError('Type DELETE MY COMMUNITY DATA to confirm.')
    const { client, user } = await requireLiveCommunity()
    if (input.expectedUserId !== user.id) throw new HttpError(409, 'Your browser profile changed. Check it before deleting data.', 'session_changed')
    return communityJson(await rpcCommunity(client, 'community_delete_my_data', { p_confirmation: input.confirmation }))
  } catch (error) { return communityError(error) }
}
