import { CommunityInputError, isCommunityUuid } from '@/lib/community-live'
import { communityError, communityJson, readCommunityJson } from '@/lib/community-http'
import { requireLiveCommunity, rpcCommunity } from '@/lib/community-server'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string; commentId: string }> }

export async function DELETE(request: Request, context: Context) {
  try {
    await readCommunityJson(request)
    const { id, commentId } = await context.params
    if (!isCommunityUuid(id) || !isCommunityUuid(commentId)) throw new CommunityInputError('Choose a valid comment.')
    const { client } = await requireLiveCommunity()
    return communityJson(await rpcCommunity(client, 'community_delete_comment', { p_id: commentId, p_question_id: id }))
  } catch (error) { return communityError(error) }
}
