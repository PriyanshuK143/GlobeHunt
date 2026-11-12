import type { MatchSummary } from '../game'

interface ResultsScreenProps {
  summary: MatchSummary
  onPlayAgain: () => void
  onMenu: () => void
  practice?: boolean
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

export function ResultsScreen({ summary, onPlayAgain, onMenu, practice = false }: ResultsScreenProps) {
  return (
    <div className="overlay-panel overlay-panel--card">
      <h2 className="overlay-panel__heading">{practice ? 'Practice Summary' : 'Results'}</h2>
      <p className="overlay-panel__sub">
        {practice ? 'Practice · ' : ''}
        {DIFFICULTY_LABEL[summary.config.difficulty]} · {summary.results.length}{' '}
        {practice ? (summary.results.length === 1 ? 'location' : 'locations') : summary.results.length === 1 ? 'round' : 'rounds'}
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
          {practice ? 'New Session' : 'Play Again'}
        </button>
      </div>
    </div>
  )
}
