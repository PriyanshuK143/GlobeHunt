import { useEffect, useRef } from 'react'
import { audio, useMusicScene, type MusicScene } from '../audio'
import type { MarkerStore } from '../globe'

interface GameAudioInputs {
  scene: MusicScene
  marker: MarkerStore
  /** True while the player can search (round live, timer running). */
  searching: boolean
  /** Changes once per challenge. */
  challengeKey: string | null
  remainingMs: number
  spSuccess: number
  spMiss: number
  spTimeoutKey: string | null
  mpScreen: string
  mpWinner: boolean | null
}

/**
 * Maps game events to sounds. Every trigger is keyed on a change (counter, key or
 * transition), never on a render, so re-renders can't repeat sounds.
 */
export function useGameAudio(i: GameAudioInputs): void {
  useMusicScene(i.scene)

  // Marker: a soft tick on placement, a lighter one when a drag is released.
  useEffect(() => {
    let last = i.marker.get()
    return i.marker.subscribe(() => {
      const s = i.marker.get()
      if (s.placements !== last.placements && s.position && !s.revealed) audio.play('place')
      else if (last.dragging && !s.dragging && s.position) audio.play('adjust')
      last = s
    })
  }, [i.marker])

  // New target revealed and the search begins.
  const announced = useRef<string | null>(null)
  useEffect(() => {
    if (!i.searching || !i.challengeKey) return
    if (announced.current === i.challengeKey) return
    announced.current = i.challengeKey
    audio.play('challenge')
  }, [i.searching, i.challengeKey])

  // Last five seconds: very soft ticks.
  const lastSecond = useRef(-1)
  useEffect(() => {
    if (!i.searching) {
      lastSecond.current = -1
      return
    }
    const sec = Math.ceil(i.remainingMs / 1000)
    if (sec <= 5 && sec >= 1 && sec !== lastSecond.current) audio.play('tick')
    lastSecond.current = sec
  }, [i.searching, i.remainingMs])

  // Mission Control tension: builds over the last 10 seconds, releases when the search ends.
  useEffect(() => {
    const sec = i.remainingMs / 1000
    audio.setTension(i.searching && sec <= 10 && sec > 0 ? 0.25 + 0.75 * (1 - sec / 10) : 0)
  }, [i.searching, i.remainingMs])
  useEffect(() => () => audio.setTension(0), [])

  useEffect(() => {
    if (i.spSuccess > 0) audio.play('discovery')
  }, [i.spSuccess])
  useEffect(() => {
    if (i.spMiss > 0) audio.play('miss')
  }, [i.spMiss])
  useEffect(() => {
    if (i.spTimeoutKey) audio.play('timeout')
  }, [i.spTimeoutKey])

  // Multiplayer round end + final results (restrained winner feedback).
  const prevScreen = useRef(i.mpScreen)
  useEffect(() => {
    const prev = prevScreen.current
    prevScreen.current = i.mpScreen
    if (prev === i.mpScreen) return
    if (i.mpScreen === 'round_result') audio.play('roundEnd')
    if (i.mpScreen === 'match_results') audio.play(i.mpWinner ? 'win' : 'results')
  }, [i.mpScreen, i.mpWinner])
}
