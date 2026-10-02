// The Guide's screen: one scene per kind of activity, drawn in braille dots (2 x 4 per
// terminal cell, one colour per cell; the dots come out square). Pure: one frame per call,
// as Raster cells, at whatever size the pane gives it.
//
// Each scene is the same idea every time but never quite the same picture: a Look carries a
// seed that picks its variations (palette, direction, how many, a ring or a moon), and the
// facts that make it relevant (a label to spell out, a tint, a flavour, an amount).
//
//   panic          idle and thinking: DON'T PANIC in large, friendly letters over drifting stars
//   book           reading: an open book, its cover the file type's colour, its title the file
//   babel          searching: a Babel fish (or a school, for a glob) trailing the pattern
//   magrathea      editing: the file as a planet, built new for a write, given fjords for an edit
//   deepthought    the shell: a great computer scrolling the command, lights by the kind of command
//   hyperspace     the web and remote servers: stars streaking past, the destination looming
//   house          the home's own devices: a house whose windows come and go
//   improbability  subagents: a cloud of dots improbably becoming a teacup, a whale, a heart
//   towel          planning, asking, anything else: a towel flapping, with something printed on it
//   petunias       a failure: a whale and a bowl of petunias falling out of the sky
//   answer         a turn answered: 42, and how long it took
//   dolphins       an interruption: dolphins leaping away

export type Scene =
  | 'panic'
  | 'book'
  | 'babel'
  | 'magrathea'
  | 'deepthought'
  | 'hyperspace'
  | 'house'
  | 'improbability'
  | 'towel'
  | 'petunias'
  | 'answer'
  | 'dolphins'

/** What a scene shows this time: which scene, its variations' seed, and what it is about. */
export type Look = {
  scene: Scene
  seed: number
  /** Words the scene spells out (a file, a pattern, a command, a host); may be ''. */
  label: string
  /** The colour of the thing (a file type's colour, say). */
  tint: number
  /** Narrower than the scene: glob, write, tests, push, rm, ssh, build, wait, ... */
  flavour?: string
  /** How much, 0 to 1: the size of an edit. */
  amount: number
  /** The model's own addition to this scene, evolved from its last one: drawn over the scene. */
  doodle?: Doodle
}

/** Ways a doodle moves. */
export const MOTIONS = ['drift', 'bob', 'orbit', 'bounce', 'swim', 'march', 'pulse', 'hover'] as const
export type Motion = (typeof MOTIONS)[number]

/**
 * A sprite the model drew for a scene, and how the scene around it changed: kept per scene and
 * handed back next time to evolve, so the screen develops rather than repeats.
 */
export type Doodle = {
  /** What it is, in a few words: "a bookworm in a monocle". */
  name: string
  /** Rows of letters, each a colour from `palette`; '.' is clear. At most 28 x 14. */
  sprite: string[]
  palette: Record<string, number>
  motion: Motion
  /** How many of it, 1 to 4. */
  count: number
  /** A few words it carries; may be ''. */
  caption: string
  /** Colours the scene uses in place of its own palettes, when given. */
  scenePalette?: number[]
  /** How fast the scene runs, 0.5 to 2. */
  speed?: number
  /** How many times it has evolved. */
  generation: number
}

/** The fewest terminal rows the screen takes. */
export const MIN_ROWS = 4

const PANEL = 0x0a0f1a
const STAR = 0x3b4a6b
const WHITE = 0xf4f1e8
const GREEN = 0x7cfc00
const LIME = 0xb6ff4a
const ORANGE = 0xff9f1c
const AMBER = 0xffd166
const PINK = 0xff5d8f
const RED = 0xff453a
const CYAN = 0x4cc9f0
const TEAL = 0x2ec4b6
const BLUE = 0x3a6ea5
const DEEP = 0x1d4e89
const GREY = 0x8e96a3
const STEEL = 0x5b7fa6
const SLATE = 0x7d8fa3
const BELLY = 0xc9d6e3
const BROWN = 0xc8743a
const YELLOW = 0xffe45e
const VIOLET = 0xb388ff

const PALETTES = [
  [AMBER, ORANGE, PINK, TEAL, LIME],
  [GREEN, LIME, TEAL, CYAN],
  [PINK, ORANGE, AMBER, YELLOW],
  [CYAN, VIOLET, PINK, WHITE],
  [YELLOW, LIME, CYAN, AMBER],
]

type Pixels = { w: number; h: number; px: Uint32Array }
type Ctx = {
  p: Pixels
  /** Seconds since the scene started. */
  t: number
  /** Seconds on the wall clock: for things that should not restart with the scene. */
  now: number
  look: Look
  /** Sprite scale: 1 at six rows, more as the pane grows. */
  S: number
  /** Scale of the small lettering. */
  k: number
  /** The seed's variation number `n`, 0 to 1. */
  r: (n: number) => number
  /** A palette for the scene: the doodle's choice when it made one, else one of ours. */
  palette: (u: number) => number[]
}

/** One frame of `look`, `t` seconds after it started, `now` seconds on the wall clock. */
export function screen(look: Look, t: number, now: number, columns: number, rows: number): string {
  const w = columns * 2
  const h = rows * 4
  const p: Pixels = { w, h, px: new Uint32Array(w * h) }
  const S = Math.max(1, Math.floor(h / 24))
  // Lettering grows with the screen: 3 x 5 dots is legible only on a short one.
  const k = Math.max(1, Math.min(Math.floor(h / 20), Math.floor(w / 40) + 1, 4))
  const doodle = look.doodle
  const speed = doodle?.speed ?? 1
  const own = doodle?.scenePalette && doodle.scenePalette.length >= 2 ? doodle.scenePalette : null
  const palette = (u: number) => own ?? pick(PALETTES, u)
  DRAW[look.scene]({ p, t: t * speed, now: now * speed, look, S, k, r: n => hash(look.seed * 31.7 + n * 7.3), palette })
  if (doodle) drawDoodle(p, doodle, t, now, S, k, look.seed)
  return encode(p, columns, rows)
}

/** The model's sprite, moving its own way over the scene, with its caption beside the first. */
function drawDoodle(p: Pixels, d: Doodle, t: number, now: number, S: number, k: number, seed: number) {
  const s = Math.max(1, Math.min(S, Math.floor(p.h / (d.sprite.length * 2)) || 1))
  const sw = (d.sprite[0]?.length ?? 1) * s
  const sh = d.sprite.length * s
  for (let i = 0; i < d.count; i++) {
    const ph = i / d.count + hash(seed + i) * 0.3
    const at = place(d.motion, p, sw, sh, t, now, ph, i)
    const isFlipped = at.dir < 0
    const isBlinkedOff = d.motion === 'pulse' && Math.sin(now * 4 + i) < -0.6
    if (!isBlinkedOff) sprite(p, d.sprite, Math.round(at.x), Math.round(at.y), d.palette, s, isFlipped)
    if (i === 0 && d.caption) {
      const cy = at.y > 6 * k + 1 ? at.y - 6 * k : at.y + sh + k
      const width = textWidth(clip(d.caption, 24), k)
      const cx = Math.max(1, Math.min(p.w - width - 1, Math.round(at.x + sw / 2 - width / 2)))
      tiny(p, d.caption, cx, Math.round(cy), k, () => WHITE)
    }
  }
}

function place(motion: Motion, p: Pixels, sw: number, sh: number, t: number, now: number, ph: number, i: number) {
  const roomX = Math.max(1, p.w - sw)
  const roomY = Math.max(1, p.h - sh)
  const across = (speed: number) => (((t * speed + ph * (p.w + sw)) % (p.w + sw)) + p.w + sw) % (p.w + sw) - sw
  switch (motion) {
    case 'drift':
      return { x: across(6), y: roomY * (0.2 + 0.6 * hash(i + 3.1)) + Math.sin(now + i) * 2, dir: 1 }
    case 'bob':
      return { x: roomX * (0.15 + 0.7 * ((ph + 0.5) % 1)), y: roomY * 0.5 + Math.sin(now * 2 + i) * Math.min(6, roomY / 3), dir: 1 }
    case 'orbit': {
      const a = now * 0.9 + ph * Math.PI * 2
      return { x: roomX / 2 + Math.cos(a) * roomX * 0.4, y: roomY / 2 + Math.sin(a) * roomY * 0.4, dir: Math.sin(a) > 0 ? -1 : 1 }
    }
    case 'bounce': {
      const bx = (now * 9 + ph * roomX * 2) % (roomX * 2)
      const by = (now * 5 + ph * roomY * 2) % (roomY * 2)
      return { x: bx < roomX ? bx : roomX * 2 - bx, y: by < roomY ? by : roomY * 2 - by, dir: bx < roomX ? 1 : -1 }
    }
    case 'swim':
      return { x: across(10), y: roomY / 2 + Math.sin(t * 2 + ph * 6) * roomY * 0.35, dir: 1 }
    case 'march':
      return { x: across(5), y: roomY - Math.abs(Math.sin(t * 6 + i)) * 2, dir: 1 }
    case 'pulse':
      return { x: roomX * (0.5 + (i - 0.5) * 0.3), y: roomY * 0.5, dir: 1 }
    default:
      return { x: roomX * (0.82 - i * 0.22), y: 2 + Math.sin(now * 1.5 + i) * 2, dir: -1 }
  }
}

const DRAW: Record<Scene, (c: Ctx) => void> = {
  panic(c) {
    const { p, now, r, look, k } = c
    stars(p, now, 0.6, r(9))
    const words = "DON'T PANIC"
    const labelRows = look.label ? 7 * k : 0
    const scale = Math.max(1, Math.min(Math.floor((p.w - 4) / width(words, 1)), Math.floor(((p.h - labelRows) * 0.7) / 7)))
    const palette = c.palette(r(1))
    const style = Math.floor(r(2) * 3)
    const x0 = Math.floor((p.w - width(words, scale)) / 2)
    const y0 = Math.floor((p.h - labelRows - 7 * scale) / 2)
    let x = x0
    for (let i = 0; i < words.length; i++) {
      const glyph = FONT[words[i]!]!
      let dy = 0
      let colour = palette[Math.floor(now * 0.8 + i * 0.35) % palette.length]!
      if (style === 0) dy = Math.round(Math.sin(now * 2.4 + i * 0.6) * scale)
      else if (style === 1) {
        // One letter at a time hops, left to right.
        const hop = (now * 4) % (words.length + 6)
        const near = Math.max(0, 1 - Math.abs(i - hop))
        dy = -Math.round(near * scale * 2)
      } else colour = palette[(((Math.floor(now * 6) - i) % palette.length) + palette.length) % palette.length]!
      drawGlyph(p, glyph, x, y0 + dy, scale, colour)
      x += (glyph[0]!.length + 1) * scale
    }
    if (look.label) tiny(p, look.label, null, y0 + 7 * scale + 3 * k, k, () => GREY)
  },

  book(c) {
    const { p, t, r, look, k, S } = c
    const titleRows = look.label ? 5 * k + 3 : 1
    const top = titleRows + 1
    const bottom = p.h - 2 - S
    const cx = Math.floor(p.w / 2)
    const pageW = Math.max(6, Math.min(Math.floor(p.w / 2) - 4, Math.round((bottom - top) * 1.3)))
    // The cover, peeking out round the pages, in the file type's colour.
    box(p, cx - pageW - 2, top - 1, cx + pageW + 2, bottom + 2, look.tint)
    box(p, cx - pageW - 3, top - 1, cx + pageW + 3, bottom + 3, look.tint)
    const density = 0.15 + r(3) * 0.35
    for (let y = top; y <= bottom; y++) {
      for (let dx = 1; dx <= pageW; dx++) {
        const isEdge = y === top || y === bottom || dx === pageW
        const isLine = (y - top) % 3 === 2 && dx > 2 && dx < pageW - 2 && hash(dx * 3 + y + r(4) * 50) > density
        const colour = isEdge ? BELLY : isLine ? GREY : 0
        if (colour) {
          put(p, cx - dx, y, colour)
          put(p, cx + dx, y, colour)
        }
      }
    }
    for (let y = top - 1; y <= bottom + 1; y++) put(p, cx, y, BROWN)
    // A ribbon, a different colour each time.
    const ribbon = pick(PALETTES[0]!, r(5))
    for (let y = bottom; y < bottom + 2 + S; y++) put(p, cx + 3, y, ribbon)
    // The turning page: its free edge swings from the right page to the left.
    const period = 1.6 + r(6) * 1.4
    const phase = (t % period) / period
    const swing = Math.min(1, phase * 1.3)
    const edge = Math.round(Math.cos(Math.PI * swing) * pageW)
    if (edge !== 0) {
      const lift = Math.round(Math.sin(Math.PI * swing) * 2 * S)
      for (let y = top - lift; y <= bottom - lift; y++) put(p, cx + edge, y, WHITE)
      for (let x = Math.min(cx, cx + edge); x <= Math.max(cx, cx + edge); x++) {
        put(p, x, top - lift, WHITE)
        put(p, x, bottom - lift, WHITE)
      }
    }
    if (look.label) tiny(p, look.label, null, 1, k, () => look.tint)
  },

  babel(c) {
    const { p, t, now, r, look, S, k } = c
    for (let n = 0; n < Math.max(6, p.w / 8); n++) {
      const x = Math.floor(hash(n * 4.7 + r(1)) * p.w)
      const rise = (now * (3 + hash(n) * 4) * S + hash(n * 2.3) * p.h) % (p.h + 4)
      put(p, x + Math.round(Math.sin(now * 3 + n) * S), p.h - Math.floor(rise), n % 3 === 0 ? CYAN : STAR)
    }
    const isRight = r(2) > 0.5
    const isSchool = look.flavour === 'glob'
    const size = isSchool ? S : S + (p.h >= 40 ? 1 : 0)
    const speed = (10 + r(3) * 8) * S
    const span = p.w + 30 * size + look.label.length * 4 * k
    const amp = (p.h - 6 * size) / 3
    const freq = 1.8 + r(4) * 1.6
    const mid = p.h / 2 - (5 * size) / 2
    const path = (time: number, lane = 0) => {
      const along = (time * speed) % span
      return {
        x: isRight ? along - 12 * size : p.w - along + 3 * size,
        y: mid + Math.sin(time * freq + lane) * amp + lane * 3 * S,
      }
    }
    const fishColour = pick([YELLOW, AMBER, LIME, PINK], r(5))
    const lanes = isSchool ? 3 + Math.floor(r(6) * 3) : 1
    for (let lane = 0; lane < lanes; lane++) {
      const at = path(t - lane * 0.35, isSchool ? lane - (lanes - 1) / 2 : 0)
      sprite(p, FISH, Math.round(at.x), Math.round(at.y), { Y: fishColour, O: ORANGE }, size, isRight)
    }
    // Behind the lead fish, the pattern it is looking for, letter by letter.
    const text = clip(look.label, 24)
    const palette = c.palette(r(7))
    const gap = (4.5 * k) / speed
    for (let i = 0; i < text.length; i++) {
      const at = path(t - (i + 1.6) * gap)
      const ch = isRight ? text[text.length - 1 - i]! : text[i]!
      tinyGlyph(p, ch, Math.round(at.x + 4 * size), Math.round(at.y + 2 * size - k), k, palette[i % palette.length]!)
    }
  },

  magrathea(c) {
    const { p, t, now, r, look, k } = c
    stars(p, now, 0.2, r(9))
    const hasRoomBeside = p.w > p.h * 2.6
    const R = Math.max(4, Math.min(Math.floor(p.h / 2) - 2 - (look.label && !hasRoomBeside ? 3 * k : 0), Math.floor(p.w / 4) - 2))
    const cx = Math.floor(hasRoomBeside && look.label ? p.w * 0.38 : p.w / 2)
    const cy = Math.floor(p.h / 2 - (look.label && !hasRoomBeside ? 3 * k : 0))
    const isNew = look.flavour === 'write'
    const cycle = t % 7
    const built = isNew ? Math.min(1, cycle / 2.4) : 1
    const fa = 0.12 + r(4) * 0.2
    const fb = 0.15 + r(5) * 0.25
    const ocean = r(6) > 0.5 ? BLUE : DEEP
    const spin = now * (0.6 + r(7))
    // A ring behind, then the planet, then the ring's front.
    const hasRing = r(8) > 0.55
    if (hasRing) ring(p, cx, cy, R, false, look.tint)
    for (let y = -R; y <= R; y++) {
      for (let x = -R; x <= R; x++) {
        if (x * x + y * y > R * R) continue
        const angle = (Math.atan2(y, x) + Math.PI) / (2 * Math.PI)
        if (angle > built) continue
        const isLand = Math.sin(x * fa + spin) + Math.sin(y * fb + x * 0.1 + r(3) * 6) > 0.5
        put(p, cx + x, cy + y, isLand ? look.tint : ocean)
      }
    }
    if (hasRing) ring(p, cx, cy, R, true, look.tint)
    // The fjords, crinkled in by hand along the coast: a longer stretch for a bigger edit.
    const start = isNew ? 2.4 : 0.3
    if (cycle > start) {
      const reach = (0.2 + look.amount * 0.8) * Math.PI * 2
      const from = r(10) * Math.PI * 2
      const done = Math.min(1, (cycle - start) / 3)
      const wiggle = 14 + Math.floor(r(11) * 16)
      for (let a = 0; a < done * reach; a += 0.6 / R) {
        const rr = R - 1.5 + Math.sin((from + a) * wiggle) * Math.max(1.3, R / 8)
        put(p, Math.round(cx + Math.cos(from + a) * rr), Math.round(cy + Math.sin(from + a) * rr), WHITE)
      }
      const a = from + done * reach
      put(p, Math.round(cx + Math.cos(a) * (R + 2)), Math.round(cy + Math.sin(a) * (R + 2)), AMBER)
    }
    if (r(12) > 0.5) {
      const ma = now * 0.9 + r(13) * 6
      disc(p, Math.round(cx + Math.cos(ma) * R * 1.7), Math.round(cy + Math.sin(ma) * R * 0.5), Math.max(1, Math.round(R / 6)), GREY)
    }
    if (look.label) {
      if (hasRoomBeside) tiny(p, look.label, Math.round(cx + R * 2 + 4), cy - Math.floor((5 * k) / 2), k, () => WHITE)
      else tiny(p, look.label, null, p.h - 6 * k, k, () => WHITE)
    }
  },

  deepthought(c) {
    const { p, now, r, look, S, k } = c
    const isLink = look.flavour === 'ssh'
    const w = Math.min(Math.round((p.w - 4) * (isLink ? 0.6 : 1)), Math.max(30, Math.round(p.h * 1.8)))
    const x0 = isLink ? 2 : Math.floor((p.w - w) / 2)
    const y0 = 1
    const y1 = p.h - 2
    box(p, x0, y0, x0 + w - 1, y1, GREY)
    // The screen: the command, scrolling past.
    const scrTop = y0 + 2
    const scrBottom = scrTop + Math.max(5 * k + 2, Math.floor((y1 - y0) * 0.3))
    box(p, x0 + 2, scrTop, x0 + w - 3, scrBottom, SLATE)
    const label = look.label || 'THINKING'
    const run = textWidth(label, k) + 12 * k
    const offset = Math.floor((now * 14 * k) % run)
    const ty = Math.floor((scrTop + scrBottom) / 2 - (5 * k) / 2) + 1
    for (const shift of [0, run]) {
      tiny(p, label, x0 + w - 4 - offset + shift - run + 12 * k, ty, k, () => TEAL, { x0: x0 + 3, x1: x0 + w - 4 })
    }
    // The lights, by what kind of command it is.
    const lights: { x: number; y: number }[] = []
    const step = 3 * S + 1
    for (let y = scrBottom + 2 + S; y < y1 - S; y += step) for (let x = x0 + 3; x < x0 + w - 3 - S; x += step) lights.push({ x, y })
    const palette = pick([[GREEN, AMBER, RED, CYAN], [CYAN, VIOLET, WHITE], [LIME, YELLOW, ORANGE]], r(1))
    lights.forEach((l, i) => {
      let colour = 0
      const blink = hash(i * 13 + Math.floor(now * (2 + (i % 3)) + r(2) * 9)) > 0.45
      switch (look.flavour) {
        case 'tests':
          colour = blink ? (hash(i * 7.7 + Math.floor(now * 3)) > 0.12 ? GREEN : RED) : 0
          break
        case 'push':
        case 'git':
          colour = blink ? pick([ORANGE, AMBER, YELLOW], hash(i)) : 0
          break
        case 'rm':
          colour = (now * 3) % 1 < 0.5 ? RED : 0
          break
        case 'build':
          colour = i / lights.length < (now / 4) % 1 ? LIME : STAR
          break
        case 'wait': {
          const sweep = Math.abs(((now * 0.6) % 2) - 1) * (lights.length - 1)
          colour = Math.abs(i - sweep) < 1.5 ? AMBER : STAR
          break
        }
        default:
          colour = blink ? palette[i % palette.length]! : 0
      }
      if (colour) for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S + 1; dx++) put(p, l.x + dx, l.y + dy, colour)
    })
    if (isLink) {
      // The far machine, and packets crossing to it.
      const fx0 = x0 + w + Math.floor((p.w - x0 - w) * 0.45)
      const fx1 = p.w - 3
      const fy0 = Math.floor(p.h * 0.35)
      box(p, fx0, fy0, fx1, y1, GREY)
      for (let x = fx0 + 2; x < fx1 - 1; x += 3) if (hash(x + Math.floor(now * 4)) > 0.4) put(p, x, fy0 + 2, CYAN)
      const ly = Math.floor((fy0 + y1) / 2)
      for (let x = x0 + w + 1; x < fx0; x += 2) put(p, x, ly, STAR)
      for (let n = 0; n < 3; n++) {
        const u = (now * 0.8 + n / 3) % 1
        const x = Math.round(x0 + w + 1 + u * (fx0 - x0 - w - 2))
        put(p, x, ly, CYAN)
        put(p, x + 1, ly, CYAN)
      }
    }
  },

  hyperspace(c) {
    const { p, t, now, r, look } = c
    const cx = p.w / 2
    const cy = p.h / 2
    const reach = Math.hypot(cx, cy)
    const isBack = r(1) > 0.75
    const count = Math.round(Math.min(160, Math.max(46, (p.w * p.h) / 60)))
    for (let n = 0; n < count; n++) {
      const angle = hash(n * 3.3 + r(2)) * Math.PI * 2
      let life = (now * (0.35 + hash(n * 1.9) * 0.5) + hash(n * 7.7)) % 1
      if (isBack) life = 1 - life
      const d = life * life * reach
      const colour = life > 0.6 ? WHITE : life > 0.3 ? look.tint : STAR
      for (let s = Math.max(0, d * 0.65); s <= d; s += 0.8) put(p, Math.round(cx + Math.cos(angle) * s), Math.round(cy + Math.sin(angle) * s), colour)
    }
    // The destination, looming larger as it approaches.
    if (look.label) {
      const text = clip(look.label, 20)
      const most = Math.max(1, Math.min(Math.floor((p.w - 4) / (text.length * 4)), Math.floor(p.h / 12)))
      const size = Math.max(1, Math.min(most, 1 + Math.floor(ease(Math.min(1, t / 2.5)) * most)))
      const y = Math.floor(cy - (5 * size) / 2)
      clear(p, Math.floor(cx - textWidth(text, size) / 2) - 1, y - 1, Math.ceil(cx + textWidth(text, size) / 2) + 1, y + 5 * size)
      tiny(p, text, null, y, size, () => look.tint)
    }
  },

  house(c) {
    const { p, now, r, look, k, S } = c
    stars(p, now, 0.15, r(9))
    const ground = p.h - 2
    for (let x = 0; x < p.w; x++) put(p, x, ground, hash(x * 1.3) > 0.4 ? GREEN : 0x2f6b2f)
    const w = Math.max(16, Math.min(Math.round(p.w * 0.45), Math.round(p.h * 1.5)))
    const bodyH = Math.max(6, Math.round(p.h * 0.42))
    const x0 = Math.floor(p.w * (0.2 + r(1) * 0.25))
    const x1 = x0 + w
    const top = ground - bodyH
    // Outlines, not fills: a braille cell has one colour, so a filled wall would swallow its windows.
    const wall = pick([0xd9c6a5, 0xb7c4cf, 0xe0b8a0, 0xc9d6a3], r(2))
    box(p, x0, top, x1, ground, wall)
    const roof = pick([RED, ORANGE, SLATE, PINK], r(3))
    const peak = Math.min(Math.round(w * 0.4), top - 2)
    for (let i = 0; i <= peak; i++) {
      put(p, x0 - 2 + Math.round((i * (w / 2 + 2)) / peak), top - i, roof)
      put(p, x1 + 2 - Math.round((i * (w / 2 + 2)) / peak), top - i, roof)
    }
    for (let x = x0 - 2; x <= x1 + 2; x++) put(p, x, top, roof)
    // A chimney, smoking.
    const chx = x0 + Math.round(w * 0.72)
    const chTop = top - Math.round(peak * 0.75)
    box(p, chx, chTop, chx + 2 * S + 1, top - Math.round(peak * 0.3), BROWN)
    for (let n = 0; n < 6; n++) {
      const u = (now * 0.4 + n / 6) % 1
      put(p, Math.round(chx + S + Math.sin(u * 6 + n) * 2 + u * 6), Math.round(chTop - 2 - u * Math.max(4, chTop - 1)), GREY)
    }
    // Windows, each going on and off in its own time; the door.
    const cols = 2 + Math.floor(r(4) * 3)
    const rowsN = bodyH > 14 ? 2 : 1
    const ww = Math.max(2, Math.floor(w / (cols * 2 + 1)))
    const wh = Math.max(2, Math.floor((bodyH - 4) / (rowsN * 2 + 1)) + 1)
    let n = 0
    for (let row = 0; row < rowsN; row++) {
      for (let col = 0; col < cols; col++) {
        n += 1
        const wx = x0 + ww + col * ww * 2
        const wy = top + 2 + row * (wh + 2)
        const isLit = hash(n * 13 + Math.floor(now * 0.5 + r(n + 20) * 5)) > 0.45
        if (isLit) for (let y = wy; y < wy + wh; y++) for (let x = wx; x < wx + ww; x++) put(p, x, y, YELLOW)
        else box(p, wx, wy, wx + ww - 1, wy + wh - 1, SLATE)
      }
    }
    const dx = x0 + Math.floor(w / 2) - S
    box(p, dx, ground - Math.max(4, Math.round(bodyH * 0.45)), dx + 2 * S + 2, ground, BROWN)
    if (look.label) {
      const lx = x1 + 6
      if (lx + textWidth(clip(look.label, 18), k) < p.w) tiny(p, clip(look.label, 18), lx, Math.floor(p.h * 0.3), k, () => look.tint)
      else tiny(p, look.label, null, 1, k, () => look.tint)
    }
  },

  improbability(c) {
    const { p, t, r, look, k } = c
    const shapes = IMPROBABLE
    const segment = 3
    const first = Math.floor(r(1) * shapes.length)
    const stride = r(2) > 0.5 ? 1 : 2
    const j = Math.floor(t / segment)
    const u = (t % segment) / segment
    const from = shapes[(first + j * stride) % shapes.length]!
    const to = shapes[(first + (j + 1) * stride) % shapes.length]!
    const labelRows = p.h >= 32 ? 7 * k : 0
    const room = { w: p.w, h: p.h - labelRows }
    const sizeOf = (s: Shape) => Math.max(1, Math.min(Math.floor((room.h * 0.8) / s.h), Math.floor((room.w * 0.6) / s.w)))
    const count = Math.round(Math.min(420, Math.max(90, (p.w * p.h) / 14)))
    const cx = p.w / 2
    const cy = room.h / 2
    const sa = sizeOf(from)
    const sb = sizeOf(to)
    const palette = c.palette(r(3))
    for (let i = 0; i < count; i++) {
      const a = from.points[i % from.points.length]!
      const b = to.points[i % to.points.length]!
      const jx = hash(i * 3.3)
      const jy = hash(i * 5.1)
      const at = { x: cx + (a.x + jx) * sa - (from.w * sa) / 2, y: cy + (a.y + jy) * sa - (from.h * sa) / 2 }
      const next = { x: cx + (b.x + jx) * sb - (to.w * sb) / 2, y: cy + (b.y + jy) * sb - (to.h * sb) / 2 }
      const cloud = { x: hash(i * 3.1 + j + r(4)) * p.w, y: hash(i * 5.7 + j) * room.h }
      let x: number
      let y: number
      if (u < 0.35) {
        x = at.x
        y = at.y
      } else if (u < 0.65) {
        const s = ease((u - 0.35) / 0.3)
        x = at.x + (cloud.x - at.x) * s
        y = at.y + (cloud.y - at.y) * s
      } else {
        const s = ease((u - 0.65) / 0.35)
        x = cloud.x + (next.x - cloud.x) * s
        y = cloud.y + (next.y - cloud.y) * s
      }
      put(p, Math.round(x), Math.round(y), u < 0.35 ? from.colour : palette[(i + j) % palette.length]!)
    }
    if (labelRows) {
      const odds = u < 0.35 ? 'ODDS 1:1' : `ODDS 1:${Math.floor(hash(Math.floor(t * 10)) * 9e8 + 1e8)}`
      tiny(p, look.label ? `${clip(look.label, 18)}  ${odds}` : odds, null, p.h - 6 * k, k, () => GREY)
    }
  },

  towel(c) {
    const { p, t, now, r, look, k, S } = c
    stars(p, now, 0.3, r(9))
    const w = Math.max(16, Math.min(p.w - 10, Math.round(p.h * 1.6)))
    const x0 = Math.floor((p.w - w) / 2)
    const line = 2
    for (let x = 2; x < p.w - 2; x++) put(p, x, line, GREY)
    const h = p.h - line - 4 - S
    const palette = c.palette(r(1))
    const wind = r(2) > 0.5 ? 1 : -1
    const stripe = 2 + Math.floor(r(3) * 3) * S
    // What is printed on it, in towel space, so it waves with the cloth.
    const text = clip(look.label, Math.floor((w - 4) / (4 * k)))
    const mask = new Set<number>()
    if (text) {
      const tw = textWidth(text, k)
      const tx = Math.floor((w - tw) / 2)
      const ty = Math.floor((h - 5 * k) / 2)
      eachTinyDot(text, k, (dx, dy) => mask.add((ty + dy) * w + tx + dx))
    }
    for (let x = 0; x < w; x++) {
      const along = wind > 0 ? x / w : 1 - x / w
      const sway = along * 1.8 * S
      for (let y = 0; y < h; y++) {
        const dy = Math.round(Math.sin(t * 3.2 - wind * x * 0.35) * sway * (y / h + 0.3))
        const colour = mask.has(y * w + x) ? WHITE : palette[Math.floor(y / stripe) % palette.length]!
        put(p, x0 + x, line + 1 + y + dy, colour)
      }
      if (x % 2 === 0) put(p, x0 + x, line + 1 + h + Math.round(Math.sin(t * 3.2 - wind * x * 0.35) * sway * 1.3) + 1, WHITE)
    }
  },

  petunias(c) {
    const { p, t, now, r, look, S, k } = c
    stars(p, now, 0.2, r(9))
    const ground = p.h - 1
    for (let x = 0; x < p.w; x++) if (hash(x) > 0.3) put(p, x, ground, BROWN)
    const isSwapped = r(1) > 0.5
    const whaleX = Math.floor(p.w * (isSwapped ? 0.58 : 0.18))
    const potX = Math.floor(p.w * (isSwapped ? 0.2 : 0.66))
    const g = 26 * S
    const landAt = (start: number, height: number) => Math.sqrt((2 * (ground - height - start)) / g)
    const fall = (start: number, delay: number, height: number) =>
      Math.min(ground - height, Math.round(start + 0.5 * g * Math.max(0, t - delay) ** 2))
    const whaleH = WHALE.length * S
    const whaleY = fall(-8 * S, 0, whaleH)
    const whaleColour = pick([STEEL, SLATE, BLUE], r(2))
    if (whaleY < ground - whaleH) sprite(p, WHALE, whaleX, whaleY, { W: whaleColour, B: BELLY }, S, isSwapped)
    else {
      // Flattened, with a puff of dust.
      for (let x = -2; x < 18 * S; x++) for (let y = 1; y <= S; y++) put(p, whaleX + x, ground - y, whaleColour)
      const since = t - landAt(-8 * S, whaleH)
      for (let n = 0; n < 16; n++) {
        const a = (n / 16) * Math.PI
        const s = since * 14 * S
        if (since < 1.2) put(p, Math.round(whaleX + 8 * S + Math.cos(a) * s * 2), Math.round(ground - 1 - Math.sin(a) * s), AMBER)
      }
    }
    const potH = POT.length * S
    const delay = 0.4 + r(3) * 0.5
    const potY = fall(-14 * S, delay, potH)
    sprite(p, POT, potX, potY, { p: pick([PINK, VIOLET, ORANGE], r(4)), r: RED, g: GREEN, O: BROWN }, S)
    // Once it has landed, the bowl's one thought.
    if (t > delay + landAt(-14 * S, potH) + 0.5 && p.h >= 20) {
      const words = r(5) > 0.4 || !look.label ? 'OH NO, NOT AGAIN' : `${clip(look.label, 14)} FAILED`
      const x = Math.max(1, Math.min(p.w - textWidth(words, k) - 1, potX + Math.floor((9 * S) / 2) - Math.floor(textWidth(words, k) / 2)))
      tiny(p, words, x, Math.max(1, potY - 7 * k), k, () => WHITE)
    }
  },

  answer(c) {
    const { p, t, now, r, look, k } = c
    stars(p, now, 0.4, r(9))
    const words = '42'
    const labelRows = look.label && p.h >= 24 ? 7 * k : 0
    const scale = Math.max(1, Math.min(Math.floor(((p.h - labelRows) * 0.75) / 7), Math.floor((p.w * 0.5) / width(words, 1))))
    const x0 = Math.floor((p.w - width(words, scale)) / 2)
    const y0 = Math.floor((p.h - labelRows - 7 * scale) / 2)
    const style = Math.floor(r(1) * 3)
    const palette = pick([[AMBER, WHITE], [CYAN, WHITE], [LIME, YELLOW], [PINK, AMBER]], r(2))
    const reveal = Math.min(1, t / 1.2)
    let x = x0
    let index = 0
    for (const ch of words) {
      const glyph = FONT[ch]!
      // Slide in from either side, rise from below, or appear dot by dot.
      const slide = style === 0 ? Math.round((1 - ease(reveal)) * (index === 0 ? -p.w / 2 : p.w / 2)) : 0
      const rise = style === 1 ? Math.round((1 - ease(reveal)) * p.h) : 0
      for (let gy = 0; gy < glyph.length; gy++) {
        for (let gx = 0; gx < glyph[gy]!.length; gx++) {
          if (glyph[gy]![gx] !== '#') continue
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const px = x + gx * scale + sx
              const py = y0 + gy * scale + sy
              if (style === 2 && hash(px * 7.1 + py * 3.3) > reveal) continue
              const shimmer = Math.sin(now * 5 + px * 0.3 + py * 0.2) > 0.6
              put(p, px + slide, py + rise, shimmer ? palette[1]! : palette[0]!)
            }
          }
        }
      }
      x += (glyph[0]!.length + 1) * scale
      index += 1
    }
    if (labelRows && t > 1) tiny(p, look.label, null, y0 + 7 * scale + 2 * k, k, () => GREY)
    for (let n = 0; n < Math.max(10, p.w / 10); n++) {
      if (hash(n * 9 + Math.floor(now * 10)) > 0.6) {
        put(p, Math.floor(hash(n * 2.1 + Math.floor(now * 3)) * p.w), Math.floor(hash(n * 4.4 + Math.floor(now * 3)) * p.h), YELLOW)
      }
    }
  },

  dolphins(c) {
    const { p, t, r, look, S, k } = c
    const sea = p.h - 3 * S
    for (let x = 0; x < p.w; x++) {
      put(p, x, sea + Math.round(Math.sin(t * 3 + x * 0.25) * S), CYAN)
      for (let y = sea + 2; y < p.h; y += 2) if (hash(x + y * 7 + Math.floor(t * 4)) > 0.75) put(p, x, y, BLUE)
    }
    const count = 2 + Math.floor(r(1) * 4)
    const isRight = r(2) > 0.3
    for (let i = 0; i < count; i++) {
      const span = p.w + 16 * S
      const along = (t * (16 + i * 3) * S + (i * span) / count) % span
      const x = isRight ? along - 12 * S : p.w - along
      const leap = Math.max(0, Math.sin(t * 2.4 + i * 2.1 + r(3) * 3))
      const y = Math.round(sea - 3 * S - leap * (sea - 6 * S))
      sprite(p, DOLPHIN, Math.round(x), y, { D: GREY, B: BELLY }, S, !isRight)
    }
    if (look.label && t > 0.8) tiny(p, look.label, null, 2, k, () => WHITE)
  },
}

// ---------------------------------------------------------------- sprites and type

const FISH = ['...YYY..O', '.YYYYYYOO', 'Y.YYYYYO.', '.YYYYYYOO', '...YYY..O']
const WHALE = [
  'W.....WWWWWW....',
  'WW..WWWWWWWWWW..',
  '.WWWWWWWWWWWW.WW',
  '.WWWWWWWWWWWWWWW',
  'WW..BBBBBBBBBBB.',
  'W.....BBBBBBB...',
]
const POT = ['..p.r.p..', '.prp.prp.', '..g.g.g..', 'OOOOOOOOO', '.OOOOOOO.', '..OOOOO..']
const DOLPHIN = ['.....D....', '..DDDDDD..', '.DDDDDDDDD', 'D...BBB...']
const TEACUP = ['.#..#..#...', '...........', '########...', '#######.##.', '#######..#.', '########...', '.######....', '##########.']
const HEART = ['.##...##.', '####.####', '#########', '.#######.', '..#####..', '...###...', '....#....']

const FONT: Record<string, string[]> = {
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  ' ': ['..', '..', '..', '..', '..', '..', '..'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
}

// The small lettering: 3 x 5, capitals, digits and a little punctuation.
const TINY: Record<string, string> = {
  A: '.#.#.####.##.#', B: '##.#.###.#.###.', C: '.###..#..#...##', D: '##.#.##.##.###.', E: '####..##.#..###',
  F: '####..##.#..#..', G: '.###..#.##.#.##', H: '#.##.####.##.#', I: '###.#..#..#.###', J: '..#..#..##.#.#.',
  K: '#.##.###.#.##.#', L: '#..#..#..#..###', M: '#.#####.##.##.#', N: '##.#.##.##.##.#', O: '.#.#.##.##.#.#.',
  P: '##.#.###.#..#..', Q: '.#.#.##.###..##', R: '##.#.###.#.##.#', S: '.###...#...###.', T: '###.#..#..#..#.',
  U: '#.##.##.##.####', V: '#.##.##.##.#.#.', W: '#.##.#######.#', X: '#.##.#.#.#.##.#', Y: '#.##.#.#..#..#.',
  Z: '###..#.#.#..###', '0': '####.##.##.####', '1': '.#.##..#..#.###', '2': '##...#.#.#..###', '3': '##...#.#...###.',
  '4': '#.##.####..#..#', '5': '####..##...###.', '6': '.###..####.####', '7': '###..#.#..#..#.', '8': '####.#####.####',
  '9': '####.####..###.', '.': '.............#.', ',': '..........#.#..', '-': '......###......', _: '............###',
  '/': '..#..#.#.#..#..', ':': '....#.....#....', '?': '##...#.#.....#.', '!': '.#..#..#.....#.', '*': '...#.#.#.#.#...',
  '=': '...###...###...', '+': '....#.###.#....', '(': '.#.#..#..#...#.', ')': '.#...#..#..#.#.', '#': '#.####.####.#.#',
  "'": '.#..#..........', '"': '#.##.#.........', '>': '#...#...#.#.#..', '<': '..#.#.#...#...#', '[': '##.#..#..#..##.',
  ']': '.##..#..#..#.##', '@': '.#.#.####..###', '~': '...##.#.##.....', '&': '.#.#.#.#.#.#.##', $: '.###.#.#.#.###.',
  '%': '#.#..#.#.#..#.#', '|': '.#..#..#..#..#.', '^': '.#.#.#.........',
}

/** The 3 x 5 rows of a small letter; padded where a definition above came out short. */
function tinyRows(ch: string): string[] {
  const raw = (TINY[ch.toUpperCase()] ?? (ch === ' ' ? '' : TINY['?']!)).padEnd(15, '.')
  return [0, 1, 2, 3, 4].map(i => raw.slice(i * 3, i * 3 + 3))
}

function textWidth(text: string, k: number): number {
  return text.length > 0 ? text.length * 4 * k - k : 0
}

function eachTinyDot(text: string, k: number, fn: (x: number, y: number) => void) {
  for (let i = 0; i < text.length; i++) {
    const rows = tinyRows(text[i]!)
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        if (rows[gy]![gx] !== '#') continue
        for (let sy = 0; sy < k; sy++) for (let sx = 0; sx < k; sx++) fn(i * 4 * k + gx * k + sx, gy * k + sy)
      }
    }
  }
}

/** Small lettering at (x, y), or centred when x is null; cut to fit, and clipped to `bounds`. */
function tiny(p: Pixels, text: string, x: number | null, y: number, size: number, colour: (i: number) => number, bounds?: { x0: number; x1: number }) {
  // Smaller before shorter: a long label steps down a size before it is cut (a marquee never is).
  let k = size
  while (!bounds && k > 1 && textWidth(clip(text, 999), k) > p.w - 2) k -= 1
  const fit = bounds ? clip(text, 999) : clip(text, Math.max(1, Math.floor((p.w - 2) / (4 * k))))
  const left = x ?? Math.floor((p.w - textWidth(fit, k)) / 2)
  eachTinyDot(fit, k, (dx, dy) => {
    const px = left + dx
    if (bounds && (px < bounds.x0 || px > bounds.x1)) return
    put(p, px, y + dy, colour(Math.floor(dx / (4 * k))))
  })
}

function tinyGlyph(p: Pixels, ch: string, x: number, y: number, k: number, colour: number) {
  eachTinyDot(ch, k, (dx, dy) => put(p, x + dx, y + dy, colour))
}

/** Upper case, single-spaced, at most `n` characters, with a trailing dot when cut. */
function clip(text: string, n: number): string {
  const flat = text.replace(/\s+/g, ' ').trim().toUpperCase()
  return flat.length > n ? `${flat.slice(0, Math.max(1, n - 1))}.` : flat
}

type Shape = { points: { x: number; y: number }[]; w: number; h: number; colour: number }

function shapeOf(rows: string[], colour: number): Shape {
  const points: { x: number; y: number }[] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== '.') points.push({ x, y })
  })
  // Spread the points so particles outline the whole shape, not the top rows first.
  const spread = points.map((pt, i) => ({ pt, k: hash(i * 1.37) })).sort((a, b) => a.k - b.k).map(s => s.pt)
  return { points: spread, w: rows[0]!.length, h: rows.length, colour }
}

const IMPROBABLE: Shape[] = [
  shapeOf(TEACUP, WHITE),
  shapeOf(WHALE, STEEL),
  shapeOf(HEART, PINK),
  shapeOf(POT, GREEN),
  shapeOf(FONT['?']!, AMBER),
  shapeOf(DOLPHIN, GREY),
]

function width(words: string, scale: number): number {
  let w = 0
  for (const ch of words) w += ((FONT[ch]?.[0]?.length ?? 3) + 1) * scale
  return w - scale
}

function drawGlyph(p: Pixels, glyph: string[], x: number, y: number, scale: number, colour: number) {
  for (let gy = 0; gy < glyph.length; gy++) {
    for (let gx = 0; gx < glyph[gy]!.length; gx++) {
      if (glyph[gy]![gx] !== '#') continue
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) put(p, x + gx * scale + sx, y + gy * scale + sy, colour)
    }
  }
}

/** A sprite at scale `s`, each letter a colour from `palette`; a '.' (or an unknown letter) is clear. */
function sprite(p: Pixels, rows: string[], x: number, y: number, palette: Record<string, number>, s = 1, isFlipped = false) {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const colour = palette[row[isFlipped ? row.length - 1 - dx : dx]!]
      if (colour === undefined) continue
      for (let sy = 0; sy < s; sy++) for (let sx = 0; sx < s; sx++) put(p, x + dx * s + sx, y + dy * s + sy, colour)
    }
  })
}

function stars(p: Pixels, now: number, drift: number, seed: number) {
  for (let n = 0; n < Math.max(8, (p.w * p.h) / 150); n++) {
    const x = Math.floor((((hash(n * 5.3 + seed) * p.w - now * drift * (1 + (n % 3))) % p.w) + p.w) % p.w)
    const y = Math.floor(hash(n * 9.1 + seed) * p.h)
    if (Math.sin(now * 2 + n * 1.7) > -0.2) put(p, x, y, n % 7 === 0 ? WHITE : STAR)
  }
}

/** Half a ring round a planet of radius R: the back half, or the front. */
function ring(p: Pixels, cx: number, cy: number, R: number, isFront: boolean, colour: number) {
  const rx = R * 1.7
  const ry = R * 0.35
  for (let a = 0; a < Math.PI * 2; a += 0.5 / R) {
    const y = Math.sin(a) * ry
    if (y > 0 !== isFront) continue
    put(p, Math.round(cx + Math.cos(a) * rx), Math.round(cy + y), mix(colour, WHITE, 0.4))
  }
}

function disc(p: Pixels, cx: number, cy: number, r: number, colour: number) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) put(p, cx + x, cy + y, colour)
}

function rect(p: Pixels, x0: number, y0: number, x1: number, y1: number, colour: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(p, x, y, colour)
}

function box(p: Pixels, x0: number, y0: number, x1: number, y1: number, colour: number) {
  for (let x = x0; x <= x1; x++) {
    put(p, x, y0, colour)
    put(p, x, y1, colour)
  }
  for (let y = y0; y <= y1; y++) {
    put(p, x0, y, colour)
    put(p, x1, y, colour)
  }
}

function clear(p: Pixels, x0: number, y0: number, x1: number, y1: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < p.w && y < p.h) p.px[y * p.w + x] = 0
}

function put(p: Pixels, x: number, y: number, colour: number) {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return
  p.px[y * p.w + x] = colour
}

// ---------------------------------------------------------------- cells

const DOT_BITS = [
  [0x01, 0x02, 0x04, 0x40],
  [0x08, 0x10, 0x20, 0x80],
]

/** Braille cells for the dots; u32 little-endian triplets, base64. */
function encode(p: Pixels, columns: number, rows: number): string {
  const bytes = new Uint8Array(columns * rows * 12)
  const view = new DataView(bytes.buffer)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      let bits = 0
      let colour = PANEL
      let brightest = -1
      for (let dx = 0; dx < 2; dx++) {
        for (let dy = 0; dy < 4; dy++) {
          const dot = p.px[(row * 4 + dy) * p.w + col * 2 + dx] ?? 0
          if (dot === 0) continue
          bits |= DOT_BITS[dx]![dy]!
          const light = luminance(dot)
          if (light > brightest) {
            brightest = light
            colour = dot
          }
        }
      }
      const cell = (row * columns + col) * 12
      view.setUint32(cell, bits ? 0x2800 + bits : 0x20, true)
      view.setUint32(cell + 4, colour, true)
      view.setUint32(cell + 8, PANEL, true)
    }
  }
  return base64(bytes)
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]!
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63]! : '='
    out += i + 2 < bytes.length ? ALPHABET[n & 63]! : '='
  }
  return out
}

function luminance(colour: number): number {
  return ((colour >> 16) & 255) * 0.3 + ((colour >> 8) & 255) * 0.59 + (colour & 255) * 0.11
}

function mix(a: number, b: number, u: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - u) + ((b >> shift) & 255) * u)
  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

function pick<T>(list: readonly T[], u: number): T {
  return list[Math.min(list.length - 1, Math.floor(u * list.length))]!
}

function ease(u: number): number {
  return u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2
}

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
