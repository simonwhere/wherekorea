import { seongsu } from './seongsu'
import { hwangnidan } from './hwangnidan'
import { hanok } from './hanok'
import { gwangalli, nampo, jeonpo } from './busan'

export const walks = [seongsu, hwangnidan, hanok, gwangalli, nampo, jeonpo]
export function findWalk(slug: string) {
  return walks.find(walk => walk.slug === slug)
}
