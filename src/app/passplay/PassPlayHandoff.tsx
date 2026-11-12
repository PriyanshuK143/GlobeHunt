import type { PassPlayPlayer } from '../../game'

interface PassPlayHandoffProps {
  player: PassPlayPlayer
  roundIndex: number
  totalRounds: number
  turnIndex: number
  totalTurns: number
  onReady: () => void
  onQuit: () => void
}

/**
 * Full-screen privacy screen between turns. It is opaque and sits above the globe,
 * the HUD and every guess, so nothing from the previous turn can be seen or touched.
 */
export function PassPlayHandoff({ player, roundIndex, totalRounds, turnIndex, totalTurns, onReady, onQuit }: PassPlayHandoffProps) {
  return (
    <div
      className="pp-handoff"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pp-handoff-title"
      style={{ ['--player-color' as string]: player.color }}
    >
      <div className="pp-handoff__inner">
        <p className="pp-handoff__meta">
          Round {roundIndex + 1} of {totalRounds} · Turn {turnIndex + 1} of {totalTurns}
        </p>
        <h2 id="pp-handoff-title" className="pp-handoff__title">
          Pass the device
        </h2>
        <p className="pp-handoff__to">
          Give the device to <strong className="pp-handoff__name">{player.name}</strong>.
        </p>
        <p className="pp-handoff__note">Keep the last guess out of sight, then tap Ready.</p>
        <button type="button" className="gh-btn gh-btn--primary pp-handoff__ready" onClick={onReady} autoFocus>
          Ready
        </button>
        <button type="button" className="pp-handoff__quit" onClick={onQuit}>
          Quit to menu
        </button>
      </div>
    </div>
  )
}
