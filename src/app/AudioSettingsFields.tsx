import type { AppSettings } from '../settings/settings'

type AudioKey = 'masterVolume' | 'musicVolume'

/** Two sliders only: overall volume, and the background soundtrack (music + ambience). */
const SLIDERS: Array<{ key: AudioKey; label: string; also?: 'ambientVolume' }> = [
  { key: 'masterVolume', label: 'Master' },
  { key: 'musicVolume', label: 'Music & ambience', also: 'ambientVolume' },
]

interface AudioSettingsFieldsProps {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
}

/**
 * The one set of audio controls (main Settings screen + pause menu). Changes apply
 * instantly through the existing audio engine; mute overrides every channel.
 */
export function AudioSettingsFields({ settings, onChange }: AudioSettingsFieldsProps) {
  return (
    <div className="audio-fields">
      {SLIDERS.map(({ key, label, also }) => {
        const pct = Math.round(settings[key] * 100)
        return (
          <label key={key} className={`audio-field ${settings.muted ? 'is-muted' : ''}`}>
            <span className="audio-field__row">
              <span>{label}</span>
              <span className="audio-field__pct">{pct}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings[key]}
              style={{ ['--fill' as string]: `${pct}%` }}
              aria-valuetext={`${pct}%`}
              onChange={(e) => {
                const v = Number(e.target.value)
                onChange((also ? { [key]: v, [also]: v } : { [key]: v }) as Partial<AppSettings>)
              }}
            />
          </label>
        )
      })}
      <button
        type="button"
        className={`audio-mute ${settings.muted ? 'is-on' : ''}`}
        aria-pressed={settings.muted}
        onClick={() => onChange({ muted: !settings.muted })}
      >
        {settings.muted ? 'Sound off — tap to unmute' : 'Mute all sound'}
      </button>
    </div>
  )
}
