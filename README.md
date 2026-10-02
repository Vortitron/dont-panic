# dont-panic: the Guide, at the side of Claude Code

A pane for Claude Code in the manner of the electronic book from *The
Hitchhiker’s Guide to the Galaxy*. It has nothing to do with your code. While
the agent works, the Guide animates what it is doing and files an entry on it
in the Guide's own voice: encyclopaedic, digressive, and mildly unimpressed.

> **TESTS, RUNNING OF.** The Guide notes that guide.test.ts has been handed to
> a machine of great dignity, which will consider it at length. Most
> civilisations simply run npm test and hope. The more advanced ones hope
> first, then run it.

Just a bit of fun, from [Vome](https://vome.io).

## Quickstart

In Claude Code:

```
/plugin install dont-panic --marketplace Vortitron/home-assistant-mcp
```

On a Claude Code older than 2.1.275, add the marketplace first:
`/plugin marketplace add Vortitron/home-assistant-mcp`, then
`/plugin install dont-panic@vome`.

Start a new session. The Guide opens by itself in a terminal 144 columns or
wider; otherwise type `/guide`. Then get Claude to do something.

### What it costs

Entries are written live by a Claude model, through your own Claude Code
login. On a Pro or Max plan they count towards your usage limits; with an API
key they are billed at API rates. Each entry is about 1,500 tokens in and 400
out. There is at most one every 6 seconds, and only while the agent is working.
A quiet session costs nothing.

| Level | Command | Per entry | Typical working hour (an entry every ~20 s) | Busiest possible hour |
| --- | --- | --- | --- | --- |
| **Canned**: the Guide's own stock entries, no model calls | `/guide canned` | free | free | free |
| **Haiku**: quick and cheap, a little flat | `/guide model haiku` | ~$0.0035 | ~$0.65 | ~$2.10 |
| **Sonnet** (default): the voice is right | `/guide model sonnet` | ~$0.007 | ~$1.25 | ~$4.20 |
| **Opus**: for the discerning hitchhiker | `/guide model opus` | ~$0.014 | ~$2.50 | ~$8.40 |

Prices are API list prices per million tokens as of October 2026: Haiku 4.5 at
$1 in / $5 out, Sonnet 5.5 at $2 / $10, Opus 5.5 at $4 / $20. `/guide live`
turns live entries back on after `/guide canned`. Your choice of model is kept
across sessions.

## What you get

- **A screen** (terminal only), drawn in braille dots and filling whatever
  height the pane has. Each kind of activity has its own scene, and no two
  showings are quite the same:

  | Activity | Scene |
  | --- | --- |
  | Reading | A book whose cover is the file type's colour, titled with the file |
  | Searching | A Babel fish (a school, for a glob) trailing the search pattern |
  | Editing | The file as a planet, built new for a write, given fjords for an edit |
  | Shell | Deep Thought scrolling the command; tests flicker green, `rm` flashes red, builds fill up, ssh links to a second machine |
  | Web, MCP servers | Hyperspace, towards the host or server |
  | Home Assistant tools | A house whose windows go on and off |
  | Subagents | A cloud of dots improbably becoming a teacup, a whale, a heart |
  | Plans, questions | A towel on a line, with something printed on it |
  | A failure | A whale and a bowl of petunias falling from the sky |
  | An answer | 42, and how long it took |
  | An interruption | Dolphins leaping away |
  | Thinking, idle | DON'T PANIC, in large friendly letters |

- **A nod to the ZX Spectrum** now and then: a scene loads from tape, with the
  border striped red and cyan for the pilot tone, then flickering blue and
  yellow for data. "Program: GUIDE" appears, then the picture arrives in white
  a third at a time, in the Spectrum's interleaved row order, with its colours
  last. The first scene of every session always loads this way. Cut a load
  short with a different scene and you get what stopping the tape always got
  you: "R Tape loading error, 0:1".
- **Entries**, each with a heading in the Guide's filing style and a short
  entry naming the actual file, command or pattern. A stock entry appears at
  once; the live one replaces it a second or two later. A long think with no
  tool calls gets a fresh scene and entry every 20 seconds.
- **Doodles that evolve.** With each live entry the model draws a small pixel
  character into the scene: a mainframe with blinking lamps, a Vogon clerk, a
  bookworm. Next time that scene comes up it gets its last doodle back and
  evolves it: the mainframe starts printing a verdict, the bookworm acquires a
  monocle. The pane says what is on screen and which generation it has reached.
  Each scene's lineage is kept across sessions, so the screen keeps developing.
  `/guide fresh` starts them all over.

## Commands

| Command | Does |
| --- | --- |
| `/guide` | Opens the pane |
| `/guide still` / `/guide move` | Freezes or restarts the animation |
| `/guide canned` / `/guide live` | Stock entries only (free), or live ones again |
| `/guide model sonnet` / `haiku` / `opus` | Which model writes the entries |
| `/guide fresh` | Every scene's doodle starts again from scratch |

## Notes

- The animation only draws in a terminal. Claude Code for VS Code, Cursor and
  the desktop app show the entries without the screen, or no pane at all
  where they draw none.
- It is a Claude Code mod (a plugin of function hooks), tested on Claude Code
  2.1.287. Older versions may not load it.
- Nothing leaves your machine except the live entries' requests, which go to
  the same Claude API the session already uses. They carry the tool calls'
  names and arguments (file names, commands, search patterns), the start of
  your request, and the start of the agent's answer. `/guide canned` sends
  nothing.
- All writing, stock and live, is original, in the spirit of the books rather
  than quoted from them. *The Hitchhiker's Guide to the Galaxy* is the work
  of Douglas Adams; this is an unofficial fan tribute.

## Developing

`claude plugin validate .` checks the manifest and hooks;
`claude plugin test .` runs `tests/`. To try a change, load the checkout with
`claude --plugin-dir /path/to/dont-panic`.

MIT licence.
