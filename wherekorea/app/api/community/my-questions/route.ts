import { readCommunityPage } from '@/lib/community-live'
import { communityError, communityJson } from '@/lib/community-http'
import { requireLiveCommunity, rpcCommunity } from '@/lib/community-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const page = readCommunityPage(new URL(request.url).searchParams.get('page'))
    const { client, user } = await requireLiveCommunity()
    const result = await rpcCommunity<Record<string, unknown>>(client, 'community_my_questions', { p_page: page })
    return communityJson({ ...result, viewerId: user.id })
  } catch (error) { return communityError(error) }
}
