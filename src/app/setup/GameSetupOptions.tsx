import { useState } from 'react'
import {
  DIFFICULTY_OPTIONS,
  MAX_ROUNDS,
  MIN_ROUNDS,
  ROUND_OPTIONS,
  TIMER_OPTIONS,
  clampRounds,
  type GameConfig,
} from '../../game'

interface GameSetupOptionsProps {
  config: GameConfig
  onChange: (patch: Partial<GameConfig>) => void
  /** Non-host multiplayer players see the host's choices but can't edit them. */
  readOnly?: boolean
}

/** Shared game configuration controls (singleplayer setup + multiplayer lobby). */
export function GameSetupOptions({ config, onChange, readOnly = false }: GameSetupOptionsProps) {
  const isPreset = ROUND_OPTIONS.includes(config.rounds)
  const [customOpen, setCustomOpen] = useState(!isPreset)
  const [draft, setDraft] = useState(String(config.rounds))

  const commitCustom = (raw: string) => {
    const n = clampRounds(Number(raw))
    setDraft(String(n))
    onChange({ rounds: n })
  }

  return (
    <div className={`setup-options ${readOnly ? 'is-readonly' : ''}`}>
      <fieldset className="option-group" disabled={readOnly}>
        <legend>Difficulty</legend>
        <div className="option-grid option-grid--2">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`option-chip ${config.difficulty === opt.value ? 'is-active' : ''}`}
              aria-pressed={config.difficulty === opt.value}
              onClick={() => onChange({ difficulty: opt.value })}
            >
              <span className="option-chip__label">{opt.label}</span>
              <span className="option-chip__blurb">{opt.blurb}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="option-group" disabled={readOnly}>
        <legend>Rounds</legend>
        <div className="option-row">
          {ROUND_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`option-pill ${config.rounds === n && !customOpen ? 'is-active' : ''}`}
              aria-pressed={config.rounds === n && !customOpen}
              onClick={() => {
                setCustomOpen(false)
                setDraft(String(n))
                onChange({ rounds: n })
              }}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className={`option-pill ${customOpen ? 'is-active' : ''}`}
            aria-pressed={customOpen}
            onClick={() => setCustomOpen(true)}
          >
            Custom
          </button>
          {customOpen ? (
            <label className="custom-rounds">
              <span className="sr-only">Custom round count</span>
              <input
                type="number"
                inputMode="numeric"
                min={MIN_ROUNDS}
                max={MAX_ROUNDS}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={(e) => commitCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitCustom((e.target as HTMLInputElement).value)
                }}
              />
              <span className="custom-rounds__hint">
                {MIN_ROUNDS}–{MAX_ROUNDS}
              </span>
            </label>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="option-group" disabled={readOnly}>
        <legend>Round timer</legend>
        <div className="option-row">
          {TIMER_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`option-pill ${config.timerSeconds === n ? 'is-active' : ''}`}
              aria-pressed={config.timerSeconds === n}
              onClick={() => onChange({ timerSeconds: n })}
            >
              {n}s
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="option-group labels-toggle" disabled={readOnly}>
        <legend>Show place names on map</legend>
        <div className="labels-toggle__row">
          <div className="segmented" role="radiogroup" aria-label="Show place names on map">
            {[true, false].map((on) => (
              <button
                key={String(on)}
                type="button"
                role="radio"
                aria-checked={config.showLabels === on}
                className={`segmented__btn ${config.showLabels === on ? 'is-active' : ''}`}
                onClick={() => onChange({ showLabels: on })}
              >
                {on ? 'On' : 'Off'}
              </button>
            ))}
          </div>
          <p className="labels-toggle__note">
            {config.showLabels
              ? 'Use geographical labels to help locate places on Earth.'
              : 'Explore Earth without geographical labels.'}
          </p>
        </div>
      </fieldset>
    </div>
  )
}

/** Compact one-line summary (lobby, non-host view). */
export function configSummary(config: GameConfig): string {
  const diff = DIFFICULTY_OPTIONS.find((d) => d.value === config.difficulty)
  return `${diff?.label ?? config.difficulty} · ${config.rounds} rounds · ${config.timerSeconds}s · labels ${config.showLabels ? 'on' : 'off'}`
}
