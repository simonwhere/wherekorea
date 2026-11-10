// Also loaded by the offline reader. One local cohort per walk and action;
// only its random event key, slug, action and Korea calendar days leave the browser.
const cohortStore = 'cohorts'
const outboxStore = 'outbox'
let opening

function database() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const request = indexedDB.open('wherekorea-walk-metrics', 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore(cohortStore, { keyPath: ['walk', 'source'] })
        request.result.createObjectStore(outboxStore, { keyPath: ['id', 'event'] })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    }).catch(error => { opening = undefined; throw error })
  }
  return opening
}

function privacyEnabled() {
  return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1'
}

function koreaDay() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}

async function transact(stores, mode, work) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode)
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error)
    work(tx)
  })
}

function enrol(tx, walk, source, day) {
  const cohort = { id: crypto.randomUUID(), walk, source, cohortDay: day }
  tx.objectStore(cohortStore).add(cohort)
  tx.objectStore(outboxStore).add({ version: 1, ...cohort, event: 'start', day })
}

export function recordWalkAction(walk, source) {
  if (privacyEnabled() || (source !== 'save' && source !== 'share')) return
  const day = koreaDay()
  void transact([cohortStore, outboxStore], 'readwrite', tx => {
    const existing = tx.objectStore(cohortStore).get([walk, source])
    existing.onsuccess = () => { if (!existing.result) enrol(tx, walk, source, day) }
  }).then(flushWalkMetrics).catch(() => {})
}

function recordOpen(walk, shared, saved) {
  if (privacyEnabled()) return
  const day = koreaDay()
  void transact([cohortStore, outboxStore], 'readwrite', tx => {
    const cohorts = tx.objectStore(cohortStore)
    const rows = cohorts.getAll(IDBKeyRange.bound([walk, ''], [walk, '\uffff']))
    rows.onsuccess = () => {
      // Opening your own share link is not an additional recipient.
      if (shared && !rows.result.some(row => row.source === 'share' || row.source === 'shared_link')) {
        enrol(tx, walk, 'shared_link', day)
      }
      for (const row of rows.result) {
        if (row.returnDay || day <= row.cohortDay || (row.source === 'save' && !saved)) continue
        tx.objectStore(outboxStore).add({ version: 1, ...row, event: 'return', day })
        cohorts.put({ ...row, returnDay: day })
      }
    }
  }).then(flushWalkMetrics).catch(() => {})
}

// Count an actual visible opening, including history restoration. Merely
// keeping a tab open overnight and foregrounding it is not another opening.
export function watchWalkOpening(walk, shared, isSaved) {
  let pending = true
  function observe() {
    if (!pending || document.visibilityState !== 'visible') return
    pending = false
    let saved = false
    try { saved = isSaved() } catch { /* A broken bookmark must not block the guide. */ }
    recordOpen(walk, shared, saved)
  }
  function restore(event) {
    if (event.persisted) { pending = true; observe() }
  }
  document.addEventListener('visibilitychange', observe)
  window.addEventListener('pageshow', restore)
  observe()
  return () => {
    document.removeEventListener('visibilitychange', observe)
    window.removeEventListener('pageshow', restore)
  }
}

let flushing = false
let requested = false
let retryTimer
let retryDelay = 30_000

async function flushWalkMetrics() {
  if (privacyEnabled() || !navigator.onLine) return
  requested = true
  if (flushing) return
  flushing = true
  try {
    do {
      requested = false
      let events = []
      await transact(outboxStore, 'readonly', tx => {
        const pending = tx.objectStore(outboxStore).getAll()
        pending.onsuccess = () => { events = pending.result }
      })
      // Offline, both rows may be pending when the browser next reconnects.
      events.sort((a, b) => Number(a.event === 'return') - Number(b.event === 'return'))
      for (const event of events) {
        const result = await fetch('/api/walk-metrics', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error',
          body: JSON.stringify(event), keepalive: true,
        })
        // 204 is the collector's durable acknowledgement. A permanently
        // rejected row must not prevent the other rows from being sent.
        if (result.status !== 204 && ![400, 403, 413, 415].includes(result.status)) {
          throw new Error('Metrics unavailable')
        }
        await transact(outboxStore, 'readwrite', tx => {
          tx.objectStore(outboxStore).delete([event.id, event.event])
        })
      }
    } while (requested)
    clearTimeout(retryTimer)
    retryTimer = undefined
    retryDelay = 30_000
  } catch {
    if (!retryTimer) {
      retryTimer = setTimeout(() => { retryTimer = undefined; void flushWalkMetrics() }, retryDelay)
      retryDelay = Math.min(retryDelay * 2, 300_000)
    }
  } finally { flushing = false }
}

export function connectWalkMetrics() {
  if (privacyEnabled()) return () => {}
  window.addEventListener('online', flushWalkMetrics)
  window.addEventListener('pageshow', flushWalkMetrics)
  void flushWalkMetrics()
  return () => {
    window.removeEventListener('online', flushWalkMetrics)
    window.removeEventListener('pageshow', flushWalkMetrics)
  }
}
