import { challengeLabel, type Challenge, type Difficulty } from '../game'

interface GameHUDProps {
  challenge: Challenge | null
  difficulty: Difficulty
  roundIndex: number
  totalRounds: number
  remainingMs: number
  totalScore: number
  loading: boolean
  /** Practice: endless — show the question number only, no progress bar. */
  practice?: boolean
  /** Pass & Play: whose turn it is. */
  player?: { name: string; color: string; turn: number; turns: number }
}

function formatTime(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000))
  return String(sec)
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  simple: 'Simple',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
}

export function GameHUD({
  challenge,
  difficulty,
  roundIndex,
  totalRounds,
  remainingMs,
  totalScore,
  loading,
  practice = false,
  player,
}: GameHUDProps) {
  const urgent = remainingMs <= 5000

  return (
    <div className="game-hud" aria-live="polite">
      <div className="game-hud__top">
        <div className="hud-stat">
          <span className="hud-stat__label">{practice ? 'Location' : 'Round'}</span>
          <span className="hud-stat__value">
            {practice ? roundIndex + 1 : `${Math.min(roundIndex + 1, totalRounds)}/${totalRounds}`}
          </span>
        </div>
        {player ? (
          <div className="hud-stat hud-stat--player" style={{ ['--player-color' as string]: player.color }}>
            <span className="hud-stat__label">Turn</span>
            <span className="hud-stat__value">
              {player.turn}/{player.turns}
            </span>
          </div>
        ) : null}
        <div className="hud-stat">
          <span className="hud-stat__label">Score</span>
          <span className="hud-stat__value">{totalScore}</span>
        </div>
        <div className={`hud-stat hud-stat--timer ${urgent ? 'is-urgent' : ''}`}>
          <span className="hud-stat__label">Time</span>
          <span className="hud-stat__value">{formatTime(remainingMs)}</span>
        </div>
      </div>

      <div className="game-hud__challenge">
        <span className="game-hud__difficulty">
          {player ? (
            <span className="game-hud__player" style={{ ['--player-color' as string]: player.color }}>
              {player.name}
            </span>
          ) : null}
          {player ? ' · ' : ''}
          {practice ? 'Practice · ' : ''}
          {DIFFICULTY_LABEL[difficulty]}
        </span>
        <h2 className="game-hud__target">
          {loading ? 'Travelling…' : challenge ? challengeLabel(challenge) : '—'}
        </h2>
        {/* The answer bar already explains the marker; only Pass & Play needs a reminder. */}
        {player && !loading ? <p className="game-hud__prompt">One guess only</p> : null}
      </div>

      <div className="game-hud__progress" aria-hidden hidden={practice}>
        <div
          className="game-hud__progress-fill"
          style={{
            width: `${(Math.min(roundIndex + (loading ? 0 : 1), totalRounds) / totalRounds) * 100}%`,
          }}
        />
      </div>
    </div>
  )
}
