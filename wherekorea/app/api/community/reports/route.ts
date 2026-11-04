import { validateReportInput } from '@/lib/community-live'
import { communityError, communityJson, readCommunityJson } from '@/lib/community-http'
import { requireLiveCommunity, rpcCommunity } from '@/lib/community-server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const input = validateReportInput(await readCommunityJson(request))
    const { client } = await requireLiveCommunity()
    return communityJson(await rpcCommunity(client, 'community_report', {
      p_id: input.id, p_question_id: input.questionId, p_comment_id: input.commentId, p_reason: input.reason, p_details: input.details,
    }))
  } catch (error) { return communityError(error) }
}
