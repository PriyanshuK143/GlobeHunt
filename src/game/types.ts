import type { PoolDifficulty, PoolEntry, PoolFeatureKind } from '../../shared/geoPool'

export type Difficulty = PoolDifficulty
/** Whole number of rounds (presets 5/10/15/20 or a custom count). */
export type RoundCount = number
export type TimerSeconds = 15 | 30 | 45 | 60

export interface GameConfig {
  difficulty: Difficulty
  rounds: RoundCount
  timerSeconds: TimerSeconds
  /** Atlas place-name labels on the globe during play. */
  showLabels: boolean
}

export type ChallengeKind = 'country' | 'city' | 'feature'
export type FeatureKind = PoolFeatureKind

/**
 * A playable location from the generated pools (public/game/pool.json): name,
 * classification, continent/region, reveal point and validation geometry.
 */
export type Challenge = PoolEntry

export type RoundOutcome = 'correct' | 'timeout'

export interface RoundResult {
  challenge: Challenge
  outcome: RoundOutcome
  score: number
  /** Difficulty / feature multiplier applied to the speed score. */
  multiplier: number
  elapsedMs: number
  attempts: number
}

export type GamePhase =
  | 'menu'
  | 'config'
  | 'loading'
  | 'playing'
  | 'round_result'
  | 'results'

export interface MatchSummary {
  config: GameConfig
  results: RoundResult[]
  totalScore: number
  correctCount: number
  missedCount: number
  averageFindMs: number | null
  accuracy: number
}
