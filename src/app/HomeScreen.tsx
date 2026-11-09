interface HomeScreenProps {
  flying: boolean
  onFly: () => void
  /** Set when opened from a friend's invite link. */
  inviteCode?: string | null
  /** Coming back from the menu: a quicker entrance than the first launch. */
  returning?: boolean
}

const TITLE = 'GLOBEHUNT'

export function HomeScreen({ flying, onFly, inviteCode, returning }: HomeScreenProps) {
  return (
    <div className={`overlay-panel home-screen ${flying ? 'is-flying' : ''} ${returning ? 'is-return' : ''}`}>
      <div className="home-screen__dock">
        <h1 className="brand-block__title home-title" aria-label={TITLE}>
          {TITLE.split('').map((ch, i) => (
            <span
              key={i}
              className="home-title__letter"
              style={{ animationDelay: returning ? `${i * 0.025}s` : `${0.15 + i * 0.06}s` }}
              aria-hidden
            >
              {ch}
            </span>
          ))}
        </h1>
        <p className="home-screen__tagline">
          {inviteCode ? 'A friend invited you to a match.' : 'Explore the Earth. Find your place.'}
        </p>
        {inviteCode ? (
          <p className="home-screen__invite">
            Room <strong>{inviteCode}</strong> · Fly in, then join
          </p>
        ) : null}
        <button
          type="button"
          className="gh-btn gh-btn--primary home-screen__fly"
          disabled={flying}
          onClick={onFly}
        >
          <span className="home-screen__fly-label">{flying ? 'Flying…' : 'Fly'}</span>
        </button>
      </div>
    </div>
  )
}
