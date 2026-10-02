import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { cannedQuip, classify, parseLive, tidy } from '../hooks/guide'

const PANE_PROPS = {
  title: 'The Guide',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
}
const USAGE = { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }

function world(on: On) {
  const clock = mock.clock(on, { now: 1_000_000 })
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.blit', () => ({ value: {} }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  return clock
}

test('files tool calls the way the Guide would', () => {
  expect(classify('Read', { file_path: '/a/b/flow.ts' }).category).toBe('read')
  expect(classify('Read', { file_path: '/a/b/flow.ts' }).vars.file).toBe('flow.ts')
  expect(classify('Bash', { command: 'cd /x && npm test' }).flavour).toBe('tests')
  expect(classify('Bash', { command: 'git push origin Develop' }).flavour).toBe('push')
  expect(classify('Bash', { command: 'ssh -i key root@10.0.0.1 uptime' }).vars.host).toBe('root@10.0.0.1')
  expect(classify('mcp__vome__ha_get_state', {}).flavour).toBe('home')
  expect(classify('mcp__claude-in-chrome__navigate', {}).category).toBe('web')
  expect(classify('Agent', { description: 'Find the bug' }).vars.agent).toBe('Find the bug')
  // The canned remark names the file, and never repeats itself twice running.
  const read = classify('Read', { file_path: '/x/notes.md' })
  const one = cannedQuip(read, 3)
  expect(one.includes('notes.md') || one.includes('file')).toBe(true)
  expect(cannedQuip(read, 3)).not.toBe(one)
  expect(tidy('Remark: "The towel is ready."')).toBe('The towel is ready.')
  expect(tidy('  ')).toBe(null)
})

test('a tool call shows an instant remark, and the live one replaces it when it lands', async ($, on) => {
  const clock = world(on)
  const asked: string[] = []
  on('model.complete', (_$, e) => {
    asked.push(e.prompt)
    return { value: { isAnswered: true as const, text: 'The agent reads register.tsx as if it owed it money.', usage: USAGE } }
  })
  on('tool.call', { tool: 'Read' }, () => ({ result: 'contents', text: 'contents' }))

  await $.session.start({ source: 'startup', cwd: '/tmp' } as never)
  await $.tool.call({ tool: 'Read', file_path: '/repo/hooks/register.tsx' })
  const ui = await $.ui.mount({
    plugin: 'dont-panic',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'dont-panic',
    props: PANE_PROPS,
    viewport: { columns: 160, rows: 40 },
  })
  expect((await ui.find({ type: 'Raster' })) !== undefined).toBe(true)
  expect((await ui.find({ type: 'Text', text: 'FILES, THE READING OF' })) !== undefined).toBe(true)
  expect((await ui.find({ type: 'Text', text: /Read · register\.tsx/ })) !== undefined).toBe(true)

  await clock.advance(5_000)
  expect((await ui.find({ type: 'Text', text: /as if it owed it money/ })) !== undefined).toBe(true)
  // The model was told what is happening now.
  expect(asked.some(p => p.includes('register.tsx'))).toBe(true)
})

test('a failed call plays the petunias, counts a mishap, and words alone off the terminal', async ($, on) => {
  world(on)
  on('model.complete', () => ({ value: { isAnswered: false as const, reason: 'empty-reply' as const, usage: USAGE } }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'boom', text: 'exit 1', isError: true }))

  await $.session.start({ source: 'startup', cwd: '/tmp' } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  const ui = await $.ui.mount({
    plugin: 'dont-panic',
    surface: 'vscode',
    component: 'Pane',
    requestId: 'dont-panic',
    props: PANE_PROPS,
    viewport: { columns: 160, rows: 40 },
  })
  expect((await ui.find({ type: 'Raster' })) === undefined).toBe(true)
  expect((await ui.find({ type: 'Text', text: 'FAILURE, THE NOBLE ART OF' })) !== undefined).toBe(true)
  expect((await ui.find({ type: 'Text', text: /mishaps 1/ })) !== undefined).toBe(true)
})

test('when the model keeps failing, the Guide says so and stays on its canned remarks', async ($, on) => {
  const clock = world(on)
  let calls = 0
  on('model.complete', () => {
    calls += 1
    return { value: { isAnswered: false as const, reason: 'api-error' as const, status: 529, error: 'server_error' as const, usage: USAGE } }
  })
  on('tool.call', () => ({ result: 'ok', text: 'ok' }))

  await $.session.start({ source: 'startup', cwd: '/tmp' } as never)
  const ui = await $.ui.mount({
    plugin: 'dont-panic',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'dont-panic',
    props: PANE_PROPS,
    viewport: { columns: 160, rows: 40 },
  })
  for (const tool of ['Read', 'Grep', 'Edit', 'Glob', 'Write']) {
    await $.tool.call({ tool, file_path: '/r/a.ts', pattern: 'x', old_string: 'a', new_string: 'b', content: 'c' } as never)
    await clock.advance(5_000)
  }
  expect(calls).toBe(3)
  expect((await ui.find({ type: 'Text', text: /remarks canned \(API error 529\)/ })) !== undefined).toBe(true)
})

test('a long think gets fresh remarks, which show whole, under a screen filling the rest of the pane', async ($, on) => {
  const clock = world(on)
  const LONG =
    'Twenty seconds of silence. In that time a minor civilisation has risen, invented the spreadsheet, and filed for bankruptcy, and still the agent ponders, chin in metaphorical hand.'
  const prompts: string[] = []
  on('model.complete', (_$, e) => {
    prompts.push(e.prompt)
    return { value: { isAnswered: true as const, text: prompts.length > 1 ? LONG : 'Thinking begins.', usage: USAGE } }
  })

  on('prompt.submit', (_$, e) => e as never)
  await $.session.start({ source: 'startup', cwd: '/tmp' } as never)
  await $.prompt.submit({ text: 'Make the Guide better' } as never)
  const ui = await $.ui.mount({
    plugin: 'dont-panic',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'dont-panic',
    props: { ...PANE_PROPS, bodyColumns: 50, scroll: { offset: 0, bodyRows: 30 } },
    viewport: { columns: 160, rows: 40 },
  })
  await clock.advance(5_000)
  expect((await ui.find({ type: 'Text', text: 'Thinking begins.' })) !== undefined).toBe(true)

  // Twenty-odd seconds with no tool call: a new entry, asked about the long think itself.
  await clock.advance(21_000)
  expect(prompts.some(p => p.includes('Still thinking'))).toBe(true)
  expect((await ui.find({ type: 'Text', text: LONG })) !== undefined).toBe(true)
  expect((await ui.find({ type: 'Text', text: /Thinking for \d+ s/ })) !== undefined).toBe(true)

  // The words take topic + 4 wrapped rows + detail + footer = 7; the screen has the other 23.
  const raster = await ui.find({ type: 'Raster' })
  expect(raster?.props.rows).toBe(23)
})

test('entries come in the Guide voice with a heading, and each scene keeps a doodle that evolves', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.blit', () => ({ value: {} }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: 'ok', text: 'ok' }))
  const prompts: string[] = []
  const replies = [
    { heading: 'FILES, READING OF', entry: 'Reading is a habit common to most species with eyes and several without.', doodle: { name: 'a bookworm', fresh: true, sprite: ['.gg.', 'gggg'], palette: { g: '#7cfc00' }, motion: 'march', count: 1, caption: '' } },
    { heading: 'FILES, MORE READING OF', entry: 'A second file, which the Guide considers excessive but admirable.', doodle: { name: 'a bookworm in a monocle', fresh: false, sprite: ['.ggw', 'gggg'], palette: { g: '#7cfc00', w: '#ffffff' }, motion: 'march', count: 1, caption: 'HMM' } },
  ]
  on('model.complete', (_$, e) => {
    prompts.push(e.prompt)
    const reply = e.prompt.includes('two.ts') ? replies[1] : replies[0]
    return { value: { isAnswered: true as const, text: JSON.stringify(reply), usage: USAGE } }
  })

  await $.session.start({ source: 'startup', cwd: '/tmp' } as never)
  const ui = await $.ui.mount({
    plugin: 'dont-panic',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'dont-panic',
    props: PANE_PROPS,
    viewport: { columns: 160, rows: 40 },
  })
  await clock.advance(5_000)
  await $.tool.call({ tool: 'Read', file_path: '/r/one.ts' })
  await clock.advance(5_000)
  expect((await ui.find({ type: 'Text', text: 'FILES, READING OF' })) !== undefined).toBe(true)
  expect((await ui.find({ type: 'Text', text: /On screen: a bookworm$/ })) !== undefined).toBe(true)

  // The next reading entry (past the hold) hands the bookworm back to be evolved, and counts its generation.
  await clock.advance(2_000)
  await $.tool.call({ tool: 'Read', file_path: '/r/two.ts' })
  await clock.advance(5_000)
  const last = prompts[prompts.length - 1] ?? ''
  expect(last.includes('"book" scene')).toBe(true)
  expect(last.includes('a bookworm') && last.includes('generation 1')).toBe(true)
  expect((await ui.find({ type: 'Text', text: /a bookworm in a monocle, generation 2/ })) !== undefined).toBe(true)
  expect((await ui.find({ type: 'Text', text: 'FILES, MORE READING OF' })) !== undefined).toBe(true)
})

test('a doodle the screen cannot draw is dropped, and prose still makes an entry', () => {
  const bad = parseLive(JSON.stringify({ heading: 'x', entry: 'A perfectly good entry, with no usable doodle.', doodle: { sprite: ['zz'], palette: { a: 'red' } } }))
  expect(bad?.doodle).toBe(null)
  expect(bad?.entry).toBe('A perfectly good entry, with no usable doodle.')
  const prose = parseLive('Towels, the importance of: considerable.')
  expect(prose?.heading).toBe(null)
  const odd = parseLive(JSON.stringify({ entry: 'Fine words here.', doodle: { sprite: ['aXa', 'aaaa'], palette: { a: '#ff0000' }, motion: 'teleport', count: 9 } }))
  expect(odd?.doodle?.sprite).toEqual(['a.a.', 'aaaa'])
  expect(odd?.doodle?.motion).toBe('drift')
  expect(odd?.doodle?.count).toBe(4)
})

test('a reply with a stray closing brace, fences or a cut-off end never shows as raw JSON', () => {
  // As it arrived: one brace too many at the end.
  const stray =
    '{"heading":"PAUSES, LONG, IN THE MIDDLE OF A RESOLVER","entry":"Twenty seconds without a single tool call after ts-resolve.mjs is, the Guide notes, how most civilisations compose, rehearse and quietly discard a plan.","doodle":{"name":"Navigator robot","fresh":false,"sprite":["..cc..","cccccc"],"palette":{"c":"#9ad1d4"},"motion":"hover","count":1,"caption":"an idea, possibly"}}}'
  const read = parseLive(stray)
  expect(read?.heading).toBe('PAUSES, LONG, IN THE MIDDLE OF A RESOLVER')
  expect(read?.entry.startsWith('Twenty seconds')).toBe(true)
  expect(read?.doodle?.name).toBe('Navigator robot')

  const fenced = parseLive('```json\n{"heading": "GREP", "entry": "A search utility of some renown."}\n```')
  expect(fenced?.entry).toBe('A search utility of some renown.')

  // Cut off mid-doodle: the heading and entry are still had, and no braces reach the screen.
  const cut = parseLive('{"heading": "TOWELS", "entry": "Towels are \\"useful\\", on the whole.", "doodle": {"name": "a towel", "sprite": ["tt')
  expect(cut?.entry).toBe('Towels are "useful", on the whole.')
  expect(cut?.heading).toBe('TOWELS')
  expect(parseLive('{"doodle": {"name": "no entry at all"')).toBe(null)
})
