/** Same cache contract as public/walk-offline-worker.js. The only cached
 * resources are the public walking directions and their renderer. */
const CACHE = 'wherekorea-offline-walks-v1'
const SHELL = '/offline/walks'
const SCREEN = '/walk-offline-screen.js'
const WORKER = '/walk-offline-worker.js?v=2'
const TIMEOUT = 15_000

function isReady(registration?: ServiceWorkerRegistration) {
  return registration?.active?.state === 'activated'
    && registration.active.scriptURL === new URL(WORKER, location.origin).href
}

async function hasOfflineWalk(slug: string): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('caches' in window)) return false
    const [registration, shell, screen] = await Promise.all([
      navigator.serviceWorker.getRegistration('/'),
      caches.match(SHELL, { cacheName: CACHE }),
      caches.match(SCREEN, { cacheName: CACHE }),
    ])
    return isReady(registration) && shell?.headers.get('X-WhereKorea-Offline') === '1'
      && Boolean(shell.headers.get('X-WhereKorea-Walk-Slugs')?.split(',').includes(slug))
      && Boolean(screen?.headers.get('Content-Type')?.includes('javascript'))
  } catch { return false }
}

async function prepare() {
  if (!('serviceWorker' in navigator) || !('caches' in window)) {
    throw new Error('Offline storage is unavailable in this browser.')
  }
  let registration = await navigator.serviceWorker.getRegistration('/')
  if (!isReady(registration)) {
    registration = await navigator.serviceWorker.register(WORKER, { scope: '/' })
    const worker = registration.installing ?? registration.waiting ?? registration.active
    if (!worker || worker.scriptURL !== new URL(WORKER, location.origin).href) {
      throw new Error('The offline reader could not start.')
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => finish(false), TIMEOUT)
      function finish(ready: boolean) {
        clearTimeout(timer)
        worker?.removeEventListener('statechange', changed)
        if (ready) resolve()
        else reject(new Error('The offline reader could not start.'))
      }
      function changed() {
        if (worker?.state === 'activated') finish(true)
        if (worker?.state === 'redundant') finish(false)
      }
      worker.addEventListener('statechange', changed)
      changed()
    })
  }

  const cache = await caches.open(CACHE)
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), TIMEOUT)
  try {
    // addAll is atomic: a failed refresh leaves the last complete snapshot intact.
    await cache.addAll([SHELL, SCREEN].map(url => new Request(url, {
      credentials: 'omit', redirect: 'error', cache: 'reload', signal: abort.signal,
    })))
  } finally { clearTimeout(timer) }
}

let inProgress: Promise<void> | undefined

export async function prepareOfflineWalks(slug: string) {
  if (!inProgress) inProgress = prepare().finally(() => { inProgress = undefined })
  try { await inProgress } catch (error) {
    if (!await hasOfflineWalk(slug)) throw error
    return
  }
  if (!await hasOfflineWalk(slug)) throw new Error('Offline directions could not be stored.')
}
