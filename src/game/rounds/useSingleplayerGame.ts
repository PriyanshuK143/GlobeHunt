import { useCallback, useEffect, useRef, useState } from 'react'
import type { GlobeNavigationApi, LatLng } from '../../globe'
import { DEFAULT_CONFIG } from '../config'
import { loadCountryIndex, type CountryRecord } from '../data/countryIndex'
import { travelTo } from '../navigation/travel'
import { regionalRoundView } from '../navigation/regionView'
import { loadPool } from '../data/pool'
import { scoreRound } from '../scoring/scoreRound'
import { validateAnswer } from '../validation/validateAnswer'
import { selectChallenges } from './selectChallenges'
import { summarizeMatch } from './summarizeMatch'
import type {
  Challenge,
  GameConfig,
  GamePhase,
  MatchSummary,
  RoundResult,
} from '../types'

export interface SingleplayerGameApi {
  phase: GamePhase
  config: GameConfig
  setConfig: (patch: Partial<GameConfig>) => void
  currentChallenge: Challenge | null
  roundIndex: number
  totalRounds: number
  remainingMs: number
  totalScore: number
  lastRoundResult: RoundResult | null
  missFlash: number
  successFlash: number
  summary: MatchSummary | null
  error: string | null
  pickingEnabled: boolean
  /** Round frozen by the pause menu. */
  paused: boolean
  pause: () => boolean
  resume: () => void
  openConfig: () => void
  backToMenu: () => void
  startGame: (globe: GlobeNavigationApi | null) => Promise<void>
  handleGlobePick: (coords: LatLng) => void
  continueAfterRound: (globe: GlobeNavigationApi | null) => Promise<void>
  playAgain: (globe: GlobeNavigationApi | null) => Promise<void>
}

export function useSingleplayerGame(): SingleplayerGameApi {
  const [phase, setPhase] = useState<GamePhase>('menu')
  const [config, setConfigState] = useState<GameConfig>(DEFAULT_CONFIG)
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [remainingMs, setRemainingMs] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [results, setResults] = useState<RoundResult[]>([])
  const [lastRoundResult, setLastRoundResult] = useState<RoundResult | null>(null)
  const [summary, setSummary] = useState<MatchSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [missFlash, setMissFlash] = useState(0)
  const [successFlash, setSuccessFlash] = useState(0)
  const [pickingEnabled, setPickingEnabled] = useState(false)
  const [countryIndex, setCountryIndex] = useState<Map<string, CountryRecord> | null>(null)

  const roundStartRef = useRef(0)
  const attemptsRef = useRef(0)
  const scoredRef = useRef(false)
  const timerIdRef = useRef<number | null>(null)
  const challengesRef = useRef<Challenge[]>([])
  const roundIndexRef = useRef(0)
  const configRef = useRef(config)
  const countryIndexRef = useRef(countryIndex)
  const resultsRef = useRef<RoundResult[]>([])
  const beginTokenRef = useRef(0)
  const pausedAtRef = useRef<number | null>(null)
  const [paused, setPaused] = useState(false)
  const phaseRef = useRef<GamePhase>('menu')
  const pickingRef = useRef(false)

  configRef.current = config
  phaseRef.current = phase
  pickingRef.current = pickingEnabled
  countryIndexRef.current = countryIndex
  challengesRef.current = challenges
  roundIndexRef.current = roundIndex
  resultsRef.current = results

  const clearTimer = useCallback(() => {
    if (timerIdRef.current !== null) {
      window.clearInterval(timerIdRef.current)
      timerIdRef.current = null
    }
  }, [])

  useEffect(() => () => clearTimer(), [clearTimer])

  const setConfig = useCallback((patch: Partial<GameConfig>) => {
    setConfigState((prev) => ({ ...prev, ...patch }))
  }, [])

  const openConfig = useCallback(() => {
    clearTimer()
    setPickingEnabled(false)
    setError(null)
    setPhase('config')
  }, [clearTimer])

  const backToMenu = useCallback(() => {
    beginTokenRef.current += 1
    clearTimer()
    pausedAtRef.current = null
    setPaused(false)
    scoredRef.current = false
    setPickingEnabled(false)
    setPhase('menu')
    setChallenges([])
    setRoundIndex(0)
    setResults([])
    setLastRoundResult(null)
    setSummary(null)
    setTotalScore(0)
    setError(null)
  }, [clearTimer])

  const endRound = useCallback(
    (outcome: 'correct' | 'timeout', challenge: Challenge) => {
      if (scoredRef.current) return
      scoredRef.current = true
      setPickingEnabled(false)
      clearTimer()

      const elapsedMs = Math.min(
        performance.now() - roundStartRef.current,
        configRef.current.timerSeconds * 1000,
      )
      const scored = scoreRound(elapsedMs, configRef.current.timerSeconds, challenge, configRef.current.difficulty)
      const score = outcome === 'correct' ? scored.score : 0

      const result: RoundResult = {
        challenge,
        outcome,
        score,
        multiplier: scored.multiplier,
        elapsedMs,
        attempts: attemptsRef.current,
      }

      resultsRef.current = [...resultsRef.current, result]
      setResults(resultsRef.current)
      setTotalScore((prev) => prev + score)
      setLastRoundResult(result)
      if (outcome === 'correct') setSuccessFlash((n) => n + 1)
      setPhase('round_result')
    },
    [clearTimer],
  )

  const beginRound = useCallback(
    async (index: number, list: Challenge[], globe: GlobeNavigationApi | null) => {
      const challenge = list[index]
      if (!challenge) return

      const token = ++beginTokenRef.current
      clearTimer()
      scoredRef.current = false
      setPickingEnabled(false)
      attemptsRef.current = 0
      setLastRoundResult(null)
      setRoundIndex(index)
      roundIndexRef.current = index
      setRemainingMs(configRef.current.timerSeconds * 1000)
      setPhase('playing')

      // Guided to the target's broad region (shared by every target there), never centred on it.
      const pool = await loadPool()
      await travelTo(globe, regionalRoundView(challenge, configRef.current.difficulty, pool))

      if (beginTokenRef.current !== token) return

      // Small grace period so residual UI pointer events cannot score immediately.
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 350)
      })
      if (beginTokenRef.current !== token) return

      roundStartRef.current = performance.now()
      setPickingEnabled(true)
      runTimer(token, challenge)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clearTimer, endRound],
  )

  /** The single round timer (also used to resume after a pause). */
  const runTimer = useCallback(
    (token: number, challenge: Challenge) => {
      clearTimer()
      const limitMs = configRef.current.timerSeconds * 1000
      timerIdRef.current = window.setInterval(() => {
        if (scoredRef.current || beginTokenRef.current !== token || pausedAtRef.current !== null) return
        const elapsed = performance.now() - roundStartRef.current
        const left = Math.max(0, limitMs - elapsed)
        setRemainingMs(left)
        if (left <= 0) {
          endRound('timeout', challenge)
        }
      }, 100)
    },
    [clearTimer, endRound],
  )

  /** Freeze the running round exactly where it is (timer, target, marker). */
  const pause = useCallback((): boolean => {
    if (phaseRef.current !== 'playing' || !pickingRef.current || scoredRef.current || pausedAtRef.current !== null) return false
    const now = performance.now()
    pausedAtRef.current = now
    clearTimer()
    const limitMs = configRef.current.timerSeconds * 1000
    setRemainingMs(Math.max(0, limitMs - (now - roundStartRef.current)))
    setPickingEnabled(false)
    setPaused(true)
    return true
  }, [clearTimer])

  /** Continue with the exact remaining time: the paused span is excluded. */
  const resume = useCallback(() => {
    const pausedAt = pausedAtRef.current
    if (pausedAt === null) return
    roundStartRef.current += performance.now() - pausedAt
    pausedAtRef.current = null
    setPaused(false)
    const challenge = challengesRef.current[roundIndexRef.current]
    if (!challenge || scoredRef.current) return
    setPickingEnabled(true)
    runTimer(beginTokenRef.current, challenge)
  }, [runTimer])

  const startGame = useCallback(
    async (globe: GlobeNavigationApi | null) => {
      setError(null)
      setPhase('loading')
      clearTimer()
      setPickingEnabled(false)
      setResults([])
      resultsRef.current = []
      setLastRoundResult(null)
      setSummary(null)
      setTotalScore(0)

      try {
        const index = countryIndexRef.current ?? (await loadCountryIndex())
        setCountryIndex(index)
        countryIndexRef.current = index

        const list = await selectChallenges(configRef.current.difficulty, configRef.current.rounds)
        setChallenges(list)
        challengesRef.current = list
        await beginRound(0, list, globe)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Couldn’t start the game — please try again'
        setError(message)
        setPhase('config')
      }
    },
    [beginRound, clearTimer],
  )

  const continueAfterRound = useCallback(
    async (globe: GlobeNavigationApi | null) => {
      const next = roundIndexRef.current + 1
      const list = challengesRef.current
      if (next >= list.length) {
        setSummary(summarizeMatch(configRef.current, resultsRef.current))
        setPhase('results')
        return
      }
      await beginRound(next, list, globe)
    },
    [beginRound],
  )

  const playAgain = useCallback(
    async (globe: GlobeNavigationApi | null) => {
      await startGame(globe)
    },
    [startGame],
  )

  const handleGlobePick = useCallback(
    (coords: LatLng) => {
      if (!pickingEnabled || scoredRef.current) return
      const challenge = challengesRef.current[roundIndexRef.current]
      const index = countryIndexRef.current
      if (!challenge || !index) return

      attemptsRef.current += 1
      const ok = validateAnswer(challenge, coords, index)
      if (ok) {
        endRound('correct', challenge)
      } else {
        setMissFlash((n) => n + 1)
      }
    },
    [endRound, pickingEnabled],
  )

  const currentChallenge =
    phase === 'playing' || phase === 'round_result' || phase === 'loading'
      ? challenges[roundIndex] ?? null
      : null

  return {
    phase,
    config,
    setConfig,
    currentChallenge,
    roundIndex,
    totalRounds: challenges.length || config.rounds,
    remainingMs,
    totalScore,
    lastRoundResult,
    missFlash,
    successFlash,
    summary,
    error,
    pickingEnabled,
    paused,
    pause,
    resume,
    openConfig,
    backToMenu,
    startGame,
    handleGlobePick,
    continueAfterRound,
    playAgain,
  }
}
