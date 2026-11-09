/**
 * Ambient scene profile — drives every decorative layer around the globe.
 * - `showcase`: home / menus — cinematic, idle rotation, full orbital ambience.
 * - `gameplay`: an active match — globe never auto-rotates, effects stay in the background.
 */
export type AmbientMode = 'showcase' | 'gameplay'

/** User-facing effects level (Settings → Visual). */
export type AmbientEffectsLevel = 'full' | 'reduced' | 'off'

export interface AmbientProfile {
  mode: AmbientMode
  effects: AmbientEffectsLevel
  /** User setting OR OS `prefers-reduced-motion`. */
  reducedMotion: boolean
  quality: 'low' | 'medium' | 'high'
}

export const DEFAULT_AMBIENT: AmbientProfile = {
  mode: 'showcase',
  effects: 'full',
  reducedMotion: false,
  quality: 'high',
}
