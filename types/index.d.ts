/** What the agent is up to, as the Guide files it. */
export type Category =
  | 'read'
  | 'search'
  | 'edit'
  | 'shell'
  | 'web'
  | 'mcp'
  | 'agent'
  | 'plan'
  | 'ask'
  | 'other'
  | 'fail'
  | 'done'
  | 'aborted'
  | 'thinking'
  | 'idle'

/** The entry on screen: its heading, the remark, and the plain facts beneath. */
export type Entry = {
  category: Category
  topic: string
  quip: string
  /** The call itself, plainly: `Bash · npm test`. Empty when there is none. */
  detail: string
  /** The doodle on screen and how far it has come: "a bookworm in a monocle, generation 4". */
  art: string | null
}

export type Stats = { consulted: number; mishaps: number; answers: number }

declare module 'claude-code' {
  interface PluginState {
    'dont-panic': {
      entry: Entry | null
      stats: Stats
      /** The screen holds its frame instead of animating (/guide still). */
      isStill: boolean
      /** Remarks are written live by a model (/guide canned turns it off). */
      isLive: boolean
      /** Why live remarks have stopped, when they have. */
      liveNote: string | null
    }
  }
}
