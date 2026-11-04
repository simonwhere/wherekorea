import { getOfficialLinks, type OfficialTravelLink } from './official-links'
import type { CommunityType } from '@/lib/community'

export interface TeamPost {
  id: string
  city: string
  type: 'questions'
  title: string
  excerpt: string
  paragraphs: string[]
  publishedAt: string
  author: 'WhereKorea team'
  links: readonly OfficialTravelLink[]
}

// Written by WhereKorea, not traveler submissions or evidence of community activity.
// Publication dates refer to these guides, not a new route or price verification.
export const COMMUNITY_POSTS: readonly TeamPost[] = [
  {
    id: 'jeonju-arrival-checks', city: 'jeonju', type: 'questions',
    title: 'Getting from your arrival station to Jeonju Hanok Village',
    excerpt: 'Check the arrival stop and the local connection separately from the intercity journey.',
    paragraphs: [
      'Jeonju Station and the bus terminals are separate arrival points. Check which one your ticket uses before looking up the route to Hanok Village.',
      'Use the city guide for local transport information, then confirm the current bus route or taxi journey for your arrival point. The intercity travel time on WhereKorea does not include this final connection.',
      'For the return journey, check the departure station or terminal and allow time to reach it. This guide does not confirm a timetable, fare or available seat.',
    ],
    publishedAt: '2026-10-17', author: 'WhereKorea team', links: getOfficialLinks('jeonju'),
  },
  {
    id: 'andong-return-connections', city: 'andong', type: 'questions',
    title: 'Checking the onward and return journey in Andong',
    excerpt: 'Reaching Andong and reaching an outlying village are different legs of the trip.',
    paragraphs: [
      'Hahoe Village and the Confucian academies are outside central Andong. Check the onward connection from your arrival point rather than treating arrival in Andong as arrival at the sight.',
      'Village buses can be infrequent. Check both the outbound and return departures for the day of travel, including the stop location and the last usable connection.',
      'The official city guide is a starting point for directions. Confirm current services before leaving; the journey estimates on WhereKorea do not confirm a same-day return or a reserved seat.',
    ],
    publishedAt: '2026-10-17', author: 'WhereKorea team', links: getOfficialLinks('andong'),
  },
  {
    id: 'seoul-daily-estimate', city: 'seoul', type: 'questions',
    title: 'What the daily cost estimate includes',
    excerpt: 'A per-person planning amount, including a share of a room—not a room quote for your dates.',
    paragraphs: [
      'The daily estimate combines half of a mid-range room shared by two people, meals, local transport and light admissions. It is an approximate amount per person.',
      'Intercity travel, flights, shopping and heavy nightlife are not included. A private room used by one person is not covered by the shared-room assumption.',
      'Use the destination cost section to compare the same basket across places. Check accommodation prices for your dates separately, and consult the official transport guide for current fares and ticket conditions.',
    ],
    publishedAt: '2026-10-17', author: 'WhereKorea team', links: getOfficialLinks('seoul').filter((link) => link.label.includes('transport')),
  },
]

export function getCommunityPost(id: string): TeamPost | undefined {
  return COMMUNITY_POSTS.find((post) => post.id === id)
}

export function getCommunityPosts(type: CommunityType, city: string): readonly TeamPost[] {
  return COMMUNITY_POSTS.filter((post) => post.type === type && (city === 'all' || post.city === city))
}
