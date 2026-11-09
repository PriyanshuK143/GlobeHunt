import { scoreAnswer, scoreMultiplier } from '../../../shared/geoPool'
import type { Challenge, Difficulty, TimerSeconds } from '../types'

/** Speed score × difficulty / feature multiplier (identical to the server). */
export function scoreRound(elapsedMs: number, timerSeconds: TimerSeconds, challenge: Challenge, difficulty: Difficulty) {
  const multiplier = scoreMultiplier(challenge, difficulty)
  return { score: scoreAnswer(elapsedMs, timerSeconds, multiplier), multiplier }
}
