import type { EngineInterface, Register } from 'claude-code'

import type { Category, Entry, Stats } from '../types'
import { baseName, cannedQuip, classify, cut, describe, LIVE_SYSTEM, livePrompt, parseLive, tintOf, TOPICS } from './guide'
import type { Action } from './guide'
import { MIN_ROWS, screen } from './screen'
import type { Doodle, Look, Scene } from './screen'

const PANE = 'dont-panic'
const TITLE = 'The Guide'
/** The screen's frame interval: 20 a second. */
const FRAME_MS = 50
/** How often the live remarks, the idle check and the thinking refresh look for work. */
const TICK_MS = 500
/** An entry stays at least this long before another of the same kind replaces it. */
const HOLD_MS = 6_000
/** At most one live remark this often. */
const LIVE_GAP_MS = 6_000
const LIVE_TIMEOUT_MS = 25_000
/** Where each scene's doodle lineage is kept, across sessions. */
const VARIANTS_KEY = 'variants'
const MODEL_KEY = 'model'
/** Which model writes the entries: sonnet has the voice; haiku is cheaper and quicker. */
const MODELS = ['sonnet', 'haiku', 'opus'] as const
/** After this many live failures in a row, the remarks go back to the canned ones. */
const LIVE_STRIKES = 3
/** A turn thinking this long without a tool call gets a fresh scene and remark. */
const THINK_REFRESH_MS = 20_000
/** Quiet this long after a turn, the Guide settles into its idle entry. */
const IDLE_MS = 120_000
/** How long a failure, an answer or an interruption plays before the scene goes back. */
const FX_MS = 4_500
/** The tallest the screen grows, in terminal rows. */
const MAX_ROWS = 80

const SCENES: Record<Category, Scene> = {
  read: 'book',
  search: 'babel',
  edit: 'magrathea',
  shell: 'deepthought',
  web: 'hyperspace',
  mcp: 'hyperspace',
  agent: 'improbability',
  plan: 'towel',
  ask: 'towel',
  other: 'towel',
  fail: 'petunias',
  done: 'answer',
  aborted: 'dolphins',
  thinking: 'panic',
  idle: 'panic',
}
/** What a long think shows, a different one each time it goes on. */
const THINKING: { scene: Scene; label: string }[] = [
  { scene: 'panic', label: 'THINKING' },
  { scene: 'improbability', label: 'DEEP THOUGHT' },
  { scene: 'deepthought', label: 'CALCULATING THE QUESTION' },
  { scene: 'hyperspace', label: 'SOMEWHERE ELSE' },
  { scene: 'towel', label: 'HOLD ON' },
  { scene: 'babel', label: 'TRANSLATING' },
]
/** Moments that play once over the working scene, then step aside. */
const MOMENTS = new Set<Category>(['fail', 'done', 'aborted'])
const AMBER = 0xffd166

const entry = { plugin: 'dont-panic', key: 'entry' } as const
const stats = { plugin: 'dont-panic', key: 'stats' } as const
const isStill = { plugin: 'dont-panic', key: 'isStill' } as const
const isLive = { plugin: 'dont-panic', key: 'isLive' } as const
const liveNote = { plugin: 'dont-panic', key: 'liveNote' } as const

// The module's own variables start over on a reload; what the pane shows lives in $.state.
let look: Look = { scene: 'panic', seed: 1, label: '', tint: AMBER, amount: 0 }
let lookAt = Date.now()
let moment: { look: Look; at: number } | null = null
let site: { columns: number; rows: number } | null = null
let isBlitting = false
let isFrozen = false
let seq = 0
let shownAt = 0
let shownCategory: Category | null = null
let lastActivity = 0
let isIdle = true
/** When the running turn started: from its prompt to its turn.complete; 0 between turns. */
let turnStartedAt = 0
let thinkings = 0
/** The latest committed action still owed a live entry, and the scene it was shown on. */
let want: { seq: number; action: Action; extra?: string; scene: Scene } | null = null
/** Each scene's latest doodle: what the model evolves next time that scene comes up. */
let variants: Partial<Record<Scene, Doodle>> = {}
let isAsking = false
let lastAskedAt = -Infinity
let strikes = 0
let liveOn = true
let modelName: string = 'sonnet'
const history: string[] = []
const said: string[] = []

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'guide',
      description: 'Open the Guide: animated, irreverent commentary on what the agent is doing',
      argumentHint: '[still | move | live | canned | fresh | model sonnet|haiku|opus]',
    })
    isFrozen = (await $.state.get(isStill)).value ?? false
    liveOn = (await $.state.get(isLive)).value ?? true
    variants = await loadVariants($)
    modelName = await loadModel($)
    $.clock.every(FRAME_MS, () => void animate($))
    $.clock.every(TICK_MS, () => void tick($))
    if (!(await $.state.get(entry)).value) await commit($, idleAction(), 'Welcome aboard.')
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'guide' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'still' || arg === 'move') {
      isFrozen = arg === 'still'
      await $.state.set(isStill, isFrozen)
    }
    if (arg === 'live' || arg === 'canned') {
      liveOn = arg === 'live'
      strikes = 0
      await $.state.set(isLive, liveOn)
      await $.state.set(liveNote, null)
    }
    const chosen = /^model\s+(\w+)$/.exec(arg)?.[1]
    if (chosen && (MODELS as readonly string[]).includes(chosen)) {
      modelName = chosen
      strikes = 0
      await saveModel($)
    }
    if (arg === 'fresh') {
      // Every scene's lineage starts over: the next entries draw new doodles.
      variants = {}
      look = { ...look, doodle: undefined }
      await saveVariants($)
    }
    const opened = await $.ui.open({ id: PANE, title: TITLE, focus: true })
    const where = opened.isPlaced ? '' : ` It is not drawn here: ${opened.reason}.`
    const mode = `${isFrozen ? 'still' : 'animated'}, ${liveOn ? `live entries by ${modelName}` : 'canned entries'}`

    return { text: `The Guide is open (${mode}). DON’T PANIC.${where}` }
  })

  on('prompt.submit', async ($, e, next) => {
    turnStartedAt = await $.clock.now()
    thinkings = 0
    const asked = typeof e.text === 'string' ? e.text : ''
    const extra = asked ? `The request: "${cut(asked, 240)}"` : undefined
    await commit($, { category: 'thinking', tool: '', detail: '', vars: {}, label: 'THINKING' }, undefined, extra)

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const action = classify(e.tool, e as unknown as Record<string, unknown>)
    await see($, action)
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError) {
      const error = cut(ran.deny ?? ran.text ?? '', 90)
      const name = e.tool.startsWith('mcp__') ? e.tool.split('__').slice(2).join('__') : e.tool
      await bump($, s => ({ ...s, mishaps: s.mishaps + 1 }))
      await commit($, { ...action, category: 'fail', flavour: undefined, label: name, vars: { ...action.vars, tool: action.vars.tool ?? name, error } })
    }

    return ran
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      turnStartedAt = 0
      const secs = `${Math.max(1, Math.round(e.durationMs / 1000))} s`
      if (e.isAborted) await commit($, { category: 'aborted', tool: '', detail: '', vars: {}, label: 'SO LONG' })
      else if (e.reason === 'answer') {
        await bump($, s => ({ ...s, answers: s.answers + 1 }))
        const extra = e.answer ? `Its answer began: "${cut(e.answer, 240)}"` : undefined
        await commit($, { category: 'done', tool: '', detail: `Answered after ${secs}`, vars: { secs }, label: `IN ${secs.replace(' ', '')}` }, undefined, extra)
      }
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const shown = (await $.state.get(entry)).value ?? null
    const counts = (await $.state.get(stats)).value ?? { consulted: 0, mishaps: 0, answers: 0 }
    const isLiveNow = (await $.state.get(isLive)).value ?? true
    const note = (await $.state.get(liveNote)).value ?? null
    const quip = shown?.quip ?? 'DON’T PANIC.'
    const columns = Math.max(10, Math.min(512, e.props.bodyColumns))

    // The screen is a Raster, which only the terminal draws; elsewhere the Guide is words alone.
    // It takes every row the words leave, so the remark always shows whole beneath it.
    let screenStrip = null
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      const words = 1 + wrappedRows(quip, columns) + (shown?.detail ? 1 : 0) + (shown?.art ? 1 : 0) + 1
      const rows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, e.props.scroll.bodyRows - words))
      site = { columns, rows }
      screenStrip = <Raster key="screen" columns={columns} rows={rows} cells={frameNow(columns, rows)} />
    } else {
      site = null
    }
    const remarks = isLiveNow ? (note ? `canned (${note})` : `live, ${modelName}`) : 'canned'

    return (
      <Box flexDirection="column">
        {screenStrip}
        <Text bold color="#7cfc00" wrap="truncate-end">
          {(shown?.topic ?? TOPICS.idle).toUpperCase()}
        </Text>
        <Text wrap="wrap">{quip}</Text>
        {shown?.detail ? (
          <Text dimColor wrap="truncate-end">
            {shown.detail}
          </Text>
        ) : null}
        {shown?.art ? (
          <Text dimColor italic wrap="truncate-end">
            On screen: {shown.art}
          </Text>
        ) : null}
        <Text dimColor wrap="truncate-end">
          Entries consulted {counts.consulted} {'·'} mishaps {counts.mishaps} {'·'} answers {counts.answers} {'·'} remarks {remarks}
        </Text>
      </Box>
    )
  })
}

/** How many rows `text` takes wrapped at word boundaries in `columns`. */
export function wrappedRows(text: string, columns: number): number {
  let rows = 1
  let used = 0
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (used === 0) used = word.length
    else if (used + 1 + word.length <= columns) used += 1 + word.length
    else {
      rows += 1
      used = word.length
    }
    while (used > columns) {
      rows += 1
      used -= columns
    }
  }
  return rows
}

// ---------------------------------------------------------------- entries

function idleAction(): Action {
  return { category: 'idle', tool: '', detail: '', vars: {} }
}

/** A tool is about to run: count it, remember it, and file an entry if one is due. */
async function see($: EngineInterface, action: Action) {
  await bump($, s => ({ ...s, consulted: s.consulted + 1 }))
  history.push(describe(action))
  if (history.length > 6) history.shift()
  const now = await $.clock.now()
  lastActivity = now
  const isDue = action.category !== shownCategory || now - shownAt >= HOLD_MS
  if (isDue) {
    await commit($, action, undefined, undefined, false)
    return
  }
  // Same kind, too soon for a new remark: the facts follow along, on the words and the screen.
  const shown = (await $.state.get(entry)).value
  if (shown) await $.state.set(entry, { ...shown, detail: action.detail })
  const next = lookFor(action)
  if (next.scene === look.scene) look = { ...look, label: next.label, tint: next.tint, flavour: next.flavour, amount: next.amount }
}

/** Puts `action` on screen with an instant remark, and asks for a live one to follow. */
async function commit($: EngineInterface, action: Action, quip?: string, extra?: string, isRemembered = true, scene?: Scene) {
  seq += 1
  shownAt = await $.clock.now()
  shownCategory = action.category
  lastActivity = shownAt
  isIdle = action.category === 'idle'
  if (isRemembered && action.category !== 'idle') {
    history.push(describe(action))
    if (history.length > 6) history.shift()
  }
  const next: Entry = {
    category: action.category,
    topic: TOPICS[action.category],
    quip: quip ?? cannedQuip(action, seq * 7 + (Date.now() % 97)),
    detail: action.detail,
    art: null,
  }
  await $.state.set(entry, next)
  show(action, scene)
  const shownScene = moment?.look.scene ?? look.scene
  if (liveOn) want = { seq, action, extra, scene: shownScene }
}

/** The scene for `action`, with this time's variations and what makes it relevant. */
function lookFor(action: Action, scene?: Scene): Look {
  const chosen = scene ?? (action.category === 'mcp' && action.flavour === 'home' ? 'house' : SCENES[action.category])
  const label = action.label ?? ''
  const isFile = action.category === 'read' || action.category === 'edit'
  return {
    scene: chosen,
    seed: (seq * 7919 + Math.floor(Math.random() * 100_000)) % 100_003,
    label: isFile ? baseName(label) : label,
    tint: isFile ? tintOf(label) : tintOf(`${action.category}:${label}`),
    flavour: action.flavour,
    amount: action.amount ?? 0.4,
    doodle: variants[chosen],
  }
}

function show(action: Action, scene?: Scene) {
  const next = lookFor(action, scene)
  if (MOMENTS.has(action.category)) {
    moment = { look: next, at: Date.now() }
    // After an answer or an interruption the screen settles on its cover, not the last tool.
    if (action.category !== 'fail') {
      look = { ...next, scene: 'panic', label: '' }
      lookAt = Date.now()
    }
    return
  }
  moment = null
  // A new look every entry: the same scene restarts with different variations.
  look = next
  lookAt = Date.now()
}

async function loadVariants($: EngineInterface): Promise<Partial<Record<Scene, Doodle>>> {
  try {
    const kept = await $.store.get(VARIANTS_KEY)
    return kept && typeof kept === 'object' ? (kept as Partial<Record<Scene, Doodle>>) : {}
  } catch {
    return {}
  }
}

async function loadModel($: EngineInterface): Promise<string> {
  try {
    const kept = await $.store.get(MODEL_KEY)
    return typeof kept === 'string' && (MODELS as readonly string[]).includes(kept) ? kept : 'sonnet'
  } catch {
    return 'sonnet'
  }
}

async function saveModel($: EngineInterface) {
  try {
    await $.store.set(MODEL_KEY, modelName)
  } catch {
    // Kept for this session only.
  }
}

async function saveVariants($: EngineInterface) {
  try {
    await $.store.set(VARIANTS_KEY, variants)
  } catch {
    // Not kept past this session, then; the lineage still develops within it.
  }
}

async function bump($: EngineInterface, fn: (s: Stats) => Stats) {
  const now = (await $.state.get(stats)).value ?? { consulted: 0, mishaps: 0, answers: 0 }
  await $.state.set(stats, fn(now))
}

// ---------------------------------------------------------------- live remarks, thinking and idling

async function tick($: EngineInterface) {
  const now = await $.clock.now()
  if (!isIdle && turnStartedAt === 0 && now - lastActivity > IDLE_MS && (shownCategory === 'done' || shownCategory === 'aborted')) {
    await commit($, idleAction())
  }
  // A long think with no tool calls: a new scene and a new remark, so the Guide never sits still.
  if (turnStartedAt > 0 && now - lastActivity >= THINK_REFRESH_MS) {
    thinkings += 1
    const secs = Math.round((now - turnStartedAt) / 1000)
    const quiet = Math.round((now - lastActivity) / 1000)
    const chosen = THINKING[(thinkings + Math.floor(Math.random() * THINKING.length)) % THINKING.length]!
    const last = history[history.length - 1]
    const extra = `Still thinking: ${secs} s into this turn, no tool calls for ${quiet} s${last ? `; the last thing it did: ${last}` : ''}. Remark on the long think itself.`
    const action: Action = { category: 'thinking', tool: '', detail: `Thinking for ${secs} s`, vars: {}, label: chosen.label }
    await commit($, action, undefined, extra, false, chosen.scene)
  }
  if (!want || isAsking || !liveOn || now - lastAskedAt < LIVE_GAP_MS) return
  const asking = want
  want = null
  isAsking = true
  lastAskedAt = now
  try {
    const previous = variants[asking.scene] ?? null
    const reply = await $.model.complete({
      model: modelName,
      system: LIVE_SYSTEM,
      prompt: livePrompt(asking.action, history.slice(0, -1), said, asking.extra, asking.scene, previous),
      maxTokens: 900,
      effort: 'low',
      timeoutMs: LIVE_TIMEOUT_MS,
    })
    const live = reply.isAnswered ? parseLive(reply.text) : null
    if (!live) {
      strikes += 1
      if (strikes >= LIVE_STRIKES) {
        liveOn = false
        const why = reply.isAnswered ? 'replies were empty' : reply.reason === 'api-error' ? `API error ${reply.status ?? ''}`.trim() : reply.reason
        await $.state.set(liveNote, why)
      }
      return
    }
    strikes = 0
    said.push(live.entry)
    if (said.length > 5) said.shift()
    // The doodle joins its scene's lineage whatever happens next, so the scene develops.
    let art: string | null = null
    if (live.doodle) {
      const { isFresh, ...drawn } = live.doodle
      const doodle: Doodle = { ...drawn, generation: isFresh || !previous ? 1 : previous.generation + 1 }
      variants[asking.scene] = doodle
      await saveVariants($)
      if (look.scene === asking.scene) look = { ...look, doodle }
      if (moment && moment.look.scene === asking.scene) moment = { ...moment, look: { ...moment.look, doodle } }
      art = `${doodle.name}${doodle.generation > 1 ? `, generation ${doodle.generation}` : ''}`
    }
    // Only onto the entry it was written for: a newer one keeps its own words.
    const shown = (await $.state.get(entry)).value
    if (shown && asking.seq === seq) await $.state.set(entry, { ...shown, quip: live.entry, topic: live.heading ?? shown.topic, art })
  } catch (error) {
    liveOn = false
    await $.state.set(liveNote, cut(String(error), 60))
  } finally {
    isAsking = false
  }
}

// ---------------------------------------------------------------- the screen

function frameNow(columns: number, rows: number): string {
  const now = Date.now()
  if (moment && now - moment.at > FX_MS) moment = null
  const showing = moment ?? { look, at: lookAt }
  const t = isFrozen ? 1.5 : (now - showing.at) / 1000

  return screen(showing.look, t, isFrozen ? 1.5 : now / 1000, columns, rows)
}

async function animate($: EngineInterface) {
  if (isFrozen || !site || isBlitting) return
  isBlitting = true
  try {
    const result = await $.ui.blit({ requestId: PANE, key: 'screen', cells: frameNow(site.columns, site.rows) })
    // Not mounted (the pane closed, or redrawn at another size): wait for the next drawing.
    if (result.deny !== undefined) site = null
  } catch {
    site = null
  } finally {
    isBlitting = false
  }
}
