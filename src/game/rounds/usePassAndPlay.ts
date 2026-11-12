import { useCallback, useEffect, useRef, useState } from 'react'
import type { CameraTarget, GlobeNavigationApi, LatLng } from '../../globe'
import { DEFAULT_CONFIG } from '../config'
import { loadCountryIndex, type CountryRecord } from '../data/countryIndex'
import { loadPool } from '../data/pool'
import { regionalRoundView } from '../navigation/regionView'
import { scoreRound } from '../scoring/scoreRound'
import { validateAnswer } from '../validation/validateAnswer'
import { selectChallenges } from './selectChallenges'
import type { Challenge, GameConfig } from '../types'

export const PASS_PLAY_MIN_PLAYERS = 2
export const PASS_PLAY_MAX_PLAYERS = 6
/** Distinct, high-contrast player colours (one per seat). */
export const PASS_PLAY_COLORS = ['#3d8bfd', '#ffb547', '#5eead4', '#ff7a8a', '#b48cff', '#8ee06b'] as const

export interface PassPlayPlayer {
  name: string
  color: string
}

/** One player's turn in the current round. Kept private until the round is revealed. */
export interface PassPlayGuess {
  player: number
  outcome: 'correct' | 'wrong' | 'timeout'
  score: number
  elapsedMs: number
}

export interface PassPlayRanking {
  player: number
  name: string
  color: string
  score: number
  correct: number
  rank: number
}

export type PassPlayPhase = 'setup' | 'loading' | 'handoff' | 'turn' | 'reveal' | 'final'

export interface PassPlayApi {
  phase: PassPlayPhase
  config: GameConfig
  setConfig: (patch: Partial<GameConfig>) => void
  players: PassPlayPlayer[]
  /** The location being searched: only while a player is taking their turn or after the reveal. */
  challenge: Challenge | null
  roundIndex: number
  totalRounds: number
  turnIndex: number
  remainingMs: number
  pickingEnabled: boolean
  /** Totals as of the last reveal (never include unrevealed guesses). */
  scores: number[]
  /** This round's guesses, available only during the reveal. */
  roundResults: PassPlayGuess[] | null
  rankings: PassPlayRanking[] | null
  error: string | null
  paused: boolean
  pause: () => boolean
  resume: () => void
  start: (players: PassPlayPlayer[], globe: GlobeNavigationApi | null) => Promise<void>
  ready: (globe: GlobeNavigationApi | null) => void
  submit: (coords: LatLng, globe: GlobeNavigationApi | null) => void
  nextRound: (globe: GlobeNavigationApi | null) => void
  rematch: (globe: GlobeNavigationApi | null) => Promise<void>
  reset: () => void
}

/** Pause between READY and the first possible pick, so the READY tap can't drop a marker. */
const TURN_GRACE_MS = 350

/**
 * Pass & Play: 2–6 players on one device. Built from the singleplayer pieces — the same
 * location pools, regional round camera, marker answer, validation and speed scoring —
 * with one guess per player per round and every guess hidden until the round reveal.
 */
export function usePassAndPlay(): PassPlayApi {
  const [phase, setPhase] = useState<PassPlayPhase>('setup')
  const [config, setConfigState] = useState<GameConfig>({ ...DEFAULT_CONFIG, rounds: 5 })
  const [players, setPlayers] = useState<PassPlayPlayer[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [turnIndex, setTurnIndex] = useState(0)
  const [remainingMs, setRemainingMs] = useState(0)
  const [pickingEnabled, setPickingEnabled] = useState(false)
  const [scores, setScores] = useState<number[]>([])
  const [correct, setCorrect] = useState<number[]>([])
  const [roundResults, setRoundResults] = useState<PassPlayGuess[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)

  const configRef = useRef(config)
  const playersRef = useRef<PassPlayPlayer[]>([])
  const challengesRef = useRef<Challenge[]>([])
  const roundRef = useRef(0)
  const turnRef = useRef(0)
  const guessesRef = useRef<PassPlayGuess[]>([])
  const viewRef = useRef<CameraTarget | null>(null)
  const countryIndexRef = useRef<Map<string, CountryRecord> | null>(null)
  const turnStartRef = useRef(0)
  const pausedAtRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const graceRef = useRef<number | null>(null)
  const tokenRef = useRef(0)
  const lockedRef = useRef(true)
  const globeRef = useRef<GlobeNavigationApi | null>(null)

  useEffect(() => {
    configRef.current = config
  }, [config])

  const stopTimers = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    if (graceRef.current !== null) window.clearTimeout(graceRef.current)
    timerRef.current = null
    graceRef.current = null
  }, [])
  useEffect(() => stopTimers, [stopTimers])

  const setConfig = useCallback((patch: Partial<GameConfig>) => setConfigState((prev) => ({ ...prev, ...patch })), [])

  /** Same round-start framing as normal play: the target's broad region, never the target. */
  const placeCamera = useCallback((globe: GlobeNavigationApi | null) => {
    if (globe) globeRef.current = globe
    if (viewRef.current) globeRef.current?.setView(viewRef.current)
  }, [])

  const prepareRound = useCallback(
    async (index: number, globe: GlobeNavigationApi | null) => {
      const challenge = challengesRef.current[index]
      if (!challenge) return
      const pool = await loadPool()
      viewRef.current = regionalRoundView(challenge, configRef.current.difficulty, pool)
      roundRef.current = index
      turnRef.current = 0
      guessesRef.current = []
      setRoundIndex(index)
      setTurnIndex(0)
      setRoundResults(null)
      setPhase('handoff')
      // Behind the opaque hand-off screen: nobody sees the camera move.
      placeCamera(globe)
    },
    [placeCamera],
  )

  const reveal = useCallback(() => {
    const guesses = guessesRef.current
    setScores((prev) => prev.map((s, i) => s + (guesses.find((g) => g.player === i)?.score ?? 0)))
    setCorrect((prev) => prev.map((c, i) => c + (guesses.find((g) => g.player === i)?.outcome === 'correct' ? 1 : 0)))
    setRoundResults([...guesses].sort((a, b) => b.score - a.score || a.player - b.player))
    setPhase('reveal')
  }, [])

  /** Lock in the current player's single guess (or their timeout) and move on. */
  const finishTurn = useCallback(
    (coords: LatLng | null, globe: GlobeNavigationApi | null) => {
      if (lockedRef.current) return
      lockedRef.current = true
      stopTimers()
      setPickingEnabled(false)
      const challenge = challengesRef.current[roundRef.current]
      const cfg = configRef.current
      const elapsedMs = Math.min(performance.now() - turnStartRef.current, cfg.timerSeconds * 1000)
      let outcome: PassPlayGuess['outcome'] = 'timeout'
      let score = 0
      if (coords && challenge && countryIndexRef.current) {
        const ok = validateAnswer(challenge, coords, countryIndexRef.current)
        outcome = ok ? 'correct' : 'wrong'
        if (ok) score = scoreRound(elapsedMs, cfg.timerSeconds, challenge, cfg.difficulty).score
      }
      guessesRef.current = [...guessesRef.current, { player: turnRef.current, outcome, score, elapsedMs }]

      const next = turnRef.current + 1
      if (next >= playersRef.current.length) {
        reveal()
        return
      }
      turnRef.current = next
      setTurnIndex(next)
      setPhase('handoff')
      placeCamera(globe)
    },
    [placeCamera, reveal, stopTimers],
  )

  const runTimer = useCallback(
    (token: number) => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
      const limit = configRef.current.timerSeconds * 1000
      timerRef.current = window.setInterval(() => {
        if (tokenRef.current !== token || pausedAtRef.current !== null || lockedRef.current) return
        const left = Math.max(0, limit - (performance.now() - turnStartRef.current))
        setRemainingMs(left)
        if (left <= 0) finishTurn(null, null)
      }, 100)
    },
    [finishTurn],
  )

  const ready = useCallback(
    (globe: GlobeNavigationApi | null) => {
      if (phase !== 'handoff') return
      const token = ++tokenRef.current
      placeCamera(globe)
      setRemainingMs(configRef.current.timerSeconds * 1000)
      setPhase('turn')
      graceRef.current = window.setTimeout(() => {
        graceRef.current = null
        if (tokenRef.current !== token) return
        lockedRef.current = false
        turnStartRef.current = performance.now()
        setPickingEnabled(true)
        runTimer(token)
      }, TURN_GRACE_MS)
    },
    [phase, placeCamera, runTimer],
  )

  const submit = useCallback((coords: LatLng, globe: GlobeNavigationApi | null) => finishTurn(coords, globe), [finishTurn])

  const start = useCallback(
    async (list: PassPlayPlayer[], globe: GlobeNavigationApi | null) => {
      tokenRef.current++
      stopTimers()
      lockedRef.current = true
      pausedAtRef.current = null
      setPaused(false)
      setError(null)
      setPickingEnabled(false)
      playersRef.current = list
      setPlayers(list)
      setScores(list.map(() => 0))
      setCorrect(list.map(() => 0))
      setRoundResults(null)
      setPhase('loading')
      try {
        countryIndexRef.current ??= await loadCountryIndex()
        const picks = await selectChallenges(configRef.current.difficulty, configRef.current.rounds)
        challengesRef.current = picks
        setChallenges(picks)
        await prepareRound(0, globe)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Couldn’t start the game — please try again')
        setPhase('setup')
      }
    },
    [prepareRound, stopTimers],
  )

  const nextRound = useCallback(
    (globe: GlobeNavigationApi | null) => {
      const next = roundRef.current + 1
      if (next >= challengesRef.current.length) {
        setRoundResults(null)
        setPhase('final')
        return
      }
      void prepareRound(next, globe)
    },
    [prepareRound],
  )

  const rematch = useCallback((globe: GlobeNavigationApi | null) => start(playersRef.current, globe), [start])

  const reset = useCallback(() => {
    tokenRef.current++
    stopTimers()
    lockedRef.current = true
    pausedAtRef.current = null
    guessesRef.current = []
    setPaused(false)
    setPickingEnabled(false)
    setRoundResults(null)
    setChallenges([])
    challengesRef.current = []
    setError(null)
    setPhase('setup')
  }, [stopTimers])

  const pause = useCallback((): boolean => {
    if (phase !== 'turn' || lockedRef.current || pausedAtRef.current !== null) return false
    pausedAtRef.current = performance.now()
    setRemainingMs(Math.max(0, configRef.current.timerSeconds * 1000 - (pausedAtRef.current - turnStartRef.current)))
    setPickingEnabled(false)
    setPaused(true)
    return true
  }, [phase])

  const resume = useCallback(() => {
    const at = pausedAtRef.current
    if (at === null) return
    turnStartRef.current += performance.now() - at
    pausedAtRef.current = null
    setPaused(false)
    if (!lockedRef.current) setPickingEnabled(true)
  }, [])

  const rankings: PassPlayRanking[] | null =
    phase === 'final'
      ? players
          .map((p, i) => ({ player: i, name: p.name, color: p.color, score: scores[i] ?? 0, correct: correct[i] ?? 0, rank: 0 }))
          .sort((a, b) => b.score - a.score || b.correct - a.correct || a.player - b.player)
          // Equal scores share a place.
          .map((r, _i, all) => ({ ...r, rank: 1 + all.filter((o) => o.score > r.score).length }))
      : null

  return {
    phase,
    config,
    setConfig,
    players,
    challenge: phase === 'turn' || phase === 'reveal' ? challenges[roundIndex] ?? null : null,
    roundIndex,
    totalRounds: challenges.length || config.rounds,
    turnIndex,
    remainingMs,
    pickingEnabled,
    scores,
    roundResults: phase === 'reveal' ? roundResults : null,
    rankings,
    error,
    paused,
    pause,
    resume,
    start,
    ready,
    submit,
    nextRound,
    rematch,
    reset,
  }
}
