import type { Destination } from './types'

export type CategoryId =
  | 'best-now'
  | 'weekend'
  | 'near-seoul'
  | 'food'
  | 'nature'
  | 'beach'
  | 'mountains'
  | 'culture'
  | 'low-crowd'

export const KOREAN_NAMES: Record<string, string> = {
  seoul: '서울', busan: '부산', jeju: '제주', gyeongju: '경주', jeonju: '전주',
  gangneung: '강릉', sokcho: '속초', tongyeong: '통영', namhae: '남해', jirisan: '지리산',
}

export const REGIONS: Record<string, string> = {
  seoul:     'Capital region',
  busan:     'South coast',
  jeju:      'Jeju Island',
  gyeongju:  'North Gyeongsang',
  jeonju:    'North Jeolla',
  gangneung: 'East coast',
  sokcho:    'East coast · Seoraksan',
  tongyeong: 'South coast islands',
  namhae:    'South coast · island',
  jirisan:   'Mountain inland',
}

export const DAILY_AVG: Record<string, string> = {
  seoul: '₩155k', busan: '₩140k', jeju: '₩210k',
  gyeongju: '₩110k', jeonju: '₩105k', gangneung: '₩140k',
  sokcho: '₩130k', tongyeong: '₩100k', namhae: '₩120k',
  jirisan: '₩95k',
}

// x, y = % position within korea-map.png (398×494)
export const MAP_POS: Record<string, { x: number; y: number }> = {
  seoul:     { x: 35, y: 20 },
  sokcho:    { x: 52, y:  8 },
  gangneung: { x: 57, y: 17 },
  jeonju:    { x: 37, y: 54 },
  jirisan:   { x: 43, y: 62 },
  gyeongju:  { x: 67, y: 52 },
  busan:     { x: 61, y: 64 },
  tongyeong: { x: 46, y: 67 },
  namhae:    { x: 43, y: 68 },
  jeju:      { x: 20, y: 93 },
}

export const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: 'best-now',   label: 'Best now',   icon: 'spark' },
  { id: 'weekend',    label: 'Weekend',    icon: 'calendar' },
  { id: 'near-seoul', label: 'Near Seoul', icon: 'train' },
  { id: 'food',       label: 'Food',       icon: 'food' },
  { id: 'nature',     label: 'Nature',     icon: 'leaf' },
  { id: 'beach',      label: 'Beach',      icon: 'wave' },
  { id: 'mountains',  label: 'Mountains',  icon: 'mountain' },
  { id: 'culture',    label: 'Culture',    icon: 'landmark' },
  { id: 'low-crowd',  label: 'Low crowd',  icon: 'people' },
]

export const SECTION_COPY: Record<CategoryId, { h: string; s: string }> = {
  'best-now':   { h: 'Best places in Korea right now',    s: 'Ranked by season, weather, crowd level and travel time.' },
  'weekend':    { h: 'Weekend escapes',                   s: 'Short trips that work well in one or two days.' },
  'near-seoul': { h: 'Close to Seoul',                   s: 'Reachable in roughly two hours or less.' },
  'food':       { h: 'Where to eat well',                s: 'Cities worth traveling for the food alone.' },
  'nature':     { h: 'Into nature',                      s: 'Coast, forest and mountain escapes.' },
  'beach':      { h: 'On the coast',                     s: 'Beaches, harbors and sea air.' },
  'mountains':  { h: 'For the mountains',                s: 'Trails, ridges and altitude.' },
  'culture':    { h: 'Historic Korea',                   s: 'Heritage, hanok and old capitals.' },
  'low-crowd':  { h: 'Quietest right now',               s: 'Low-crowd places to skip the rush.' },
}

export function matchesCategory(d: Destination, cat: CategoryId): boolean {
  switch (cat) {
    case 'best-now':   return true
    case 'weekend':    return d.recommended_stay === '1–2 days'
    case 'near-seoul': return ['seoul', 'gangneung', 'jeonju', 'sokcho', 'gyeongju'].includes(d.slug)
    case 'food':       return ['jeonju', 'busan', 'seoul'].includes(d.slug)
    case 'nature':     return d.tags.includes('nature')
    case 'beach':      return d.tags.includes('coastal')
    case 'mountains':  return d.tags.includes('mountain / hiking')
    case 'culture':    return d.tags.includes('history / traditional')
    case 'low-crowd':  return d.crowd_friction === 'Low'
    default:           return true
  }
}
