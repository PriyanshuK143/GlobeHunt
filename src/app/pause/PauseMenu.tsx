import { useEffect, useRef, useState } from 'react'
import type { AppSettings } from '../../settings/settings'
import { AudioSettingsFields } from '../AudioSettingsFields'
import './pause.css'

type View = 'menu' | 'settings' | 'confirm'

interface PauseMenuProps {
  /** Multiplayer: the server match keeps running; only local input is paused. */
  multiplayer: boolean
  settings: AppSettings
  onSettingsChange: (patch: Partial<AppSettings>) => void
  onResume: () => void
  onQuit: () => void
}

/**
 * In-game pause overlay: Resume / Settings (audio only) / Return to main menu.
 * ESC: settings or confirm → back to this menu; menu → resume.
 */
export function PauseMenu({ multiplayer, settings, onSettingsChange, onResume, onQuit }: PauseMenuProps) {
  const [view, setView] = useState<View>('menu')
  const firstButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      if (view === 'menu') onResume()
      else setView('menu')
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [view, onResume])

  useEffect(() => {
    firstButton.current?.focus()
  }, [view])

  return (
    <div className="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className={`pause-panel pause-panel--${view}`} key={view}>
        {view === 'menu' ? (
          <>
            <p className="pause-panel__kicker">{multiplayer ? 'Match in progress' : 'Round paused'}</p>
            <h2 id="pause-title" className="pause-panel__title">
              {multiplayer ? 'Menu' : 'Paused'}
            </h2>
            {multiplayer ? (
              <p className="pause-panel__note">The match and its timer keep running for everyone while this menu is open.</p>
            ) : null}
            <nav className="pause-nav">
              <button ref={firstButton} type="button" className="gh-btn gh-btn--primary" onClick={onResume}>
                Resume
              </button>
              <button type="button" className="gh-btn gh-btn--ghost" onClick={() => setView('settings')}>
                Settings
              </button>
              <button type="button" className="gh-btn gh-btn--ghost pause-nav__quit" onClick={() => setView('confirm')}>
                Return to main menu
              </button>
            </nav>
            <p className="pause-panel__hint">
              <kbd>Esc</kbd> to resume
            </p>
          </>
        ) : null}

        {view === 'settings' ? (
          <>
            <p className="pause-panel__kicker">Settings</p>
            <h2 id="pause-title" className="pause-panel__title pause-panel__title--sm">
              Audio
            </h2>
            <AudioSettingsFields settings={settings} onChange={onSettingsChange} />
            <div className="pause-actions">
              <button ref={firstButton} type="button" className="gh-btn gh-btn--ghost" onClick={() => setView('menu')}>
                Back
              </button>
            </div>
          </>
        ) : null}

        {view === 'confirm' ? (
          <>
            <p className="pause-panel__kicker">Leave {multiplayer ? 'match' : 'round'}?</p>
            <h2 id="pause-title" className="pause-panel__title pause-panel__title--sm">
              Return to main menu
            </h2>
            <p className="pause-panel__note">
              {multiplayer
                ? 'You will leave the room. Your score in this match will be lost and the others will continue without you.'
                : 'Your current round and match progress — score, target and time — will be lost.'}
            </p>
            <div className="pause-actions">
              <button ref={firstButton} type="button" className="gh-btn gh-btn--ghost" onClick={() => setView('menu')}>
                Cancel
              </button>
              <button type="button" className="gh-btn gh-btn--primary pause-actions__danger" onClick={onQuit}>
                Confirm
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
