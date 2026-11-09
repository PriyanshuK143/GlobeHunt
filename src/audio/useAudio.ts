import { useEffect, useSyncExternalStore } from 'react'
import { audio, type MusicScene } from './engine'
import type { AppSettings } from '../settings/settings'

/** True once sound can actually play (autoplay allowed, or after the first gesture). */
export function useAudioUnlocked(): boolean {
  return useSyncExternalStore(
    (fn) => audio.subscribe(fn),
    () => audio.unlocked,
    () => false,
  )
}

/**
 * Starts audio as early as the browser allows: an automatic attempt shortly after load
 * (works where the site is allowed to autoplay), otherwise on the first click / key /
 * touch anywhere on the page. The first music always fades in slowly.
 */
export function useAudioUnlock(): void {
  useEffect(() => {
    const id = window.setTimeout(() => audio.tryAutoStart(), 1200)
    return () => window.clearTimeout(id)
  }, [])
  useEffect(() => {
    const unlock = () => audio.unlock()
    const opts = { capture: true, passive: true } as const
    window.addEventListener('pointerdown', unlock, opts)
    window.addEventListener('keydown', unlock, opts)
    window.addEventListener('touchend', unlock, opts)
    return () => {
      window.removeEventListener('pointerdown', unlock, opts)
      window.removeEventListener('keydown', unlock, opts)
      window.removeEventListener('touchend', unlock, opts)
    }
  }, [])
}

/** Keeps engine volumes in sync with settings. */
export function useAudioSettings(settings: AppSettings): void {
  useEffect(() => {
    audio.setLevels({
      master: settings.masterVolume,
      music: settings.musicVolume,
      ambient: settings.ambientVolume,
      sfx: settings.sfxVolume,
      muted: settings.muted,
    })
  }, [settings])
}

/** Declares the soundtrack for the current screen (idempotent). */
export function useMusicScene(scene: MusicScene): void {
  useEffect(() => {
    audio.setScene(scene)
  }, [scene])
}
