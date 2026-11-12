import { discoveryInfoFor, type RoundResult } from '../game'
import { DiscoveryCard } from './DiscoveryCard'

interface RoundResultOverlayProps {
  result: RoundResult
  isLast: boolean
  onContinue: () => void
  /** Practice: endless, with an explicit way out. */
  onEndPractice?: () => void
}

/** Singleplayer round end: the discovery moment (or the reveal after a timeout). */
export function RoundResultOverlay({ result, isLast, onContinue, onEndPractice }: RoundResultOverlayProps) {
  const success = result.outcome === 'correct'
  const info = discoveryInfoFor(result.challenge)
  const stats = success
    ? [
        { label: 'Search time', value: `${(result.elapsedMs / 1000).toFixed(1)}s` },
        { label: 'Points', value: `+${result.score}` },
        { label: 'Multiplier', value: `×${result.multiplier.toFixed(2).replace(/0$/, '')}` },
        { label: 'Attempts', value: String(result.attempts) },
      ]
    : result.attempts > 0
      ? [{ label: 'Attempts', value: String(result.attempts) }]
      : []

  return (
    <DiscoveryCard
      info={info}
      found={success}
      stats={stats}
      footer={
        onEndPractice ? (
          <div className="overlay-actions">
            <button type="button" className="gh-btn gh-btn--ghost" onClick={onEndPractice}>
              End Practice
            </button>
            <button type="button" className="gh-btn gh-btn--primary" onClick={onContinue} autoFocus>
              Next Location
            </button>
          </div>
        ) : (
          <button type="button" className="gh-btn gh-btn--primary" onClick={onContinue} autoFocus>
            {isLast ? 'See Results' : 'Next Location'}
          </button>
        )
      }
    />
  )
}
