import type { ClientChallengeView, PublicRoom } from '../../../shared/multiplayer'
import type { MpRankings, MpRoundResultView } from '../../multiplayer/useMultiplayer'
import { discoveryInfoForReveal } from '../../game'
import { DiscoveryCard } from '../DiscoveryCard'

interface MpHudProps {
  challenge: ClientChallengeView | null
  room: PublicRoom
  remainingMs: number
  finished: boolean
  finishedCount: number
  /** Server travel window before the search timer starts. */
  travelling?: boolean
}

export function MpGameHUD({
  challenge,
  room,
  remainingMs,
  finished,
  finishedCount,
  travelling = false,
}: MpHudProps) {
  const connected = room.players.filter((p) => p.connected).length
  return (
    <div className="game-hud" aria-live="polite">
      <div className="game-hud__top">
        <div className="hud-stat">
          <span className="hud-stat__label">Round</span>
          <span className="hud-stat__value">
            {(room.roundIndex ?? 0) + 1}/{room.totalRounds ?? room.config.rounds}
          </span>
        </div>
        <div className="hud-stat">
          <span className="hud-stat__label">Done</span>
          <span className="hud-stat__value">
            {finishedCount}/{connected}
          </span>
        </div>
        <div className={`hud-stat hud-stat--timer ${remainingMs <= 5000 ? 'is-urgent' : ''}`}>
          <span className="hud-stat__label">Time</span>
          <span className="hud-stat__value">{Math.min(room.config.timerSeconds, Math.max(0, Math.ceil(remainingMs / 1000)))}</span>
        </div>
      </div>
      <div className="game-hud__challenge">
        <span className="game-hud__difficulty">{room.config.difficulty}</span>
        <h2 className="game-hud__target">{travelling ? 'Travelling…' : challenge?.name ?? '…'}</h2>
        <p className="game-hud__prompt">
          {travelling
            ? 'Heading to the next region'
            : finished
              ? 'Found! Waiting for other players…'
              : 'Drop the target, drag to adjust, then confirm'}
        </p>
      </div>
    </div>
  )
}

interface MpRoundProps {
  view: MpRoundResultView
  selfId: string | null
}

/** Round end for everyone at once: reveal + discovery info + round leaderboard. */
export function MpRoundResultPanel({ view, selfId }: MpRoundProps) {
  const info = view.reveal
    ? discoveryInfoForReveal(view.challengeName, view.reveal)
    : { name: view.challengeName, subtitle: '', location: { lat: 0, lng: 0 } }
  const me = view.results.find((r) => r.playerId === selfId)
  return (
    <DiscoveryCard
      info={info}
      found={me?.outcome === 'correct'}
      stats={
        me
          ? [
              { label: 'Your time', value: me.outcome === 'correct' && me.elapsedMs != null ? `${(me.elapsedMs / 1000).toFixed(1)}s` : '—' },
              { label: 'Points', value: `+${me.score}` },
            ]
          : undefined
      }
      footer={<p className="overlay-hint">Next location coming up…</p>}
    >
      <ol className="player-list discovery-card__board">
        {view.results.map((r, i) => (
          <li key={r.playerId} className={`player-list__item ${r.playerId === selfId ? 'is-self' : ''}`}>
            <span>
              {i + 1}. {r.nickname}
              {r.outcome === 'correct' && r.elapsedMs != null ? ` · ${(r.elapsedMs / 1000).toFixed(1)}s` : ' · missed'}
            </span>
            <span>
              +{r.score} · {r.totalScore}
            </span>
          </li>
        ))}
      </ol>
    </DiscoveryCard>
  )
}

interface MpResultsProps {
  rankings: MpRankings[]
  isHost: boolean
  onLobby: () => void
  onAgain: () => void
  onMenu: () => void
}

export function MpMatchResults({ rankings, isHost, onLobby, onAgain, onMenu }: MpResultsProps) {
  const winner = rankings[0]
  const topScore = winner?.score ?? 0
  const tied = rankings.filter((r) => r.score === topScore)
  return (
    <div className="overlay-panel overlay-panel--card">
      <h2 className="overlay-panel__heading">Match Results</h2>
      <p className="overlay-panel__sub">
        {tied.length > 1
          ? `Tie: ${tied.map((t) => t.nickname).join(', ')}`
          : `Winner: ${winner?.nickname ?? '—'}`}
      </p>
      <ol className="player-list">
        {rankings.map((r, i) => (
          <li key={r.playerId} className="player-list__item">
            <span>
              #{i + 1} {r.nickname}
            </span>
            <span>
              {r.score} pts · {r.correctCount} correct
              {r.averageFindMs != null ? ` · avg ${(r.averageFindMs / 1000).toFixed(1)}s` : ''}
            </span>
          </li>
        ))}
      </ol>
      <div className="overlay-actions">
        <button type="button" className="gh-btn gh-btn--ghost" onClick={onMenu}>
          Main Menu
        </button>
        {isHost ? (
          <>
            <button type="button" className="gh-btn gh-btn--ghost" onClick={onLobby}>
              Lobby
            </button>
            <button type="button" className="gh-btn gh-btn--primary" onClick={onAgain}>
              Play Again
            </button>
          </>
        ) : (
          <button type="button" className="gh-btn gh-btn--ghost" onClick={onLobby}>
            Wait for host
          </button>
        )}
      </div>
    </div>
  )
}
