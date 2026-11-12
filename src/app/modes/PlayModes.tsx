import { PLAY_MODES, type PlayMode } from './playModes'

interface ChooserProps {
  title: 'Singleplayer' | 'Multiplayer'
  options: [PlayMode, PlayMode]
  onPick: (mode: PlayMode) => void
  onBack: () => void
}

/** Singleplayer → Classic / Practice; Multiplayer → Online / Pass & Play. */
export function ModeChooser({ title, options, onPick, onBack }: ChooserProps) {
  return (
    <div className="overlay-panel overlay-panel--card mode-panel">
      <h2 className="overlay-panel__heading">{title}</h2>
      <div className="mode-options">
        {options.map((m) => (
          <button key={m} type="button" className="option-chip mode-option" onClick={() => onPick(m)}>
            <span className="option-chip__label">{PLAY_MODES[m].title}</span>
            <span className="option-chip__blurb">{PLAY_MODES[m].blurb}</span>
          </button>
        ))}
      </div>
      <div className="overlay-actions">
        <button type="button" className="gh-btn gh-btn--ghost" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}

interface RulesProps {
  mode: PlayMode
  onContinue: () => void
  onBack: () => void
}

/** A short rules screen shown before each mode's setup. */
export function ModeRules({ mode, onContinue, onBack }: RulesProps) {
  const info = PLAY_MODES[mode]
  return (
    <div className="overlay-panel overlay-panel--card mode-panel">
      <p className="setup-panel__mode">{info.title}</p>
      <h2 className="overlay-panel__heading">How it works</h2>
      <ol className="mode-rules">
        {info.rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      <div className="overlay-actions">
        <button type="button" className="gh-btn gh-btn--ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="gh-btn gh-btn--primary" onClick={onContinue} autoFocus>
          Continue
        </button>
      </div>
    </div>
  )
}
