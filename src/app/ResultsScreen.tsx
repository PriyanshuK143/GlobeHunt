import type { MatchSummary } from '../game'

interface ResultsScreenProps {
  summary: MatchSummary
  onPlayAgain: () => void
  onMenu: () => void
}

const DIFFICULTY_LABEL = {
  simple: 'Simple',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
} as const

function formatAvg(ms: number | null): string {
  if (ms === null) return '—'
  return `${(ms / 1000).toFixed(1)}s`
}

export function ResultsScreen({ summary, onPlayAgain, onMenu }: ResultsScreenProps) {
  return (
    <div className="overlay-panel overlay-panel--card">
      <h2 className="overlay-panel__heading">Results</h2>
      <p className="overlay-panel__sub">
        {DIFFICULTY_LABEL[summary.config.difficulty]} · {summary.config.rounds} rounds
      </p>

      <p className="results-score">{summary.totalScore}</p>
      <p className="results-score-label">Total score</p>

      <dl className="results-grid">
        <div>
          <dt>Correct</dt>
          <dd>
            {summary.correctCount}/{summary.results.length}
          </dd>
        </div>
        <div>
          <dt>Missed</dt>
          <dd>{summary.missedCount}</dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{Math.round(summary.accuracy * 100)}%</dd>
        </div>
        <div>
          <dt>Avg find time</dt>
          <dd>{formatAvg(summary.averageFindMs)}</dd>
        </div>
      </dl>

      {summary.missedCount > 0 ? (
        <div className="missed-list">
          <h3>Missed</h3>
          <ul>
            {summary.results
              .filter((r) => r.outcome === 'timeout')
              .map((r) => (
                <li key={r.challenge.id}>{r.challenge.name}</li>
              ))}
          </ul>
        </div>
      ) : null}

      <div className="overlay-actions">
        <button type="button" className="gh-btn gh-btn--ghost" onClick={onMenu}>
          Main Menu
        </button>
        <button type="button" className="gh-btn gh-btn--primary" onClick={onPlayAgain}>
          Play Again
        </button>
      </div>
    </div>
  )
}
