import { CommunityInputError, isCommunityUuid, validateCommentInput } from '@/lib/community-live'
import { communityError, communityJson, HttpError, readCommunityJson } from '@/lib/community-http'
import { requireLiveCommunity, rpcCommunity } from '@/lib/community-server'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const body = await readCommunityJson(request)
    const input = validateCommentInput(body)
    const { id } = await context.params
    if (!isCommunityUuid(id)) throw new CommunityInputError('Choose a valid question.')
    const { client, user } = await requireLiveCommunity({ posting: true })
    if (typeof body.expectedUserId !== 'string' || body.expectedUserId !== user.id) throw new HttpError(409, 'Your account changed. Nothing was posted. Review your account before continuing.', 'session_changed')
    const comment = await rpcCommunity(client, 'community_create_comment', { p_id: input.id, p_question_id: id, p_body: input.body })
    return communityJson({ comment }, 201)
  } catch (error) { return communityError(error) }
}
