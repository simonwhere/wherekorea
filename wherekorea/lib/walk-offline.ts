/** Same cache contract as public/walk-offline-worker.js. The only cached
 * resources are a public text guide for the three walks and its renderer. */
const CACHE = 'wherekorea-offline-walks-v1'
const SHELL = '/offline/walks'
const SCREEN = '/walk-offline-screen.js'
const WORKER = '/walk-offline-worker.js'
const TIMEOUT = 15_000

function isReady(registration?: ServiceWorkerRegistration) {
  return registration?.active?.scriptURL === new URL(WORKER, location.origin).href
}

export async function hasOfflineWalks(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('caches' in window)) return false
    const [registration, shell, screen] = await Promise.all([
      navigator.serviceWorker.getRegistration('/'),
      caches.match(SHELL, { cacheName: CACHE }),
      caches.match(SCREEN, { cacheName: CACHE }),
    ])
    return isReady(registration) && shell?.headers.get('X-WhereKorea-Offline') === '1'
      && Boolean(screen?.headers.get('Content-Type')?.includes('javascript'))
  } catch { return false }
}

async function prepare() {
  if (!('serviceWorker' in navigator) || !('caches' in window)) {
    throw new Error('Offline storage is unavailable in this browser.')
  }
  let registration = await navigator.serviceWorker.getRegistration('/')
  if (!isReady(registration)) {
    await navigator.serviceWorker.register(WORKER, { scope: '/' })
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Offline setup timed out.')), TIMEOUT) }),
      ])
    } finally { clearTimeout(timer) }
    if (!isReady(registration)) throw new Error('The offline reader could not start.')
  }

  const cache = await caches.open(CACHE)
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), TIMEOUT)
  try {
    // addAll is atomic: a failed refresh leaves the last complete snapshot intact.
    await cache.addAll([SHELL, SCREEN].map(url => new Request(url, {
      credentials: 'omit', redirect: 'error', cache: 'reload', signal: abort.signal,
    })))
  } catch (error) {
    if (!await hasOfflineWalks()) throw error
  } finally { clearTimeout(timer) }
  if (!await hasOfflineWalks()) throw new Error('Offline directions could not be stored.')
}

let inProgress: Promise<void> | undefined

export function prepareOfflineWalks() {
  if (!inProgress) inProgress = prepare().finally(() => { inProgress = undefined })
  return inProgress
}
