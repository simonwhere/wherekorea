import { seongsu } from './seongsu'
import { hwangnidan } from './hwangnidan'
import { hanok, hanokBreakfast } from './hanok'
import { gwangalli, nampo, jeonpo } from './busan'
import { centralEastWalks } from './central-east'
import { heritageWalks } from './heritage'
import { southCoastWalks } from './south-coast'

export const walks = [
  seongsu, hwangnidan, hanokBreakfast, hanok, gwangalli, nampo, jeonpo,
  ...centralEastWalks, ...heritageWalks, ...southCoastWalks,
]
export function findWalk(slug: string) {
  return walks.find(walk => walk.slug === slug)
}
