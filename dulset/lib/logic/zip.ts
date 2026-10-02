// A minimal .zip writer and reader for the full backup (기록 + 사진, N16).
//
// STORE only (no compression — photos are JPEGs already), no ZIP64, no
// encryption, no dependency. Every entry carries a CRC-32 that the reader
// checks, so a damaged file is refused instead of restoring half a diary.
// Names are UTF-8 (general-purpose flag bit 11). Pure: bytes in, bytes out,
// so tests round-trip it without a browser.

export interface ZipEntry {
  /** Path inside the archive, '/'-separated, no leading slash. */
  name: string
  data: Uint8Array
}

export type ZipReadError =
  /** Not a zip file at all (no end-of-central-directory record). */
  | 'not-zip'
  /** A real zip, but compressed, encrypted, spanned or ZIP64 — not one of ours. */
  | 'unsupported'
  /** Sizes, offsets or a CRC don't add up: truncated or damaged. */
  | 'corrupt'

const LOCAL_SIG = 0x04034b50
const CENTRAL_SIG = 0x02014b50
const EOCD_SIG = 0x06054b50
const LOCAL_HEADER = 30
const CENTRAL_HEADER = 46
const EOCD_SIZE = 22
/** EOCD + the longest possible archive comment. */
const EOCD_SEARCH = EOCD_SIZE + 0xffff
/** General-purpose flag: names and comments are UTF-8. */
const FLAG_UTF8 = 0x0800
const METHOD_STORE = 0
const VERSION_STORE = 10
const MAX_ENTRIES = 0xffff
const MAX_SIZE = 0xffffffff

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: false })

/** Bytes of a UTF-8 string. */
export function textBytes(text: string): Uint8Array {
  return encoder.encode(text)
}

/** UTF-8 text of some bytes. */
export function bytesText(bytes: Uint8Array): string {
  return decoder.decode(bytes)
}

// ── CRC-32 (IEEE 802.3, the one zip uses) ───────────────────

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ── DOS date/time ───────────────────────────────────────────

/** Zip stores local time in two 16-bit fields (2-second resolution, 1980–2107). */
export function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.min(2107, Math.max(1980, date.getFullYear()))
  const d = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  const t = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
  return { time: t & 0xffff, date: d & 0xffff }
}

// ── Writer ──────────────────────────────────────────────────

class ByteWriter {
  private chunks: Uint8Array[] = []
  length = 0
  u16(v: number) {
    this.push(new Uint8Array([v & 0xff, (v >>> 8) & 0xff]))
  }
  u32(v: number) {
    this.push(new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]))
  }
  push(bytes: Uint8Array) {
    this.chunks.push(bytes)
    this.length += bytes.length
  }
  bytes(): Uint8Array {
    const out = new Uint8Array(this.length)
    let at = 0
    for (const c of this.chunks) {
      out.set(c, at)
      at += c.length
    }
    return out
  }
}

/** A name the reader will take back: non-empty, no '\\', no leading '/', no '..' segment. */
export function isSafeZipName(name: string): boolean {
  if (!name || name.length > 512 || name.includes('\\') || name.startsWith('/')) return false
  return name.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..')
}

/**
 * Build a stored (uncompressed) zip. Entries keep their order; duplicate or
 * unsafe names throw, as does anything past the classic 4 GB / 65,535-entry
 * limits (we never get near them — a year of downscaled photos is ~50 MB).
 */
export function buildZip(entries: readonly ZipEntry[], modified: Date = new Date(2026, 0, 1, 12)): Uint8Array {
  if (entries.length > MAX_ENTRIES) throw new Error('zip: too many entries')
  const seen = new Set<string>()
  const { time, date } = dosDateTime(modified)
  const out = new ByteWriter()
  const central = new ByteWriter()
  for (const e of entries) {
    if (!isSafeZipName(e.name)) throw new Error(`zip: bad entry name ${JSON.stringify(e.name)}`)
    if (seen.has(e.name)) throw new Error(`zip: duplicate entry ${e.name}`)
    seen.add(e.name)
    if (e.data.length > MAX_SIZE) throw new Error('zip: entry too large')
    const name = textBytes(e.name)
    const crc = crc32(e.data)
    const offset = out.length
    // Local file header
    out.u32(LOCAL_SIG)
    out.u16(VERSION_STORE)
    out.u16(FLAG_UTF8)
    out.u16(METHOD_STORE)
    out.u16(time)
    out.u16(date)
    out.u32(crc)
    out.u32(e.data.length)
    out.u32(e.data.length)
    out.u16(name.length)
    out.u16(0)
    out.push(name)
    out.push(e.data)
    // Central directory record
    central.u32(CENTRAL_SIG)
    central.u16(VERSION_STORE)
    central.u16(VERSION_STORE)
    central.u16(FLAG_UTF8)
    central.u16(METHOD_STORE)
    central.u16(time)
    central.u16(date)
    central.u32(crc)
    central.u32(e.data.length)
    central.u32(e.data.length)
    central.u16(name.length)
    central.u16(0) // extra
    central.u16(0) // comment
    central.u16(0) // disk number start
    central.u16(0) // internal attributes
    central.u32(0) // external attributes
    central.u32(offset)
    central.push(name)
  }
  if (out.length + central.length + EOCD_SIZE > MAX_SIZE) throw new Error('zip: archive too large')
  const cdOffset = out.length
  const cd = central.bytes()
  out.push(cd)
  out.u32(EOCD_SIG)
  out.u16(0)
  out.u16(0)
  out.u16(entries.length)
  out.u16(entries.length)
  out.u32(cd.length)
  out.u32(cdOffset)
  out.u16(0)
  return out.bytes()
}

// ── Reader ──────────────────────────────────────────────────

function u16(b: Uint8Array, at: number): number {
  return b[at]! | (b[at + 1]! << 8)
}

function u32(b: Uint8Array, at: number): number {
  return (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0
}

/** The archive starts with a local header signature ('PK\x03\x04') — a cheap "is this a zip" check. */
export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && u32(bytes, 0) === LOCAL_SIG
}

function findEOCD(b: Uint8Array): number {
  const min = Math.max(0, b.length - EOCD_SEARCH)
  for (let at = b.length - EOCD_SIZE; at >= min; at--) {
    if (u32(b, at) === EOCD_SIG) return at
  }
  return -1
}

/**
 * Read a zip written by buildZip (or any other stored, single-disk, non-ZIP64
 * archive). Every entry's data is checked against its CRC-32; one bad entry
 * fails the whole read — a backup is all or nothing.
 */
export function readZip(bytes: Uint8Array): { entries: ZipEntry[] } | { error: ZipReadError } {
  if (bytes.length < EOCD_SIZE) return { error: 'not-zip' }
  const eocd = findEOCD(bytes)
  if (eocd < 0) return { error: 'not-zip' }
  const disk = u16(bytes, eocd + 4)
  const cdDisk = u16(bytes, eocd + 6)
  const countHere = u16(bytes, eocd + 8)
  const count = u16(bytes, eocd + 10)
  const cdSize = u32(bytes, eocd + 12)
  const cdOffset = u32(bytes, eocd + 16)
  if (disk !== 0 || cdDisk !== 0 || countHere !== count) return { error: 'unsupported' }
  if (count === 0xffff || cdOffset === MAX_SIZE || cdSize === MAX_SIZE) return { error: 'unsupported' } // ZIP64 markers
  if (cdOffset + cdSize > eocd) return { error: 'corrupt' }

  const entries: ZipEntry[] = []
  const names = new Set<string>()
  let at = cdOffset
  for (let i = 0; i < count; i++) {
    if (at + CENTRAL_HEADER > eocd || u32(bytes, at) !== CENTRAL_SIG) return { error: 'corrupt' }
    const flags = u16(bytes, at + 8)
    const method = u16(bytes, at + 10)
    const crc = u32(bytes, at + 16)
    const compressed = u32(bytes, at + 20)
    const size = u32(bytes, at + 24)
    const nameLen = u16(bytes, at + 28)
    const extraLen = u16(bytes, at + 30)
    const commentLen = u16(bytes, at + 32)
    const localOffset = u32(bytes, at + 42)
    const nameEnd = at + CENTRAL_HEADER + nameLen
    if (nameEnd > eocd) return { error: 'corrupt' }
    const name = bytesText(bytes.subarray(at + CENTRAL_HEADER, nameEnd))
    at = nameEnd + extraLen + commentLen
    // Encrypted (bit 0) or compressed: not ours. (Sizes and the CRC come from the
    // central directory, so a data-descriptor archive (bit 3) still reads fine.)
    if (method !== METHOD_STORE || flags & 0x0001 || compressed !== size) return { error: 'unsupported' }
    if (!isSafeZipName(name) || names.has(name)) return { error: 'corrupt' }
    // The local header may carry its own (longer) extra field: read the data offset from it.
    if (localOffset + LOCAL_HEADER > cdOffset || u32(bytes, localOffset) !== LOCAL_SIG) return { error: 'corrupt' }
    const localNameLen = u16(bytes, localOffset + 26)
    const localExtraLen = u16(bytes, localOffset + 28)
    const dataStart = localOffset + LOCAL_HEADER + localNameLen + localExtraLen
    const dataEnd = dataStart + size
    if (dataEnd > cdOffset) return { error: 'corrupt' }
    const data = bytes.slice(dataStart, dataEnd)
    if (crc32(data) !== crc) return { error: 'corrupt' }
    names.add(name)
    entries.push({ name, data })
  }
  return { entries }
}
