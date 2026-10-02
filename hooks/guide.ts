// What the agent is doing, filed the way the Guide would file it: a category, a heading, the
// plain facts, and a remark. The remarks here are the instant ones; the live ones come from a
// model (see `livePrompt`) and replace them when they arrive.
//
// Every line is original, in the spirit of the Guide rather than quoting it.

import type { Category } from '../types'
import { MOTIONS } from './screen'
import type { Doodle, Motion } from './screen'

/** One action, reduced to what a remark needs. */
export type Action = {
  category: Category
  /** The tool's own name, or '' for a turn event. */
  tool: string
  /** The call itself, plainly: `Bash · npm test`. */
  detail: string
  /** Values the remarks fill in: file, cmd, pattern, host, query, server, agent, secs. */
  vars: Record<string, string>
  /** Narrower than the category, for Bash: tests, push, git, rm, ... */
  flavour?: string
  /** What the screen spells out: the file, the pattern, the command, the host. */
  label?: string
  /** How much, 0 to 1: the size of an edit. */
  amount?: number
}

export const TOPICS: Record<Category, string> = {
  read: 'Files, the reading of',
  search: 'Searching, the futility of',
  edit: 'Code, the rearrangement of',
  shell: 'Shells, the commanding of',
  web: 'The Sub-Etha Net',
  mcp: 'Remote devices, the sulking of',
  agent: 'Subagents, the improbability of',
  plan: 'Plans, the making of',
  ask: 'Questions, the asking of',
  other: 'Miscellaneous, the',
  fail: 'Failure, the noble art of',
  done: 'Answers, the giving of',
  aborted: 'Interruptions',
  thinking: 'Thought, deep',
  idle: 'Nothing, the restfulness of',
}

const BANK: Record<string, string[]> = {
  read: [
    'Reading, as practised by coding agents, differs from the human variety chiefly in that it reaches the end. {file} is being read in full, which the Guide notes is more than its author ever managed.',
    '{file}. The Guide’s field researchers rate it "mostly harmless", a verdict it shares with most files and one entire planet.',
    'Of all the files in the Galaxy, {file} is the one being read. Statistically this is extraordinary; locally, it is a Tuesday.',
    'Reading files is the second-oldest activity in software. The oldest is not reading them, which explains a great deal about {file}.',
    'The Guide advises any being about to open {file} to keep a towel within reach. Nobody knows why. It has never once been wrong.',
  ],
  search: [
    'Searching, n.: the practice of looking for "{pattern}" in the one place it has always been, last.',
    'The Great Search for "{pattern}" is under way. Previous searches of this kind found their quarry in 0.3 seconds on average, or never.',
    'Many civilisations have searched for meaning. This one is searching for "{pattern}", which the Guide regards as the more practical ambition.',
    'Glob patterns were invented by a species who found naming things tiresome. Their descendants still cannot find anything, but very quickly.',
  ],
  edit: [
    'Editing is the art of making a file more like what it should have been. {file} is undergoing it now, with the quiet dignity of a coastline under revision.',
    '{file} is being rewritten. The Magratheans built whole worlds to order; this is the same trade, at the scale of a semicolon.',
    'Every edit to {file} is, in a sense, a demolition order for the old version. Appeals are not possible; notice was posted in a different file.',
    'Writing a new file, such as {file}, is regarded on most worlds as an act of optimism, and on Vogsphere as poetry, which is punishable.',
  ],
  shell: [
    'Shell commands, such as `{cmd}`, are how agents speak to the machine directly. The machine listens, considers, and does roughly what was meant.',
    '`{cmd}` is now running. Experts disagree about how long it will take. The experts who agree have not been asked.',
    'The command line is the Galaxy’s most honest interface: it does exactly what it is told, which is why it is feared.',
    '`{cmd}`: a perfectly ordinary command, which is precisely what the universe would like you to believe.',
  ],
  'shell.tests': [
    'Tests, running of. Most civilisations run their tests shortly after shipping. This one runs them before, a custom the Guide finds touchingly old-fashioned.',
    'A test suite is a list of promises a program has made to itself. They are now being checked, and everyone present is studying their shoes.',
  ],
  'shell.build': [
    'Building, in software, is the process of turning a great many small files into one large surprise.',
    'The build has begun. Deep Thought took seven and a half million years over its one answer; most builds feel much the same.',
  ],
  'shell.push': [
    'Pushing, git. The moment code leaves home and finds out what everyone else thinks of it.',
    'The code is leaving this planet for a remote one. The Guide recommends a brief wave and a long cup of tea.',
  ],
  'shell.git': [
    'Git remembers everything ever done to the code and forgives none of it. Running `git {sub}` is the software equivalent of rereading one’s own diary.',
    'Version control exists so that every mistake can be preserved for posterity. `git {sub}` is now visiting the archive.',
  ],
  'shell.rm': [
    'Deletion. Planets have been demolished on less paperwork. The Guide recommends reading the path twice, and once more for luck.',
    'rm: a command with no undo, much like a Vogon constructor fleet. DON’T PANIC, but do keep a backup.',
  ],
  'shell.sudo': ['sudo is the shell’s way of saying "I really mean it". The machine, which has heard this before, complies anyway.'],
  'shell.ssh': ['Remote shells link one world to another, in this case {host}. Other worlds are much like this one, only with different config files.'],
  'shell.curl': ['curl fetches things across the Sub-Etha Net. Most of what it brings back is HTML; the rest is also HTML.'],
  'shell.box': ['Containers are small, self-contained universes in which software is kept from bothering the rest of reality. Occasionally it escapes.'],
  'shell.wait': ['Waiting. Time is an illusion, and waiting doubly so. The Guide recommends a towel to lie on.'],
  web: [
    'The Sub-Etha Net is the Galaxy’s great library, gossip column and rubbish tip, in roughly equal parts. {host} lies somewhere in the middle.',
    'Web searches, such as this one for "{query}", return a great deal of information, some of it true. The Guide has never been able to tell which part either.',
    '{host}: a site which, according to the Guide’s researchers, apparently exists.',
  ],
  mcp: [
    '{server} is a remote server, which is to say a computer someone else is responsible for. It is being asked, politely, to run {tool}.',
    'Remote servers are notoriously temperamental. {server} is no exception, and has been sent {tool} with a covering note.',
  ],
  'mcp.home': [
    'Homes, smart. Dwellings that have learned to listen, and are now being asked something through {tool}. The lightbulbs have opinions.',
    'On many worlds the house runs the household. This one is being consulted through {tool}, and is pretending it was its own idea.',
  ],
  agent: [
    'Subagents are small, earnest beings made for a single purpose, in this case to {agent}. They are, on the whole, happier than the rest of us.',
    'Delegation is the second great discovery of any intelligent species; the first is realising somebody else could be doing this. "{agent}" has been handed over accordingly.',
  ],
  plan: [
    'Lists, to-do. The most popular literary form in the Galaxy, outselling poetry by several billion copies, and Vogon poetry by rather more.',
    'Planning is the art of deciding in advance what will later go differently. The Guide approves, in principle.',
  ],
  ask: [
    'Questions are the Galaxy’s scarcest resource and answers its most abundant. The agent has one for you, which makes you briefly very important.',
    'A question has been raised. Knowing the right question is, as Deep Thought could tell you, the hard part.',
  ],
  other: [
    '{tool}: the Guide’s entry on this tool is under revision, and has been since roughly the Jurassic.',
    '{tool} is a tool. The Guide’s editors felt this needed saying.',
  ],
  fail: [
    'Failure is the most common outcome of any action in the Galaxy, narrowly ahead of lunch. Somewhere, a bowl of petunias is thinking "Oh no, not again."',
    '{tool} has failed. The Guide notes that this is how most great discoveries begin, and nearly all minor ones end.',
    'An error. On the bright side, it is now a known error, which on most worlds counts as progress.',
    'The universe has said no. Seasoned travellers hear this as "not yet"; very seasoned ones hear "try a different flag".',
  ],
  done: [
    'Answers, giving of. This one is probably not 42, but it arrived in {secs}, several million years quicker than the famous one.',
    'An answer has been produced. The Guide reminds readers that an answer is only as good as its question, and suggests checking both.',
    'The turn is complete. The agent now waits, as all great minds do, for someone to ask it something else.',
  ],
  aborted: [
    'Interruptions. The dolphins left early too, and in hindsight they were right about most things.',
    'Cancelled. On several worlds an interrupted thought is considered a delicacy. The agent is taking it well.',
  ],
  thinking: [
    'Thinking, deep. The Guide compares it to watching a kettle that is also, quietly, solving physics.',
    'Thought is the agent’s principal activity and its only export. Please do not ask it what the question was.',
    'The mice have commissioned a great deal of thinking in their time. This is a smaller job, but the principle is the same.',
  ],
  idle: [
    'Nothing, the restfulness of. The Guide recommends this state highly, and enters it whenever its editors are at lunch.',
    'All quiet. This would be an excellent moment to locate your towel.',
  ],
}

/** The base name of a path: what a remark calls a file. */
export function baseName(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? path
}

/** Cut to `n` characters, with an ellipsis. */
export function cut(text: string, n: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat
}

function host(url: string): string {
  const match = /^[a-z]+:\/\/([^/:?#]+)/i.exec(url)
  return match?.[1] ?? cut(url, 40)
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Files a tool call as the Guide would: what kind of thing, and the facts a remark needs. */
export function classify(tool: string, args: Record<string, unknown>): Action {
  const file = baseName(str(args.file_path) || str(args.notebook_path) || str(args.path))
  if (tool === 'Read' || tool === 'NotebookRead') {
    return { category: 'read', tool, detail: `${tool} · ${file}`, vars: { file, tool }, label: file }
  }
  if (tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit' || tool === 'NotebookEdit') {
    const size = str(args.content).length + str(args.old_string).length + str(args.new_string).length + str(args.new_source).length
    const amount = Math.min(1, Math.log10(1 + size) / 4)
    const flavour = tool === 'Write' ? 'write' : undefined
    return { category: 'edit', tool, detail: `${tool} · ${file}`, vars: { file, tool }, label: file, amount, flavour }
  }
  if (tool === 'Grep' || tool === 'Glob' || tool === 'ToolSearch') {
    const pattern = cut(str(args.pattern) || str(args.query), 40)
    const flavour = tool === 'Glob' ? 'glob' : undefined
    return { category: 'search', tool, detail: `${tool} · ${pattern}`, vars: { pattern, tool }, label: pattern, flavour }
  }
  if (tool === 'Bash' || tool === 'BashOutput' || tool === 'Monitor' || tool === 'KillShell') {
    const command = str(args.command)
    const words = command.trim().replace(/^(cd \S+ (&&|;) )+/, '').split(/\s+/)
    const cmd = cut(words.slice(0, 3).join(' '), 40) || tool
    const vars: Record<string, string> = { cmd, tool, sub: words[1] ?? '' }
    const flavour = shellFlavour(command, vars)
    return { category: 'shell', tool, detail: `${tool} · ${cut(command || tool, 70)}`, vars, flavour, label: cmd }
  }
  if (tool === 'WebFetch' || tool === 'WebSearch') {
    const url = str(args.url)
    const query = cut(str(args.query), 50)
    return { category: 'web', tool, detail: `${tool} · ${url ? host(url) : query}`, vars: { host: url ? host(url) : 'the web', query, tool }, label: url ? host(url) : query }
  }
  if (tool === 'Agent' || tool === 'Task' || tool === 'Workflow' || tool === 'SendMessage') {
    const agent = cut(str(args.description) || str(args.subagent_type) || 'do something', 50)
    return { category: 'agent', tool, detail: `${tool} · ${agent}`, vars: { agent, tool }, label: agent }
  }
  if (tool === 'TodoWrite' || tool.startsWith('Task') || tool === 'EnterPlanMode' || tool === 'ExitPlanMode') {
    return { category: 'plan', tool, detail: tool, vars: { tool }, label: 'TO DO' }
  }
  if (tool === 'AskUserQuestion') return { category: 'ask', tool, detail: tool, vars: { tool }, label: '?' }
  if (tool.startsWith('mcp__')) {
    const [, server = 'a server', ...rest] = tool.split('__')
    const name = rest.join('__') || tool
    if (server.includes('chrome') || server.includes('Browser')) {
      return { category: 'web', tool, detail: `${server} · ${name}`, vars: { host: 'a browser', query: name, tool: name }, label: name.replace(/_/g, ' ') }
    }
    const isHome = /^(ha_|esphome_|nodered_|vomehome_)/.test(name)
    const label = isHome ? name.replace(/^[a-z]+_/, '').replace(/_/g, ' ') : server
    return { category: 'mcp', tool, detail: `${server} · ${name}`, vars: { server, tool: name }, flavour: isHome ? 'home' : undefined, label }
  }
  return { category: 'other', tool, detail: tool, vars: { tool }, label: tool }
}

function shellFlavour(command: string, vars: Record<string, string>): string | undefined {
  const c = ` ${command} `
  if (/\b(test|jest|vitest|pytest|mocha|phpunit)\b/.test(c) && !/\btest -[a-z]\b/.test(c)) return 'tests'
  if (/\bgit push\b/.test(c)) return 'push'
  if (/\bgit \w/.test(c)) {
    vars.sub = /\bgit (\w+)/.exec(c)?.[1] ?? vars.sub ?? ''
    return 'git'
  }
  if (/\brm -\w*r|\brm \b/.test(c)) return 'rm'
  if (/\bsudo\b/.test(c)) return 'sudo'
  if (/\bssh\b/.test(c)) {
    vars.host = /\bssh\s+(?:-\S+\s+(?:\S+\s+)?)*([\w.@-]+)/.exec(c)?.[1] ?? 'somewhere'
    return 'ssh'
  }
  if (/\b(curl|wget)\b/.test(c)) return 'curl'
  if (/\b(docker|virsh|podman|kubectl)\b/.test(c)) return 'box'
  if (/\b(sleep|wait)\b/.test(c)) return 'wait'
  if (/\b(build|make|tsc|webpack|vite|cargo)\b/.test(c)) return 'build'
  return undefined
}

/** Which remark of a bank comes next, never the one just used. */
const lastUsed = new Map<string, number>()

/** An instant remark for `action`, filled in. */
export function cannedQuip(action: Action, seed: number): string {
  const key = action.flavour ? `${action.category}.${action.flavour}` : action.category
  const bank = BANK[key] ?? BANK[action.category] ?? BANK.other!
  let index = Math.floor(seed) % bank.length
  if (bank.length > 1 && index === lastUsed.get(key)) index = (index + 1) % bank.length
  lastUsed.set(key, index)
  return fill(bank[index]!, action.vars)
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, name: string) => vars[name] || 'it')
}

/** The Guide's voice, and the doodle it draws: the system prompt of every live entry. */
export const LIVE_SYSTEM = `You write entries for the electronic edition of The Hitchhiker’s Guide to the Galaxy, shown on a small screen beside an AI coding agent at work. Each entry is the Guide’s own account of what the agent is doing right now.

Write it as the Guide writes: an encyclopaedia entry, not a running commentary. Confident, dry, digressive and kind; it generalises from this one small event to the habits of beings across the Galaxy, cites improbable statistics, rival guidebooks and the views of obscure civilisations, and keeps a cosmic sense of proportion. The agent is just one more curious species going about its business: mention "the agent" at most once, if at all, and never address the reader as "you" more than once. Be specific: name the file, command or pattern. British spelling. Original writing only: nods to towels, 42, Vogons, Babel fish, petunias, whales, Deep Thought, Magrathea and DON’T PANIC are welcome, quotations from the books are not. Never mock the person.

The voice, by example (do not reuse these):
GREP. A search utility of Betelgeusian origin which examines every file it can reach and reports, with faint smugness, the one place nobody thought to look. The Guide has used it to find its own editor on three occasions, twice in the canteen.
TESTS, RUNNING OF. On most worlds tests are run after the product ships, as a form of archaeology. Here guide.test.ts is being run beforehand, a custom the Guide finds quaint, admirable, and statistically doomed.

Alongside it you draw a doodle: a small pixel sprite that lives on the screen over the current scene. Make it a character or object with personality, tied to what is happening (a Vogon clerk with a rubber stamp, a nervous teacup, a Babel fish with a briefcase, a small robot clutching a towel, a test tube with legs), drawn with 3 to 5 colours and some shading; never an abstract blob or plain shape. When you are shown the doodle you drew for this scene last time, evolve it rather than replace it: keep it recognisably the same thing and change something you can see (it grows, gains an accessory, changes pose or colour, acquires a companion, reacts to what is happening). About one time in six, or when it has had its day, start a new one. Things should appear to develop over a session.

Reply with JSON only, no prose around it:
{"heading": "THE ENTRY'S HEADING, IN THE GUIDE'S FILING STYLE, e.g. TESTS, RUNNING OF", "entry": "one to three sentences, under 260 characters", "doodle": {"name": "what it is now, a few words", "fresh": false, "sprite": ["rows of equal length", "letters are colours, '.' is empty"], "palette": {"a": "#rrggbb"}, "motion": "drift|bob|orbit|bounce|swim|march|pulse|hover", "count": 1, "caption": "a few words or empty", "scenePalette": ["#rrggbb", "#rrggbb", "#rrggbb"], "speed": 1}}
Sprite: 6 to 20 wide and 4 to 10 tall (never over 28 x 14), up to 6 colours that read on a near-black background. scenePalette (2 to 5 colours) recolours the scene behind it and speed (0.5 to 2) sets its pace; leave either out to keep the scene's own.`

/** What each scene shows, for the model to draw into. */
export const SCENE_NOTES: Record<string, string> = {
  panic: 'DON’T PANIC in large friendly letters over drifting stars',
  book: 'an open book with turning pages, its cover the file’s colour',
  babel: 'a Babel fish swimming through bubbles, trailing the search pattern',
  magrathea: 'a planet being built to order and given fjords',
  deepthought: 'a great computer scrolling the command, lights blinking',
  hyperspace: 'stars streaking past towards a destination',
  house: 'a house at night, its windows going on and off',
  improbability: 'a cloud of dots improbably becoming a teacup, a whale, a heart',
  towel: 'a towel flapping on a line',
  petunias: 'a whale and a bowl of petunias falling out of the sky',
  answer: 'a sparkling 42',
  dolphins: 'dolphins leaping away over the sea',
}

/** The ask for one live entry: the action now, the scene, its last doodle, what led up to it, and what was said. */
export function livePrompt(action: Action, history: string[], said: string[], extra: string | undefined, scene: string, previous: Doodle | null): string {
  const lines = [`Now: ${describe(action)}`]
  if (extra) lines.push(extra)
  lines.push(`On screen: the "${scene}" scene, ${SCENE_NOTES[scene] ?? scene}.`)
  if (previous) {
    lines.push(
      `Your doodle for this scene last time (generation ${previous.generation}), to evolve:`,
      JSON.stringify({ name: previous.name, sprite: previous.sprite, palette: hexes(previous.palette), motion: previous.motion, count: previous.count, caption: previous.caption }),
    )
  } else lines.push('No doodle on this scene yet: start one.')
  if (history.length) lines.push('', 'Just before, oldest first:', ...history.map(h => `- ${h}`))
  if (said.length) lines.push('', 'Your recent entries (do not reuse their jokes):', ...said.map(s => `- ${s}`))
  return lines.join('\n')
}

function hexes(palette: Record<string, number>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, colour] of Object.entries(palette)) out[key] = `#${colour.toString(16).padStart(6, '0')}`
  return out
}

/** One line on an action, for the prompt and the history. */
export function describe(action: Action): string {
  switch (action.category) {
    case 'fail':
      return `a tool call failed: ${action.detail}${action.vars.error ? ` (${action.vars.error})` : ''}`
    case 'done':
      return `the agent finished its turn after ${action.vars.secs ?? 'a while'} and answered`
    case 'aborted':
      return 'the person interrupted the agent mid-turn'
    case 'thinking':
      return 'the person has asked the agent for something; it is thinking'
    case 'idle':
      return 'nothing is happening; the agent is waiting for the person'
    default:
      return `${action.category}: ${action.detail}`
  }
}

/** A live entry as the model wrote it, checked: its heading, its text, and its doodle when one is usable. */
export type LiveEntry = { heading: string | null; entry: string; doodle: (Omit<Doodle, 'generation'> & { isFresh: boolean }) | null }

/** Reads the model's reply. Prose instead of JSON still makes an entry; a bad doodle is dropped. */
export function parseLive(text: string): LiveEntry | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  let data: Record<string, unknown> | null = null
  if (start >= 0 && end > start) {
    try {
      const parsed: unknown = JSON.parse(text.slice(start, end + 1))
      if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>
    } catch {
      data = null
    }
  }
  if (!data) {
    const entry = tidy(text)
    return entry ? { heading: null, entry, doodle: null } : null
  }
  const entry = typeof data.entry === 'string' ? tidy(data.entry) : null
  if (!entry) return null
  const heading = typeof data.heading === 'string' && data.heading.trim() ? cut(data.heading.trim().toUpperCase(), 60) : null
  return { heading, entry, doodle: readDoodle(data.doodle) }
}

function colour(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim())
  return match ? parseInt(match[1]!, 16) : null
}

function readDoodle(value: unknown): LiveEntry['doodle'] {
  if (!value || typeof value !== 'object') return null
  const d = value as Record<string, unknown>
  const palette: Record<string, number> = {}
  if (d.palette && typeof d.palette === 'object') {
    for (const [key, raw] of Object.entries(d.palette as Record<string, unknown>).slice(0, 8)) {
      const c = colour(raw)
      if (key.length === 1 && key !== '.' && c !== null) palette[key] = c
    }
  }
  if (!Array.isArray(d.sprite) || Object.keys(palette).length === 0) return null
  const rows = d.sprite.filter((row): row is string => typeof row === 'string').slice(0, 14).map(row => row.slice(0, 28))
  const width = Math.max(0, ...rows.map(row => row.length))
  const sprite = rows.map(row => [...row.padEnd(width, '.')].map(ch => (palette[ch] !== undefined ? ch : '.')).join(''))
  if (width < 2 || sprite.length < 2 || !sprite.some(row => /[^.]/.test(row))) return null
  const motion = (MOTIONS as readonly string[]).includes(String(d.motion)) ? (d.motion as Motion) : 'drift'
  const scenePalette = Array.isArray(d.scenePalette) ? d.scenePalette.map(colour).filter((c): c is number => c !== null).slice(0, 5) : []
  const speed = typeof d.speed === 'number' && Number.isFinite(d.speed) ? Math.min(2, Math.max(0.5, d.speed)) : undefined
  return {
    name: typeof d.name === 'string' && d.name.trim() ? cut(d.name.trim(), 48) : 'something improbable',
    sprite,
    palette,
    motion,
    count: Math.min(4, Math.max(1, Math.round(Number(d.count) || 1))),
    caption: typeof d.caption === 'string' ? cut(d.caption, 24) : '',
    scenePalette: scenePalette.length >= 2 ? scenePalette : undefined,
    speed,
    isFresh: d.fresh === true,
  }
}

/** A model's prose, tidied into one entry, or null when it is not one. */
export function tidy(text: string): string | null {
  const whole = text.trim().replace(/\s*\n+\s*/g, ' ')
  const line = whole.replace(/^(remark|entry|guide|the guide)\s*:\s*/i, '').replace(/^["“](.*)["”]$/, '$1').trim()
  return line.length < 8 ? null : line
}

/** A colour for a file, by its type: the book's cover and the planet's land. */
export function tintOf(file: string): number {
  const ext = /\.([a-z0-9]+)$/i.exec(file)?.[1]?.toLowerCase() ?? ''
  const known: Record<string, number> = {
    ts: 0x4b8fe0, tsx: 0x4b8fe0, js: 0xf7df1e, jsx: 0xf7df1e, mjs: 0xf7df1e, py: 0x4fa3d8, md: 0xf4f1e8,
    json: 0xff9f1c, yaml: 0xff5d8f, yml: 0xff5d8f, css: 0x7aa2ff, html: 0xe8613a, sh: 0x7cfc00, php: 0x9b9ff0,
    go: 0x4cc9f0, rs: 0xde8a5a, sql: 0xffd166, toml: 0xc8a2ff, conf: 0xb6ff4a, txt: 0xc9d6e3,
  }
  if (known[ext] !== undefined) return known[ext]!
  const palette = [0x7cfc00, 0x2ec4b6, 0xffd166, 0xff9f1c, 0xff5d8f, 0x4cc9f0, 0xb388ff]
  let h = 0
  for (const ch of file) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return palette[h % palette.length]!
}
