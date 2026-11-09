import { pickLocations, randomSeed } from '../../../shared/geoPool'
import { loadDifficultyPool } from '../data/pool'
import type { Challenge, Difficulty } from '../types'
import { recentTargets, rememberTargets } from './history'

/**
 * Pick a match's locations from the full difficulty pool: seeded, region-balanced,
 * no repeats within the match, and avoiding targets played in recent games.
 */
export async function selectChallenges(difficulty: Difficulty, count: number, seed = randomSeed()): Promise<Challenge[]> {
  const pool = await loadDifficultyPool(difficulty)
  if (!pool.length) throw new Error(`No locations available for difficulty: ${difficulty}`)
  const picks = pickLocations(pool, count, { seed, recent: recentTargets(difficulty) })
  rememberTargets(difficulty, picks.map((p) => p.id), pool.length)
  return picks
}
