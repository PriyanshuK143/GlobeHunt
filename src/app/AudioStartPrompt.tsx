import { useEffect, useState } from 'react'
import { useAudioUnlocked } from '../audio'

/** A quiet, persistent cue; any first click/tap/key unlocks audio through useAudioUnlock. */
export function AudioStartPrompt({ muted }: { muted: boolean }) {
  const unlocked = useAudioUnlocked()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!unlocked) return
    const timeout = window.setTimeout(() => setDismissed(true), 220)
    return () => window.clearTimeout(timeout)
  }, [unlocked])

  if (muted || dismissed) return null

  return (
    <div className={`audio-start-prompt${unlocked ? ' is-leaving' : ''}`} role="status" aria-live="polite">
      <span className="audio-start-prompt__mark" aria-hidden="true" />
      <span>Click or tap anywhere to start the music</span>
    </div>
  )
}
