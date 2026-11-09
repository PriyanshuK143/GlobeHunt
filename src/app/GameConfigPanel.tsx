import type { GameConfig } from '../game'
import { GameSetupOptions } from './setup/GameSetupOptions'

interface GameConfigPanelProps {
  config: GameConfig
  error: string | null
  onChange: (patch: Partial<GameConfig>) => void
  onStart: () => void
  onBack: () => void
}

/** Game Setup screen shown after choosing Singleplayer. */
export function GameConfigPanel({ config, error, onChange, onStart, onBack }: GameConfigPanelProps) {
  return (
    <div className="overlay-panel overlay-panel--card setup-panel">
      <p className="setup-panel__mode">Singleplayer</p>
      <h2 className="overlay-panel__heading">Game Setup</h2>
      <p className="overlay-panel__sub">Choose what to find and how to explore.</p>

      <GameSetupOptions config={config} onChange={onChange} />

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
          Start Game
        </button>
      </div>
    </div>
  )
}
