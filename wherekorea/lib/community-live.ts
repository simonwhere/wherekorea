import { isCommunityCity } from '@/lib/community'

export interface CommunityProfile {
  displayName: string
  acceptedGuidelines: boolean
  banned: boolean
  moderator: boolean
}

export interface CommunityQuestion {
  id: string
  city: string
  title: string
  body: string
  authorId: string
  authorName: string
  createdAt: string
  owned: boolean
  commentCount: number
}

export interface CommunityComment {
  id: string
  questionId: string
  body: string
  authorId: string
  authorName: string
  createdAt: string
  owned: boolean
}

export interface CommunityBlock { userId: string; displayName: string; createdAt: string }
export type CommunityReportReason = 'spam' | 'harassment' | 'personal_information' | 'unsafe' | 'other'
export interface CommunityModerationReport {
  id: string
  questionId: string | null
  commentId: string | null
  reason: CommunityReportReason
  details: string
  createdAt: string
  status: 'open' | 'resolved'
  title: string | null
  body: string
  authorId: string
  authorName: string
  contentStatus: 'published' | 'hidden' | 'deleted'
}

export class CommunityInputError extends Error {
  constructor(message: string) { super(message); this.name = 'CommunityInputError' }
}

export function isCommunityUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function uuid(value: unknown): string {
  if (!isCommunityUuid(value)) throw new CommunityInputError('Reload the page and try again.')
  return value.toLowerCase()
}

function plain(value: unknown, min: number, max: number, label: string): string {
  if (typeof value !== 'string') throw new CommunityInputError(`Enter ${label}.`)
  const normalized = value.trim().replace(/\r\n?/g, '\n')
  // Plain text, not HTML: markup characters are retained and must be React-escaped.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized) || normalized.length < min || normalized.length > max) {
    throw new CommunityInputError(`Keep ${label} between ${min} and ${max.toLocaleString('en-US')} characters.`)
  }
  return normalized
}

export function readCommunityPage(value: string | null): number {
  if (value === null) return 1
  if (!/^[1-9]\d{0,3}$/.test(value) || Number(value) > 1000) throw new CommunityInputError('Choose a valid page.')
  return Number(value)
}

export function validateQuestionInput(input: Record<string, unknown>) {
  if (!isCommunityCity(input.city)) throw new CommunityInputError('Choose a destination.')
  return { id: uuid(input.id), city: input.city, title: plain(input.title, 5, 140, 'the title'), body: plain(input.body, 10, 3000, 'the question') }
}

export function validateCommentInput(input: Record<string, unknown>) {
  return { id: uuid(input.id), body: plain(input.body, 2, 2000, 'the comment') }
}

export function validateProfileInput(input: Record<string, unknown>) {
  const displayName = plain(input.displayName, 2, 40, 'the display name')
  if (/[\r\n\t@<>]/.test(displayName) || /https?:\/\//i.test(displayName)) throw new CommunityInputError('Use a display name without contact details or links.')
  const identity = displayName.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (identity.includes('wherekorea') || ['admin', 'administrator', 'moderator', 'support'].includes(identity)) {
    throw new CommunityInputError('Choose a display name that does not imply a team or support role.')
  }
  if (input.acceptedGuidelines !== true) throw new CommunityInputError('Read and accept the community guidelines.')
  return { displayName, acceptedGuidelines: true as const }
}

export function validateReportInput(input: Record<string, unknown>) {
  const reasons: readonly unknown[] = ['spam', 'harassment', 'personal_information', 'unsafe', 'other']
  if (!reasons.includes(input.reason)) throw new CommunityInputError('Choose a report reason.')
  const questionId = input.questionId === undefined || input.questionId === null ? null : uuid(input.questionId)
  const commentId = input.commentId === undefined || input.commentId === null ? null : uuid(input.commentId)
  if (Boolean(questionId) === Boolean(commentId)) throw new CommunityInputError('Choose one question or comment to report.')
  return {
    id: uuid(input.id), questionId, commentId, reason: input.reason as CommunityReportReason,
    details: input.details === undefined || input.details === '' ? '' : plain(input.details, 0, 1000, 'the report details'),
  }
}
