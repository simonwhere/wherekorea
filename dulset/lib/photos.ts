'use client'

// Diary photos live in IndexedDB (localStorage is too small for images).
// Everything stays on this device in the prototype.

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

export async function savePhoto(blob: Blob): Promise<string> {
  const id = newId()
  await tx('readwrite', (s) => s.put(blob, id))
  return id
}

export async function getPhotoBlob(id: string): Promise<Blob | null> {
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
