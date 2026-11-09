import type { Difficulty, GameConfig, RoundCount, TimerSeconds } from './types'

export const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; blurb: string }[] = [
  { value: 'simple', label: 'Simple', blurb: 'Countries' },
  { value: 'medium', label: 'Medium', blurb: 'Major cities' },
  { value: 'hard', label: 'Hard', blurb: 'Smaller cities and towns' },
  { value: 'expert', label: 'Expert', blurb: 'Rivers, mountains, lakes and islands' },
]

export const ROUND_OPTIONS: RoundCount[] = [5, 10, 15, 20]
export const MIN_ROUNDS = 1
export const MAX_ROUNDS = 50

export function clampRounds(n: number): number {
  if (!Number.isFinite(n)) return 10
  return Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, Math.round(n)))
}
export const TIMER_OPTIONS: TimerSeconds[] = [15, 30, 45, 60]

export const DEFAULT_CONFIG: GameConfig = {
  difficulty: 'simple',
  rounds: 10,
  timerSeconds: 30,
  showLabels: true,
}

/** Points awarded for a perfect instant answer. */
export const MAX_ROUND_SCORE = 1000
