/** A comment survives an explicitly requested sign-in redirect in this tab only. */
const PREFIX = 'wherekorea:comment-handoff:'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TTL = 60 * 60 * 1000

export type CommentHandoff = { body: string; requestId: string; ownerId: string | null; savedAt: number }
type CommentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function saveCommentHandoff(storage: CommentStorage, questionId: string, draft: CommentHandoff): void {
  if (!UUID.test(questionId) || !UUID.test(draft.requestId) || draft.body.trim().length < 2 || draft.body.length > 2000 || !Number.isFinite(draft.savedAt) || (draft.ownerId !== null && !UUID.test(draft.ownerId))) throw new Error('This comment could not be saved for sign-in.')
  try { storage.setItem(PREFIX + questionId, JSON.stringify(draft)) }
  catch { throw new Error('This tab could not save your comment. Copy your text before signing in, then try again.') }
}

export function loadCommentHandoff(storage: CommentStorage, questionId: string, userId: string | null, now = Date.now()): CommentHandoff | null {
  if (!UUID.test(questionId)) return null
  try {
    const raw = storage.getItem(PREFIX + questionId)
    if (!raw || raw.length > 15_000) return null
    const draft = JSON.parse(raw)
    if (!draft || typeof draft.body !== 'string' || draft.body.trim().length < 2 || draft.body.length > 2000 || !UUID.test(draft.requestId) || !Number.isFinite(draft.savedAt) || draft.savedAt > now || now - draft.savedAt > TTL || (draft.ownerId !== null && draft.ownerId !== userId)) return null
    return { body: draft.body, requestId: draft.requestId, ownerId: draft.ownerId, savedAt: draft.savedAt }
  } catch { return null }
}

export function clearCommentHandoff(storage: CommentStorage, questionId: string): void {
  try { storage.removeItem(PREFIX + questionId) } catch { /* A posted comment remains posted if local cleanup fails. */ }
}

/** Bind a signed-out handoff on first authenticated restoration, never another account. */
export function claimCommentHandoff(storage: CommentStorage, questionId: string, userId: string | null, now = Date.now()): CommentHandoff | null {
  const draft = loadCommentHandoff(storage, questionId, userId, now)
  if (!draft || !userId || draft.ownerId !== null) return draft
  try {
    const claimed = { ...draft, ownerId: userId }
    saveCommentHandoff(storage, questionId, claimed)
    return claimed
  } catch { return null }
}
