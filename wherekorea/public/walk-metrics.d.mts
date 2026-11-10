export function recordWalkAction(walk: string, source: 'save' | 'share'): void
export function watchWalkOpening(walk: string, shared: boolean, isSaved: () => boolean): () => void
export function connectWalkMetrics(): () => void
