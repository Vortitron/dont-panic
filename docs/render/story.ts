// Writes docs/render/story.json: a short session's entries, written live by the Guide's own
// prompt (claude -p, so the README shows real output), with each scene's doodle evolving.
// Run from the repo: node --experimental-strip-types docs/render/story.ts [model]
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

import { classify, describe, LIVE_SYSTEM, livePrompt, parseLive } from '../../hooks/guide.ts'
import type { Action } from '../../hooks/guide.ts'
import type { Doodle } from '../../hooks/screen.ts'

const model = process.argv[2] ?? 'sonnet'
const SCENE: Record<string, string> = { read: 'book', search: 'babel', edit: 'magrathea', shell: 'deepthought', fail: 'petunias', done: 'answer', thinking: 'panic' }

const request = 'Add a dark mode toggle to the settings page'
const steps: { action: Action; extra?: string }[] = [
  { action: { category: 'thinking', tool: '', detail: '', vars: {}, label: 'THINKING' }, extra: `The request: "${request}"` },
  { action: classify('Read', { file_path: '/app/src/settings/Settings.tsx' }) },
  { action: classify('Grep', { pattern: 'theme' }) },
  { action: classify('Edit', { file_path: '/app/src/settings/Settings.tsx', old_string: 'x'.repeat(300), new_string: 'y'.repeat(900) }) },
  { action: classify('Bash', { command: 'npm test -- settings' }) },
  { action: { ...classify('Bash', { command: 'npm test -- settings' }), category: 'fail', vars: { tool: 'Bash', error: 'Expected "dark", received "light"' }, label: 'Bash' } },
  { action: classify('Read', { file_path: '/app/src/settings/Settings.tsx' }) },
  { action: { category: 'done', tool: '', detail: 'Answered after 48 s', vars: { secs: '48 s' }, label: 'IN 48S' }, extra: 'Its answer began: "Added a Dark mode switch to Settings, saved per user; tests pass."' },
]

const variants: Record<string, Doodle> = {}
const history: string[] = []
const said: string[] = []
const out = []
for (const step of steps) {
  const scene = SCENE[step.action.category]!
  const previous = variants[scene] ?? null
  const prompt = livePrompt(step.action, history.slice(-5), said.slice(-4), step.extra, scene, previous)
  const text = execFileSync('claude', ['-p', '--model', model, '--system-prompt', LIVE_SYSTEM, prompt], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const live = parseLive(text)
  if (!live) throw new Error(`no entry for ${scene}: ${text}`)
  let doodle: Doodle | null = null
  if (live.doodle) {
    const { isFresh, ...drawn } = live.doodle
    doodle = { ...drawn, generation: isFresh || !previous ? 1 : previous.generation + 1 }
    variants[scene] = doodle
  }
  history.push(describe(step.action))
  said.push(live.entry)
  out.push({ scene, action: step.action, heading: live.heading, entry: live.entry, doodle })
  console.log(`${scene}: ${live.heading}\n  ${live.entry}\n  doodle: ${doodle ? `${doodle.name} (gen ${doodle.generation})` : 'none'}`)
}
writeFileSync(new URL('./story.json', import.meta.url), JSON.stringify(out, null, 2))
