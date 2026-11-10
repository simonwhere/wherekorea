/* Let a traveller reopen their saved walks from the site address, too.
   Only handle these public document navigations. Never intercept API, RSC,
   third-party tiles, community, or account requests. No personalized responses
   are written by this worker. */
const WALK_CACHE = 'wherekorea-offline-walks-v1'
const WALK_SHELL = '/offline/walks'
const WALK_SCRIPT = '/walk-offline-screen.js'
const WALK_METRICS = '/walk-metrics.mjs'

self.addEventListener('install', event => { event.waitUntil(self.skipWaiting()) })
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()) })

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (request.destination === 'script' && [WALK_SCRIPT, WALK_METRICS].includes(url.pathname) && !url.search) {
    event.respondWith(caches.match(url.pathname, { cacheName: WALK_CACHE }).then(saved => saved || fetch(request)))
    return
  }
  if (request.mode !== 'navigate' || request.headers.has('rsc') || url.searchParams.has('_rsc')) return
  const walkSlug = /^\/walks\/([a-z0-9-]+)\/?$/.exec(url.pathname)?.[1]
  if (!walkSlug && url.pathname !== '/' && !/^\/saved\/?$/.test(url.pathname)) return

  event.respondWith((async () => {
    let unavailable
    try {
      const result = await fetch(request)
      if (result.status < 500) return result
      unavailable = result
    } catch { /* A cold offline navigation still needs to open. */ }
    try {
      const cache = await caches.open(WALK_CACHE)
      const [shell, script] = await Promise.all([cache.match(WALK_SHELL), cache.match(WALK_SCRIPT)])
      // Older saved guides have no slug header and contain the original three walks.
      const supported = shell?.headers.get('X-WhereKorea-Walk-Slugs') ?? 'seongsu,hwangnidan,hanok'
      if (shell && script && (!walkSlug || supported.split(',').includes(walkSlug))) return shell
    } catch { /* Storage may have been cleared or disabled. */ }
    return unavailable || new Response('Offline directions are unavailable. Reconnect and save this walk for offline use.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  })())
})
