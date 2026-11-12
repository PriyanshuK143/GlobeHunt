import type { GameConfig } from '../game'
import { GameSetupOptions } from './setup/GameSetupOptions'

interface GameConfigPanelProps {
  config: GameConfig
  error: string | null
  onChange: (patch: Partial<GameConfig>) => void
  onStart: () => void
  onBack: () => void
  /** Practice: unlimited locations, no round count. */
  practice?: boolean
}

/** Game Setup screen shown after choosing Singleplayer. */
export function GameConfigPanel({ config, error, onChange, onStart, onBack, practice = false }: GameConfigPanelProps) {
  return (
    <div className="overlay-panel overlay-panel--card setup-panel">
      <p className="setup-panel__mode">Singleplayer · {practice ? 'Practice' : 'Classic'}</p>
      <h2 className="overlay-panel__heading">Game Setup</h2>

      <GameSetupOptions config={config} onChange={onChange} hideRounds={practice} hideLabels={practice} />

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overlay-actions">
        <button type="button" className="gh-btn gh-btn--ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="gh-btn gh-btn--primary" onClick={onStart}>
          {practice ? 'Start Practice' : 'Start Game'}
        </button>
      </div>
    </div>
  )
}
