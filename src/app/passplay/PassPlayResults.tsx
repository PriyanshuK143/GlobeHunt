import { useEffect, useRef } from 'react'
import { discoveryInfoFor, type Challenge, type PassPlayGuess, type PassPlayPlayer, type PassPlayRanking } from '../../game'
import { DiscoveryCard } from '../DiscoveryCard'

function outcomeText(g: PassPlayGuess): string {
  if (g.outcome === 'correct') return `Found · ${(g.elapsedMs / 1000).toFixed(1)}s`
  return g.outcome === 'wrong' ? 'Wrong spot' : 'No guess'
}

interface RevealProps {
  challenge: Challenge
  players: PassPlayPlayer[]
  results: PassPlayGuess[]
  scores: number[]
  isLast: boolean
  onNext: () => void
}

/** Round reveal, shown only after every player has guessed: the answer and this round's points. */
export function PassPlayReveal({ challenge, players, results, scores, isLast, onNext }: RevealProps) {
  const anyFound = results.some((r) => r.outcome === 'correct')
  // Focus the action for keyboard users without scrolling the card (autoFocus would
  // scroll a tall card and push the place name out of view on small phones).
  const nextRef = useRef<HTMLButtonElement>(null)
  useEffect(() => nextRef.current?.focus({ preventScroll: true }), [])
  return (
    <DiscoveryCard
      info={discoveryInfoFor(challenge)}
      found={anyFound}
      banner={anyFound ? 'Round results' : 'Nobody found it — here it is'}
      footer={
        <button ref={nextRef} type="button" className="gh-btn gh-btn--primary" onClick={onNext}>
          {isLast ? 'See Final Results' : 'Next Round'}
        </button>
      }
    >
      {/* Two columns of small cells: name and running total, then this round's result. */}
      <ol className="pp-board">
        {results.map((r) => {
          const p = players[r.player]
          return (
            <li key={r.player} className={`pp-cell is-${r.outcome}`} style={{ ['--player-color' as string]: p.color }}>
              <span className="pp-cell__top">
                <span className="pp-dot" aria-hidden />
                <span className="pp-cell__name">{p.name}</span>
                <span className="pp-cell__total" aria-label={`${scores[r.player]} points in total`}>
                  {scores[r.player]}
                </span>
              </span>
              <span className="pp-cell__detail">
                {outcomeText(r)} · +{r.score}
              </span>
            </li>
          )
        })}
      </ol>
    </DiscoveryCard>
  )
}

interface FinalProps {
  rankings: PassPlayRanking[]
  totalRounds: number
  onRematch: () => void
  onChangePlayers: () => void
  onMenu: () => void
}

function listNames(names: string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function headline(rankings: PassPlayRanking[]): string {
  const winners = rankings.filter((r) => r.rank === 1)
  const top = winners[0]
  if (!top || top.score === 0) return 'Nobody scored this time.'
  if (winners.length === rankings.length) return 'It’s a draw!'
  if (winners.length > 1) return `It’s a tie between ${listNames(winners.map((w) => w.name))}!`
  return `${top.name} wins with ${top.score} points!`
}

/** Final leaderboard: winner (or tie), every player's total, and what to do next. */
export function PassPlayFinal({ rankings, totalRounds, onRematch, onChangePlayers, onMenu }: FinalProps) {
  const winners = rankings.filter((r) => r.rank === 1)
  // Highlight only a real winner (or a partial tie), not a draw or an all-zero game.
  const highlight = (winners[0]?.score ?? 0) > 0 && winners.length < rankings.length
  return (
    <div className="overlay-panel overlay-panel--card">
      <p className="setup-panel__mode">Pass &amp; Play</p>
      <h2 className="overlay-panel__heading">Final Results</h2>
      <p className="overlay-panel__sub">{headline(rankings)}</p>
      <ol className="player-list">
        {rankings.map((r) => (
          <li
            key={r.player}
            className={`player-list__item pp-row ${highlight && r.rank === 1 ? 'is-winner' : ''}`}
            style={{ ['--player-color' as string]: r.color }}
          >
            <span className="pp-row__name">
              <span className="pp-dot" aria-hidden />#{r.rank} {r.name}
            </span>
            <span>
              {r.score} pts · {r.correct}/{totalRounds} found
            </span>
          </li>
        ))}
      </ol>
      <div className="pp-final-actions">
        <button type="button" className="gh-btn gh-btn--primary pp-final-actions__main" onClick={onRematch}>
          Rematch
        </button>
        <button type="button" className="gh-btn gh-btn--ghost" onClick={onChangePlayers}>
          Change Players
        </button>
        <button type="button" className="gh-btn gh-btn--ghost" onClick={onMenu}>
          Main Menu
        </button>
      </div>
    </div>
  )
}
