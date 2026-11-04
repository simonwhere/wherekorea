import { CommunityInputError, isCommunityUuid } from '@/lib/community-live'
import { communityError, communityJson, readCommunityJson } from '@/lib/community-http'
import { requireLiveCommunity, rpcCommunity } from '@/lib/community-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { client } = await requireLiveCommunity()
    return communityJson(await rpcCommunity(client, 'community_get_blocks'))
  } catch (error) { return communityError(error) }
}

async function setBlock(request: Request, blocked: boolean) {
  try {
    const input = await readCommunityJson(request)
    if (!isCommunityUuid(input.userId)) throw new CommunityInputError('Choose a valid community member.')
    const { client } = await requireLiveCommunity()
    return communityJson(await rpcCommunity(client, 'community_set_block', { p_user_id: input.userId, p_blocked: blocked }))
  } catch (error) { return communityError(error) }
}

export async function POST(request: Request) { return setBlock(request, true) }
export async function DELETE(request: Request) { return setBlock(request, false) }
