'use client'

// Diary photos live in IndexedDB (localStorage is too small for images).
// Everything stays on this device in the prototype.
//
// Ids starting with 'builtin:' are the demo couple's drawn pictures
// (lib/content/demoPhotos.ts): they resolve from memory, so they work without
// IndexedDB (the single-file demo, private windows), and are never deleted.

import { BUILTIN_PHOTOS, builtinKey } from './content/demoPhotos'

const DB_NAME = 'dulset-photos'
const STORE = 'photos'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB()
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode)
      const req = run(t.objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined
  return c?.randomUUID ? c.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
}

/**
 * Downscale an image file to a JPEG (max `maxSide` px) so photos stay small.
 * Falls back to the original file if decoding fails.
 */
export async function downscaleImage(file: Blob, maxSide = 1280, quality = 0.82): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    return blob ?? file
  } catch {
    return file
  }
}

/** A built-in (demo) picture id — read-only, never stored in IndexedDB. */
export const isBuiltinPhoto = (id: string) => id.startsWith('builtin:')

export async function savePhoto(blob: Blob): Promise<string> {
  const id = newId()
  await tx('readwrite', (s) => s.put(blob, id))
  return id
}

export async function getPhotoBlob(id: string): Promise<Blob | null> {
  if (isBuiltinPhoto(id)) {
    const key = builtinKey(id)
    return key ? new Blob([BUILTIN_PHOTOS[key]], { type: 'image/svg+xml' }) : null
  }
  try {
    const v = await tx<unknown>('readonly', (s) => s.get(id))
    return v instanceof Blob ? v : null
  } catch {
    return null
  }
}

/** Object URL for an <img>. Callers must URL.revokeObjectURL when done. */
export async function getPhotoURL(id: string): Promise<string | null> {
  const blob = await getPhotoBlob(id)
  return blob ? URL.createObjectURL(blob) : null
}

/** data: URL — for exporting a self-contained HTML diary. */
export async function getPhotoDataURL(id: string): Promise<string | null> {
  const blob = await getPhotoBlob(id)
  if (!blob) return null
  return new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : null)
    r.onerror = () => resolve(null)
    r.readAsDataURL(blob)
  })
}

export async function deletePhoto(id: string): Promise<void> {
  if (isBuiltinPhoto(id)) return
  try {
    await tx('readwrite', (s) => s.delete(id))
  } catch {
    /* already gone */
  }
}

export async function clearAllPhotos(): Promise<void> {
  try {
    await tx('readwrite', (s) => s.clear())
  } catch {
    /* nothing stored */
  }
}

// ── Full backup (N16): photos out of and back into IndexedDB ───

export interface StoredPhoto {
  id: string
  /** MIME type as stored ('image/jpeg' for anything downscaleImage made). */
  type: string
  data: Uint8Array
}

/**
 * The photos this device still has among `ids`, as bytes for the backup
 * archive. Missing or unreadable ones are skipped (the entry keeps its id, so
 * the picture comes back on a device that has it). Built-in demo pictures are
 * never exported — they ship with the app.
 */
export async function exportPhotos(ids: readonly string[], onProgress?: (done: number, total: number) => void): Promise<StoredPhoto[]> {
  const out: StoredPhoto[] = []
  let done = 0
  for (const id of ids) {
    if (!isBuiltinPhoto(id)) {
      const blob = await getPhotoBlob(id)
      if (blob) {
        try {
          out.push({ id, type: blob.type || 'image/jpeg', data: new Uint8Array(await blob.arrayBuffer()) })
        } catch {
          /* unreadable blob — leave it out */
        }
      }
    }
    done++
    onProgress?.(done, ids.length)
  }
  return out
}

/** Store a photo under a known id (restore). Built-in ids are read-only and ignored. */
export async function putPhoto(id: string, blob: Blob): Promise<void> {
  if (isBuiltinPhoto(id)) return
  await tx('readwrite', (s) => s.put(blob, id))
}

/**
 * Put backed-up photos back under their ids, so the restored diary and cover
 * find them. Returns how many landed; a device without IndexedDB (private
 * window) restores the record and simply shows those entries without a picture.
 */
export async function restorePhotos(photos: readonly StoredPhoto[]): Promise<number> {
  let n = 0
  for (const p of photos) {
    try {
      await putPhoto(p.id, new Blob([p.data as BlobPart], { type: p.type }))
      n++
    } catch {
      /* IndexedDB unavailable or full — keep going */
    }
  }
  return n
}
