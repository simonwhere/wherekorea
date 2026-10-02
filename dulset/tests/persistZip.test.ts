import { describe, expect, it } from 'vitest'
import { buildZip, bytesText, crc32, dosDateTime, isSafeZipName, looksLikeZip, readZip, textBytes } from '@/lib/logic/zip'

const u16 = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8)
const u32 = (b: Uint8Array, at: number) => (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0

const entries = () => [
  { name: 'dulset-backup.json', data: textBytes('{"version":1,"stage":"preparing"}') },
  { name: 'photos/a1b2.jpg', data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3, 250, 251, 252, 253]) },
  { name: 'photos/빈 사진.png', data: new Uint8Array(0) },
]

describe('zip: crc32', () => {
  it('matches the published check values', () => {
    expect(crc32(new Uint8Array(0))).toBe(0)
    expect(crc32(textBytes('123456789'))).toBe(0xcbf43926)
    expect(crc32(textBytes('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339)
    expect(crc32(new Uint8Array([0xff, 0xff, 0xff, 0xff]))).toBe(0xffffffff)
  })
})

describe('zip: writer layout', () => {
  it('writes stored local headers, a central directory and an end record that agree', () => {
    const list = entries()
    const zip = buildZip(list, new Date(2026, 9, 2, 14, 30, 10))
    expect(looksLikeZip(zip)).toBe(true)
    // Local header of the first entry
    expect(u32(zip, 0)).toBe(0x04034b50)
    expect(u16(zip, 4)).toBe(10) // version needed: stored
    expect(u16(zip, 6)).toBe(0x0800) // UTF-8 names
    expect(u16(zip, 8)).toBe(0) // method: store
    const { time, date } = dosDateTime(new Date(2026, 9, 2, 14, 30, 10))
    expect(u16(zip, 10)).toBe(time)
    expect(u16(zip, 12)).toBe(date)
    expect(u32(zip, 14)).toBe(crc32(list[0]!.data))
    expect(u32(zip, 18)).toBe(list[0]!.data.length)
    expect(u32(zip, 22)).toBe(list[0]!.data.length)
    expect(u16(zip, 26)).toBe(textBytes('dulset-backup.json').length)
    expect(bytesText(zip.subarray(30, 30 + 18))).toBe('dulset-backup.json')
    // End of central directory: last 22 bytes, 3 entries, directory where it says
    const eocd = zip.length - 22
    expect(u32(zip, eocd)).toBe(0x06054b50)
    expect(u16(zip, eocd + 8)).toBe(3)
    expect(u16(zip, eocd + 10)).toBe(3)
    const cdSize = u32(zip, eocd + 12)
    const cdOffset = u32(zip, eocd + 16)
    expect(cdOffset + cdSize).toBe(eocd)
    expect(u32(zip, cdOffset)).toBe(0x02014b50)
    expect(u32(zip, cdOffset + 42)).toBe(0) // first local header offset
    // Stored = sum of parts: 3 × (30 + name) + data + 3 × (46 + name) + 22
    const names = list.reduce((n, e) => n + textBytes(e.name).length, 0)
    const data = list.reduce((n, e) => n + e.data.length, 0)
    expect(zip.length).toBe(3 * 30 + names + data + 3 * 46 + names + 22)
  })

  it('DOS time packs 2-second resolution and clamps years before 1980', () => {
    expect(dosDateTime(new Date(2026, 9, 2, 14, 30, 11))).toEqual({ time: (14 << 11) | (30 << 5) | 5, date: ((2026 - 1980) << 9) | (10 << 5) | 2 })
    expect(dosDateTime(new Date(1970, 0, 1)).date >> 9).toBe(0)
  })

  it('refuses unsafe or duplicate names', () => {
    expect(isSafeZipName('photos/a.jpg')).toBe(true)
    expect(isSafeZipName('/etc/passwd')).toBe(false)
    expect(isSafeZipName('../x')).toBe(false)
    expect(isSafeZipName('a/../b')).toBe(false)
    expect(isSafeZipName('a//b')).toBe(false)
    expect(isSafeZipName('a\\b')).toBe(false)
    expect(isSafeZipName('')).toBe(false)
    expect(() => buildZip([{ name: '../x', data: new Uint8Array(1) }])).toThrow()
    expect(() => buildZip([{ name: 'a', data: new Uint8Array(1) }, { name: 'a', data: new Uint8Array(1) }])).toThrow()
  })
})

describe('zip: round trip', () => {
  it('reads back every entry, bytes and UTF-8 names intact, in order', () => {
    const list = entries()
    const out = readZip(buildZip(list))
    expect('entries' in out).toBe(true)
    if (!('entries' in out)) return
    expect(out.entries.map((e) => e.name)).toEqual(list.map((e) => e.name))
    out.entries.forEach((e, i) => expect([...e.data]).toEqual([...list[i]!.data]))
    expect(bytesText(out.entries[0]!.data)).toBe('{"version":1,"stage":"preparing"}')
  })

  it('an empty archive round-trips too', () => {
    const out = readZip(buildZip([]))
    expect(out).toEqual({ entries: [] })
  })

  it('handles a few hundred binary entries (a year of photos)', () => {
    const list = Array.from({ length: 300 }, (_, i) => {
      const data = new Uint8Array(1000 + i)
      for (let j = 0; j < data.length; j++) data[j] = (i * 31 + j * 7) & 0xff
      return { name: `photos/${i.toString(36).padStart(4, '0')}.jpg`, data }
    })
    const out = readZip(buildZip(list))
    if (!('entries' in out)) throw new Error(out.error)
    expect(out.entries.length).toBe(300)
    expect(out.entries[299]!.data.length).toBe(1299)
    expect(crc32(out.entries[150]!.data)).toBe(crc32(list[150]!.data))
  })
})

describe('zip: reader refusals', () => {
  it('not a zip: random bytes, JSON text, too short', () => {
    expect(readZip(textBytes('{"version":1}'))).toEqual({ error: 'not-zip' })
    expect(readZip(new Uint8Array(5))).toEqual({ error: 'not-zip' })
    expect(looksLikeZip(textBytes('{"a":1}'))).toBe(false)
    expect(readZip(new Uint8Array(100).fill(0x50))).toEqual({ error: 'not-zip' })
  })

  it('corrupt: a flipped byte in the data fails the CRC and the whole read', () => {
    const zip = buildZip(entries())
    const bad = zip.slice()
    bad[30 + 18 + 3]! ^= 0x01 // inside the first entry's data
    expect(readZip(bad)).toEqual({ error: 'corrupt' })
  })

  it('corrupt: truncated archive (directory pointing past the end) or a damaged header', () => {
    const zip = buildZip(entries())
    const eocd = zip.length - 22
    // Keep the end record but cut the middle out: the directory offset now points past the end.
    const cut = new Uint8Array(60)
    cut.set(zip.subarray(0, 38))
    cut.set(zip.subarray(eocd), 38)
    expect(readZip(cut)).toEqual({ error: 'corrupt' })
    // A wrong local header signature
    const sig = zip.slice()
    sig[0] = 0
    expect(readZip(sig)).toEqual({ error: 'corrupt' })
  })

  it('unsupported: a compressed (deflate) or encrypted entry', () => {
    const zip = buildZip(entries())
    const eocd = zip.length - 22
    const cd = u32(zip, eocd + 16)
    const deflated = zip.slice()
    deflated[cd + 10] = 8 // method: deflate
    expect(readZip(deflated)).toEqual({ error: 'unsupported' })
    const encrypted = zip.slice()
    encrypted[cd + 8]! |= 0x01
    expect(readZip(encrypted)).toEqual({ error: 'unsupported' })
  })

  it('unsupported: a multi-disk archive', () => {
    const zip = buildZip(entries())
    const eocd = zip.length - 22
    const spanned = zip.slice()
    spanned[eocd + 4] = 1
    expect(readZip(spanned)).toEqual({ error: 'unsupported' })
  })
})
