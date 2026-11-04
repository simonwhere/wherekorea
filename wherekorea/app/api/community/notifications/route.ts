import { readCommunityPage } from '@/lib/community-live'
import { validateNotificationIds } from '@/lib/community-inbox'
import { communityError, communityJson, HttpError, readCommunityJson } from '@/lib/community-http'
import { requireLiveCommunity, rpcCommunity } from '@/lib/community-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const page = readCommunityPage(new URL(request.url).searchParams.get('page'))
    const { client, user } = await requireLiveCommunity()
    const result = await rpcCommunity<Record<string, unknown>>(client, 'community_notifications', { p_page: page })
    return communityJson({ ...result, viewerId: user.id })
  } catch (error) { return communityError(error) }
}

export async function POST(request: Request) {
  try {
    const input = await readCommunityJson(request)
    const ids = validateNotificationIds(input.ids)
    const { client, user } = await requireLiveCommunity()
    if (input.expectedUserId !== user.id) throw new HttpError(409, 'Your browser profile changed. Reload before marking replies as read.', 'session_changed')
    const result = await rpcCommunity<Record<string, unknown>>(client, 'community_read_notifications', { p_ids: ids })
    return communityJson({ ...result, viewerId: user.id })
  } catch (error) { return communityError(error) }
}
