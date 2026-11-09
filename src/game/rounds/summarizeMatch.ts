import type { GameConfig, MatchSummary, RoundResult } from '../types'

export function summarizeMatch(config: GameConfig, results: RoundResult[]): MatchSummary {
  const correct = results.filter((r) => r.outcome === 'correct')
  const totalScore = results.reduce((sum, r) => sum + r.score, 0)
  const averageFindMs =
    correct.length > 0
      ? Math.round(correct.reduce((sum, r) => sum + r.elapsedMs, 0) / correct.length)
      : null

  return {
    config,
    results,
    totalScore,
    correctCount: correct.length,
    missedCount: results.length - correct.length,
    averageFindMs,
    accuracy: results.length === 0 ? 0 : correct.length / results.length,
  }
}
