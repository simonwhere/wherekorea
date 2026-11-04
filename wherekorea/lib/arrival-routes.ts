import type { ArrivalCard } from '@/data/arrival/types'

export function hasArrivalCard(slug: string): slug is ArrivalCard['slug'] {
  return slug === 'andong' || slug === 'gyeongju' || slug === 'jeonju'
}

export function arrivalPath(slug: ArrivalCard['slug']) {
  return `/from-seoul/${slug}`
}
