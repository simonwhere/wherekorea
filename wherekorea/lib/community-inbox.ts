import { CommunityInputError, isCommunityUuid } from '@/lib/community-live'

export interface CommunityOwnQuestion {
  id: string
  city: string
  title: string
  createdAt: string
  commentCount: number
}

export interface CommunityReplyNotification {
  id: string
  questionId: string
  commentId: string
  city: string
  questionTitle: string
  authorName: string
  createdAt: string
  readAt: string | null
}

export interface CommunityNotificationsResult {
  viewerId: string
  notifications: CommunityReplyNotification[]
  hasMore: boolean
  unreadCount: number
}

export function validateNotificationIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50 || !value.every(isCommunityUuid)) {
    throw new CommunityInputError('Choose between 1 and 50 reply notifications.')
  }
  return [...new Set(value.map(id => id.toLowerCase()))]
}
