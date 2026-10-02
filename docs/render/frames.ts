// Writes the README's frames as JSON lines, one per frame: the screen's cells from the
// plugin's own screen.ts, and the pane's words beneath, laid out as the pane lays them out.
// Run from the repo: node --experimental-strip-types --import ./docs/render/ts-resolve.mjs \
//   docs/render/frames.ts <hero|spectrum|gallery> > out.jsonl
import { readFileSync } from 'node:fs'

import { tintOf, TOPICS } from '../../hooks/guide.ts'
import type { Action } from '../../hooks/guide.ts'
import { LOAD_S, screen, tapeError } from '../../hooks/screen.ts'
import type { Doodle, Look, Scene } from '../../hooks/screen.ts'

type Step = { scene: Scene; action: Action; heading: string | null; entry: string; doodle: Doodle | null }
type Line = { text: string; style: 'heading' | 'entry' | 'dim' | 'art' }

const which = process.argv[2] ?? 'hero'
const story = JSON.parse(readFileSync(new URL('./story.json', import.meta.url), 'utf8')) as Step[]
const FPS = 10

function wrap(text: string, columns: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!line) line = word
    else if (line.length + 1 + word.length <= columns) line += ` ${word}`
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

function words(step: Step, counts: { consulted: number; mishaps: number; answers: number }, columns: number): Line[] {
  const lines: Line[] = [{ text: (step.heading ?? TOPICS[step.action.category]).toUpperCase(), style: 'heading' }]
  for (const text of wrap(step.entry, columns)) lines.push({ text, style: 'entry' })
  if (step.action.detail) lines.push({ text: step.action.detail, style: 'dim' })
  if (step.doodle) lines.push({ text: `On screen: ${step.doodle.name}${step.doodle.generation > 1 ? `, generation ${step.doodle.generation}` : ''}`, style: 'art' })
  lines.push({ text: `Entries consulted ${counts.consulted} · mishaps ${counts.mishaps} · answers ${counts.answers} · remarks live, sonnet`, style: 'dim' })
  // One-line rows end in an ellipsis where the pane is too narrow, as Text's truncate-end does.
  return lines.map(line => (line.style !== 'entry' && line.text.length > columns ? { ...line, text: `${line.text.slice(0, columns - 1)}…` } : line))
}

function lookOf(step: Step, seed: number, isLoading = false): Look {
  const label = step.action.label ?? ''
  const isFile = step.action.category === 'read' || step.action.category === 'edit'
  return {
    scene: step.scene,
    seed,
    label: isFile ? label.split('/').pop()! : label,
    tint: isFile ? tintOf(label) : tintOf(`${step.action.category}:${label}`),
    flavour: step.action.flavour,
    amount: step.action.amount ?? 0.4,
    doodle: step.doodle ?? undefined,
    isLoading,
  }
}

function emit(cells: string, columns: number, rows: number, lines: Line[], title = 'The Guide') {
  process.stdout.write(`${JSON.stringify({ cells, columns, rows, lines, title })}\n`)
}

/** Frames of one step: `seconds` long, the scene's own clock running `pace` times as fast. */
function play(look: Look, lines: Line[], columns: number, bodyRows: number, seconds: number, pace = 1, from = 0) {
  const rows = bodyRows - lines.length
  for (let f = 0; f < seconds * FPS; f++) {
    const t = from + (f / FPS) * pace
    emit(screen(look, t, 100 + t, columns, rows), columns, rows, lines)
  }
}

if (which === 'hero') {
  const columns = 64
  const bodyRows = 30
  const counts = { consulted: 0, mishaps: 0, answers: 0 }
  story.forEach((step, i) => {
    if (step.action.tool) counts.consulted += 1
    if (step.action.category === 'fail') counts.mishaps += 1
    if (step.action.category === 'done') counts.answers += 1
    const lines = words(step, counts, columns)
    if (i === 0) {
      // The session's first scene loads from tape, at twice the speed, then plays a moment.
      play(lookOf(step, 4242, true), lines, columns, bodyRows, LOAD_S / 2, 2)
      play(lookOf(step, 4242, true), lines, columns, bodyRows, 2.2, 1, LOAD_S)
    } else play(lookOf(step, 1000 + i * 77), lines, columns, bodyRows, step.action.category === 'fail' ? 4 : 3.4)
  })
} else if (which === 'spectrum') {
  const columns = 56
  const bodyRows = 22
  const counts = { consulted: 2, mishaps: 0, answers: 0 }
  const book = story.find(s => s.scene === 'book')!
  const edit = story.find(s => s.scene === 'magrathea')!
  const bookLines = words(book, counts, columns)
  const bookLook = lookOf(book, 9001, true)
  // Most of a load, at twice the speed, then the edit cuts it off.
  const cutAt = 5.6
  play(bookLook, bookLines, columns, bodyRows, cutAt / 2, 2)
  const editLines = words(edit, { ...counts, consulted: 3 }, columns)
  const rows = bodyRows - editLines.length
  for (let f = 0; f < 2.2 * FPS; f++) emit(tapeError(bookLook, cutAt, columns, rows), columns, rows, editLines)
  play(lookOf(edit, 777), editLines, columns, bodyRows, 3)
} else {
  // The gallery: every scene, still, at a moment that shows it off.
  const columns = 44
  const rows = 11
  const stills: [Scene, string, number, string][] = [
    ['panic', '', 3, 'Thinking, idle'],
    ['book', 'Settings.tsx', 0.9, 'Reading'],
    ['babel', 'theme', 4.5, 'Searching'],
    ['magrathea', 'Settings.tsx', 4, 'Editing'],
    ['deepthought', 'npm test', 2, 'Shell'],
    ['hyperspace', 'github.com', 3.5, 'Web and MCP'],
    ['house', 'get state', 2, 'Home Assistant'],
    ['improbability', 'find the bug', 0.5, 'Subagents'],
    ['towel', 'TO DO', 1.3, 'Plans and questions'],
    ['petunias', 'Bash', 0.95, 'A failure'],
    ['answer', 'IN 48S', 2.5, 'An answer'],
    ['dolphins', 'SO LONG', 1.6, 'An interruption'],
  ]
  for (const [scene, label, t, caption] of stills) {
    const flavour = scene === 'deepthought' ? 'tests' : undefined
    const look: Look = { scene, seed: 31, label, tint: scene === 'book' || scene === 'magrathea' ? tintOf(label) : tintOf(`${scene}:${label}`), flavour, amount: 0.6 }
    emit(screen(look, t, 50 + t, columns, rows), columns, rows, [], caption)
  }
}
