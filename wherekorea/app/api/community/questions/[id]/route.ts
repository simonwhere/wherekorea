import { CommunityInputError, isCommunityUuid, readCommunityPage } from '@/lib/community-live'
import { communityError, communityJson, readCommunityJson } from '@/lib/community-http'
import { liveCommunityReader, requireLiveCommunity, rpcCommunity } from '@/lib/community-server'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params
    if (!isCommunityUuid(id)) return communityJson({ error: 'This question is not available.', code: 'not_found' }, 404)
    const page = readCommunityPage(new URL(request.url).searchParams.get('page'))
    return communityJson(await rpcCommunity(await liveCommunityReader(), 'community_get_question', { p_id: id, p_page: page }))
  } catch (error) { return communityError(error) }
}

export async function DELETE(request: Request, context: Context) {
  try {
    await readCommunityJson(request)
    const { id } = await context.params
    if (!isCommunityUuid(id)) throw new CommunityInputError('Choose a valid question.')
    const { client } = await requireLiveCommunity()
    return communityJson(await rpcCommunity(client, 'community_delete_question', { p_id: id }))
  } catch (error) { return communityError(error) }
}
