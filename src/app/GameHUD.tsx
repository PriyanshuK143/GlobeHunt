import { challengeLabel, type Challenge, type Difficulty } from '../game'

interface GameHUDProps {
  challenge: Challenge | null
  difficulty: Difficulty
  roundIndex: number
  totalRounds: number
  remainingMs: number
  totalScore: number
  loading: boolean
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
}: GameHUDProps) {
  const urgent = remainingMs <= 5000

  return (
    <div className="game-hud" aria-live="polite">
      <div className="game-hud__top">
        <div className="hud-stat">
          <span className="hud-stat__label">Round</span>
          <span className="hud-stat__value">
            {Math.min(roundIndex + 1, totalRounds)}/{totalRounds}
          </span>
        </div>
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
        <span className="game-hud__difficulty">{DIFFICULTY_LABEL[difficulty]}</span>
        <h2 className="game-hud__target">
          {loading ? `Round ${Math.min(roundIndex + 1, totalRounds)} · Travelling…` : challenge ? challengeLabel(challenge) : '—'}
        </h2>
        <p className="game-hud__prompt">
          {loading ? 'Heading to the next region' : 'Drop the target, drag to adjust, then confirm'}
        </p>
      </div>

      <div className="game-hud__progress" aria-hidden>
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
