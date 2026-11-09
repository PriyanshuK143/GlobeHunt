import { useCallback, useState } from 'react'
import { StoryPlayer } from './story/StoryPlayer'
import { HowToSteps } from './HowToSteps'
import './howto.css'

const SEEN_KEY = 'globehunt.howto.seen.v1'

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* storage unavailable */
  }
}

interface HowToPlayProps {
  reducedMotion: boolean
  onMenu: () => void
  onPlay: () => void
}

/**
 * How to Play: a nostalgic animated flashback (first visit), then the modern steps.
 * Returning players land on the steps and can replay the memory any time.
 */
export function HowToPlay({ reducedMotion, onMenu, onPlay }: HowToPlayProps) {
  const [phase, setPhase] = useState<'story' | 'steps'>(() => (readSeen() ? 'steps' : 'story'))
  const [run, setRun] = useState(0)

  const toSteps = useCallback(() => {
    markSeen()
    setPhase('steps')
  }, [])

  return (
    <div className={`howto-screen howto-screen--${phase}`}>
      {phase === 'story' ? (
        <>
          <StoryPlayer key={run} onFinished={toSteps} reducedMotion={reducedMotion} />
          <div className="howto-controls">
            <button type="button" className="howto-skip" onClick={toSteps}>
              Skip ›
            </button>
            <button type="button" className="howto-skip howto-skip--menu" onClick={onMenu}>
              Menu
            </button>
          </div>
        </>
      ) : (
        <HowToSteps
          onPlay={onPlay}
          onMenu={onMenu}
          onReplay={() => {
            setRun((n) => n + 1)
            setPhase('story')
          }}
        />
      )}
    </div>
  )
}
