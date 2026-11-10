import { initialTier } from '../globe/performanceTier'

export type GraphicsQuality = 'low' | 'medium' | 'high'
export type AmbientEffects = 'full' | 'reduced' | 'off'
/** Player-facing motion level: everything moves / moves gently / stays still. */
export type MotionLevel = 'full' | 'reduced' | 'off'

export interface AppSettings {
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  /** Space ambience: radio chatter, telemetry, observatory air. */
  ambientVolume: number
  muted: boolean
  graphicsQuality: GraphicsQuality
  reducedMotion: boolean
  orbitSensitivity: number
  /** Satellites, orbits, meteors, clouds and other decorative space effects. */
  ambientEffects: AmbientEffects
  /** Occasional ambient one-liners during long searches. */
  ambientCommentary: boolean
  /** Player choice: show decorative space visuals at all. */
  visuals: boolean
  /** Player choice: how much things move. */
  motion: MotionLevel
}

export const DEFAULT_SETTINGS: AppSettings = {
  masterVolume: 0.7,
  musicVolume: 0.6,
  sfxVolume: 0.6,
  ambientVolume: 0.5,
  muted: false,
  graphicsQuality: 'high',
  reducedMotion: false,
  orbitSensitivity: 0.5,
  ambientEffects: 'full',
  ambientCommentary: true,
  visuals: true,
  motion: 'full',
}

/**
 * The Settings screen exposes only "Visual effects: yes/no" and "Motion: full/reduced/off";
 * the engine-level fields are derived from them here.
 */
export function withVisualPrefs(s: AppSettings): AppSettings {
  return {
    ...s,
    reducedMotion: s.motion === 'off',
    ambientEffects: !s.visuals ? 'off' : s.motion === 'reduced' ? 'reduced' : 'full',
    // Per device: lighter scene on low-end laptops / phones (see globe/performanceTier).
    graphicsQuality: initialTier(),
    orbitSensitivity: DEFAULT_SETTINGS.orbitSensitivity,
  }
}

const KEY = 'globehunt.settings.v2'
const LEGACY_KEY = 'globehunt.settings.v1'

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      // Older saves predate the simple visual/motion choices: derive them once.
      if (parsed.motion === undefined) {
        parsed.motion = parsed.reducedMotion ? 'off' : parsed.ambientEffects === 'reduced' ? 'reduced' : 'full'
      }
      if (parsed.visuals === undefined) parsed.visuals = parsed.ambientEffects !== 'off'
      return withVisualPrefs({ ...DEFAULT_SETTINGS, ...parsed })
    }
    // Migrate v1 settings, but start everyone on full space ambience.
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as Partial<AppSettings>
      return { ...DEFAULT_SETTINGS, ...parsed, ambientEffects: 'full', graphicsQuality: initialTier() }
    }
    return { ...DEFAULT_SETTINGS, graphicsQuality: initialTier() }
  } catch {
    return { ...DEFAULT_SETTINGS, graphicsQuality: initialTier() }
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Storage unavailable (private mode) — settings still apply for this session.
  }
}

export function effectiveVolume(
  settings: AppSettings,
  channel: 'music' | 'sfx' | 'ambient',
): number {
  if (settings.muted) return 0
  const channelVol =
    channel === 'music' ? settings.musicVolume : channel === 'ambient' ? settings.ambientVolume : settings.sfxVolume
  return settings.masterVolume * channelVol
}
