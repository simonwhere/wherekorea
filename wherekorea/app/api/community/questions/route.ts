import { isCommunityCity } from '@/lib/community'
import { CommunityInputError, readCommunityPage, validateQuestionInput } from '@/lib/community-live'
import { communityError, communityJson, HttpError, readCommunityJson } from '@/lib/community-http'
import { liveCommunityReader, requireLiveCommunity, rpcCommunity } from '@/lib/community-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const city = params.get('city') ?? 'all'
    if (city !== 'all' && !isCommunityCity(city)) throw new CommunityInputError('Choose a destination.')
    const page = readCommunityPage(params.get('page'))
    return communityJson(await rpcCommunity(await liveCommunityReader(), 'community_list_questions', { p_city: city, p_page: page }))
  } catch (error) { return communityError(error) }
}

export async function POST(request: Request) {
  try {
    const body = await readCommunityJson(request)
    const input = validateQuestionInput(body)
    const { client, user } = await requireLiveCommunity({ posting: true })
    // This is a stale-tab guard, not authorization: the trusted cookie still owns the RPC.
    if (typeof body.expectedUserId !== 'string' || body.expectedUserId !== user.id) throw new HttpError(409, 'Your account changed. Nothing was posted. Review your account before continuing.', 'session_changed')
    const question = await rpcCommunity(client, 'community_create_question', { p_id: input.id, p_city: input.city, p_title: input.title, p_body: input.body })
    return communityJson({ question }, 201)
  } catch (error) { return communityError(error) }
}
