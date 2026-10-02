import { expect, test } from 'claude-code/testing'

import { allGlyphs, LOAD_S, screen, tapeError } from '../hooks/screen'
import type { Look } from '../hooks/screen'

/** The cells of a frame: [codePoint, foreground] for each. */
function cells(base64: string, columns: number, rows: number): { code: number; fg: number }[] {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const bytes: number[] = []
  for (let i = 0; i < base64.length; i += 4) {
    const n = [0, 1, 2, 3].map(j => (base64[i + j] === '=' ? 0 : alphabet.indexOf(base64[i + j]!)))
    const v = (n[0]! << 18) | (n[1]! << 12) | (n[2]! << 6) | n[3]!
    bytes.push((v >> 16) & 255, (v >> 8) & 255, v & 255)
  }
  const out: { code: number; fg: number }[] = []
  const u32 = (at: number) => (bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16) | (bytes[at + 3]! << 24)) >>> 0
  for (let i = 0; i < columns * rows; i++) out.push({ code: u32(i * 12), fg: u32(i * 12 + 4) })
  return out
}

test('every letter of both faces is the shape its face says', () => {
  for (const glyph of allGlyphs()) {
    const [w, h] = glyph.face === 'small' ? [3, 5] : [5, 7]
    expect(`${glyph.face} ${glyph.ch}: ${glyph.rows.length} rows`).toBe(`${glyph.face} ${glyph.ch}: ${h} rows`)
    for (const row of glyph.rows) expect(`${glyph.face} ${glyph.ch}: ${row.length} wide, ${/^[.#]+$/.test(row)}`).toBe(`${glyph.face} ${glyph.ch}: ${w} wide, true`)
  }
})

test('a scene loading from tape stripes its border, then paints, then plays without it', () => {
  const look: Look = { scene: 'answer', seed: 3, label: 'IN 12S', tint: 0xffd166, amount: 0, isLoading: true }
  const RED = 0xd70000
  const CYAN = 0x00d7d7
  const columns = 40
  const rows = 12
  // Pilot tone: the top-left cell is border, red or cyan; nothing inside yet.
  const pilot = cells(screen(look, 0.5, 0, columns, rows), columns, rows)
  expect([RED, CYAN].includes(pilot[0]!.fg)).toBe(true)
  // Loaded: no border left, and the picture is there.
  const after = cells(screen(look, LOAD_S + 0.5, 10, columns, rows), columns, rows)
  expect([RED, CYAN, 0x0000d7, 0xd7d700].includes(after[0]!.fg)).toBe(false)
  expect(after.some(cell => cell.code !== 0x20)).toBe(true)
})

test('a load cut short freezes with the ROM report on a white bar and a plain border', () => {
  const look: Look = { scene: 'book', seed: 5, label: 'flow.ts', tint: 0x4b8fe0, amount: 0, isLoading: true }
  const columns = 50
  const rows = 12
  const frame = cells(tapeError(look, 4, columns, rows), columns, rows)
  const stripes = [0xd70000, 0x00d7d7, 0x0000d7, 0xd7d700]
  expect(stripes.includes(frame[0]!.fg)).toBe(false)
  // The foot is the report: a white bar, its letters cut out (cells not wholly filled).
  const bar = frame.slice((rows - 3) * columns)
  expect(frame.slice((rows - 1) * columns).every(cell => cell.fg === 0xd7d7d7)).toBe(true)
  expect(bar.some(cell => cell.fg === 0xd7d7d7 && cell.code !== 0x28ff)).toBe(true)
})
