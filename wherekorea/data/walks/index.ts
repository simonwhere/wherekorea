import { seongsu } from './seongsu'
import { hwangnidan } from './hwangnidan'
import { hanok } from './hanok'

export const walks = [seongsu, hwangnidan, hanok]
export function findWalk(slug: string) {
  return walks.find(walk => walk.slug === slug)
}
