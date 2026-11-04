import { CommunityInputError, isCommunityUuid } from '@/lib/community-live'
import { communityError, communityJson, readCommunityJson } from '@/lib/community-http'
import { requireLiveCommunity, rpcCommunity } from '@/lib/community-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { client } = await requireLiveCommunity()
    return communityJson(await rpcCommunity(client, 'community_moderation_reports'))
  } catch (error) { return communityError(error) }
}

export async function POST(request: Request) {
  try {
    const input = await readCommunityJson(request)
    if (!isCommunityUuid(input.reportId) || typeof input.action !== 'string' || !['hide', 'resolve', 'ban'].includes(input.action)) throw new CommunityInputError('Choose a report and an action.')
    const { client } = await requireLiveCommunity()
    return communityJson(await rpcCommunity(client, 'community_moderate', { p_report_id: input.reportId, p_action: input.action }))
  } catch (error) { return communityError(error) }
}
