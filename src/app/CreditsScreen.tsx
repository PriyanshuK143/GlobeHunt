import { useCallback, useState } from 'react'
import { CREDIT_TEXT } from './credits/creditLines'
import { FormationFlypast } from './credits/FormationFlypast'

interface CreditsScreenProps {
  reducedMotion: boolean
  onBack: () => void
}

/**
 * Credits: a three-jet formation lays smoke lines across the night sky; as the smoke
 * fades, each credit fades in. A hidden live region mirrors the text for screen readers.
 */
export function CreditsScreen({ reducedMotion, onBack }: CreditsScreenProps) {
  const [done, setDone] = useState(reducedMotion)
  const [skipToken, setSkipToken] = useState(0)
  const [line, setLine] = useState(0)

  const handleComplete = useCallback(() => setDone(true), [])
  const handleLine = useCallback((index: number) => setLine(index), [])

  return (
    <div className="credits-screen">
      <div className="credits-stage">
        <FormationFlypast
          reducedMotion={reducedMotion}
          skipToken={skipToken}
          onComplete={handleComplete}
          onLine={handleLine}
        />
      </div>

      <p className="sr-only" aria-live="polite">
        {done ? CREDIT_TEXT.join('. ') : CREDIT_TEXT[line] ?? ''}
      </p>

      <div className="credits-actions">
        {!done ? (
          <button
            type="button"
            className="gh-btn gh-btn--ghost"
            onClick={() => {
              setSkipToken((n) => n + 1)
              setDone(true)
            }}
          >
            Skip
          </button>
        ) : (
          <button type="button" className="gh-btn gh-btn--primary credits-menu-btn" onClick={onBack}>
            Main Menu
          </button>
        )}
      </div>
    </div>
  )
}
