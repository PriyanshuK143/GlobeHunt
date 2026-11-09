import { saveSettings, withVisualPrefs, type AppSettings, type MotionLevel } from '../settings/settings'
import { AudioSettingsFields } from './AudioSettingsFields'

interface SettingsScreenProps {
  settings: AppSettings
  onChange: (next: AppSettings) => void
  onBack: () => void
}

const MOTION: Array<{ id: MotionLevel; label: string }> = [
  { id: 'full', label: 'Full' },
  { id: 'reduced', label: 'Reduced' },
  { id: 'off', label: 'Off' },
]

/** Deliberately small: volume, visual effects on/off, and how much things move. */
export function SettingsScreen({ settings, onChange, onBack }: SettingsScreenProps) {
  const update = (patch: Partial<AppSettings>) => {
    const next = withVisualPrefs({ ...settings, ...patch })
    onChange(next)
    saveSettings(next)
  }

  return (
    <div className="overlay-panel overlay-panel--card settings-panel">
      <h2 className="overlay-panel__heading">Settings</h2>

      <fieldset className="option-group">
        <legend>Audio</legend>
        <AudioSettingsFields settings={settings} onChange={update} />
      </fieldset>

      <fieldset className="option-group">
        <legend>Visual effects</legend>
        <div className="option-row">
          {[
            { on: true, label: 'Yes' },
            { on: false, label: 'No' },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              className={`option-pill ${settings.visuals === o.on ? 'is-active' : ''}`}
              aria-pressed={settings.visuals === o.on}
              onClick={() => update({ visuals: o.on })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="option-group">
        <legend>Motion</legend>
        <div className="option-row">
          {MOTION.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`option-pill ${settings.motion === m.id ? 'is-active' : ''}`}
              aria-pressed={settings.motion === m.id}
              onClick={() => update({ motion: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="overlay-actions">
        <button type="button" className="gh-btn gh-btn--primary" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}
