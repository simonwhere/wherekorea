// Which state a change builds on (pure; lib/store.tsx update()).
//
// update() reads the freshest saved state first, so a change the other tab
// saved a moment ago is kept. But when this tab's last save failed (storage
// full or blocked), storage is *behind* memory: building on it would silently
// drop the change that failed to save, and the next change would look as if
// the previous one never happened. Then memory is the truth.

/**
 * `stored` is what storage holds now, `latest` this tab's newest state,
 * `persisted` the state this tab last saved or loaded successfully.
 */
export function baseForUpdate<S>(stored: S | null, latest: S | null, persisted: S | null | undefined): S | null {
  if (persisted !== latest) return latest
  return stored ?? latest
}
