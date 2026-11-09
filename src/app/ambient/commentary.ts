import { useEffect, useRef, useState } from 'react'

/** Default ambient lines. Short, calm, never instructional. */
export const DEFAULT_COMMENTARY: readonly string[] = [
  "Somewhere on Earth, it's already tomorrow.",
  'The Earth never stops moving.',
  '8 billion stories. One planet.',
  "You're closer than you think.",
  'Keep exploring.',
  'The world is bigger than you imagine.',
  'Every place has a story.',
  "Lost? That's part of the adventure.",
  'Right now, the sun is rising somewhere.',
  'Oceans cover about 71% of this planet.',
  'Look closer. Coastlines tell stories.',
  'Satellites are watching the same view.',
]

export interface CommentaryTiming {
  /** Quiet period after a round/session starts before the first line (ms). */
  firstDelayMs: number
  /** Random gap between lines [min, max] (ms). */
  gapMs: [number, number]
  /** How long a line stays on screen (ms), fades included. */
  displayMs: number
}

export const DEFAULT_COMMENTARY_TIMING: CommentaryTiming = {
  firstDelayMs: 14_000,
  gapMs: [28_000, 46_000],
  displayMs: 5_600,
}

export interface AmbientCommentaryOptions {
  /** Whether lines may appear right now (e.g. an active search with commentary enabled). */
  active: boolean
  /** Changing this restarts the quiet period (e.g. a new round). */
  cycleKey?: string | number
  /** Changing this refills the no-repeat bag (e.g. a new match). */
  sessionKey?: string | number
  messages?: readonly string[]
  timing?: Partial<CommentaryTiming>
}

export interface AmbientCommentaryState {
  message: string | null
  visible: boolean
  /** Increments per line — use as a React key to restart the fade animation. */
  id: number
}

function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Reusable ambient commentary scheduler.
 * Shows one line at a time, only while `active`, from a shuffled no-repeat bag
 * (no line repeats within a session until all have been shown).
 * Only two state updates per line (show / hide) — no per-frame work.
 */
export function useAmbientCommentary({
  active,
  cycleKey,
  sessionKey,
  messages = DEFAULT_COMMENTARY,
  timing,
}: AmbientCommentaryOptions): AmbientCommentaryState {
  const [state, setState] = useState<AmbientCommentaryState>({ message: null, visible: false, id: 0 })
  const bag = useRef<string[]>([])
  const lastShown = useRef<string | null>(null)
  const t = { ...DEFAULT_COMMENTARY_TIMING, ...timing }
  const timingKey = `${t.firstDelayMs}|${t.gapMs[0]}|${t.gapMs[1]}|${t.displayMs}`

  useEffect(() => {
    bag.current = []
  }, [sessionKey, messages])

  useEffect(() => {
    if (!active || messages.length === 0) {
      setState((s) => (s.visible ? { ...s, visible: false } : s))
      return
    }

    let showTimer = 0
    let hideTimer = 0

    const next = (): string => {
      if (bag.current.length === 0) {
        bag.current = shuffle(messages)
        // Avoid back-to-back repeats across bag refills.
        if (bag.current.length > 1 && bag.current[bag.current.length - 1] === lastShown.current) {
          bag.current.unshift(bag.current.pop()!)
        }
      }
      const line = bag.current.pop()!
      lastShown.current = line
      return line
    }

    const schedule = (delay: number) => {
      showTimer = window.setTimeout(() => {
        const line = next()
        setState((s) => ({ message: line, visible: true, id: s.id + 1 }))
        hideTimer = window.setTimeout(() => {
          setState((s) => ({ ...s, visible: false }))
          schedule(t.gapMs[0] + Math.random() * (t.gapMs[1] - t.gapMs[0]))
        }, t.displayMs)
      }, delay)
    }

    schedule(t.firstDelayMs)
    return () => {
      window.clearTimeout(showTimer)
      window.clearTimeout(hideTimer)
      setState((s) => (s.visible ? { ...s, visible: false } : s))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, cycleKey, messages, timingKey])

  return state
}
