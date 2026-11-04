const arrivalSlugs = ['andong', 'gyeongju', 'jeonju', 'sokcho', 'tongyeong', 'jeju', 'gangneung', 'yeosu', 'namhae'] as const
export type ArrivalSlug = typeof arrivalSlugs[number]

export function hasArrivalCard(slug: string): slug is ArrivalSlug {
  return arrivalSlugs.some(city => city === slug)
}

export function arrivalPath(slug: ArrivalSlug) {
  return `/from-seoul/${slug}`
}
