interface MainMenuProps {
  onSingleplayer: () => void
  onMultiplayer: () => void
  onSettings: () => void
  onCredits: () => void
  onHowTo: () => void
  /** Back out to the Fly (home) screen. */
  onBack: () => void
  /** Room code from an invite link: Multiplayer becomes "Join room 1234". */
  inviteCode?: string | null
}

export function MainMenu({ onSingleplayer, onMultiplayer, onSettings, onCredits, onHowTo, onBack, inviteCode }: MainMenuProps) {
  return (
    <div className="overlay-panel overlay-panel--center menu-panel">
      <div className="menu-panel__inner">
        <h1 className="brand-block__title menu-panel__title">GLOBEHUNT</h1>

        <nav className="menu-nav" aria-label="Main">
          <div className="menu-nav__primary">
            {inviteCode ? (
              <>
                <button type="button" className="gh-btn gh-btn--primary menu-nav__btn" onClick={onMultiplayer}>
                  Join room {inviteCode}
                </button>
                <button type="button" className="gh-btn gh-btn--ghost menu-nav__btn" onClick={onSingleplayer}>
                  Singleplayer
                </button>
              </>
            ) : (
              <>
                <button type="button" className="gh-btn gh-btn--primary menu-nav__btn" onClick={onSingleplayer}>
                  Singleplayer
                </button>
                <button type="button" className="gh-btn gh-btn--primary menu-nav__btn" onClick={onMultiplayer}>
                  Multiplayer
                </button>
              </>
            )}
          </div>
          <div className="menu-nav__secondary">
            <button type="button" className="gh-btn gh-btn--ghost menu-nav__btn" onClick={onHowTo}>
              How to Play
            </button>
            <button type="button" className="gh-btn gh-btn--ghost menu-nav__btn" onClick={onSettings}>
              Settings
            </button>
            <button type="button" className="gh-btn gh-btn--ghost menu-nav__btn" onClick={onCredits}>
              Credits
            </button>
          </div>
          <button type="button" className="menu-nav__back menu-nav__btn" onClick={onBack}>
            <span aria-hidden>←</span> Back
          </button>
        </nav>
      </div>
    </div>
  )
}
