import { audio, type SfxName } from '../audio'
import type { AppSettings } from './settings'

type LegacySfx = 'click' | 'correct' | 'miss' | 'countdown' | 'round' | 'win' | 'announce'

const MAP: Record<LegacySfx, SfxName> = {
  click: 'click',
  correct: 'discovery',
  miss: 'miss',
  countdown: 'tick',
  round: 'roundEnd',
  win: 'win',
  announce: 'announce',
}

/**
 * Back-compat facade over the audio engine. Volumes/mute are applied by the engine's
 * buses (kept in sync from settings), so `settings` is accepted but not needed here.
 */
export const gameAudio = {
  play(name: LegacySfx, _settings?: AppSettings): void {
    audio.unlock()
    audio.play(MAP[name])
  },
}
