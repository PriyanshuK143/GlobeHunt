interface MultiplayerHubProps {
  connected: boolean
  onCreate: () => void
  onJoin: () => void
  onBack: () => void
}

export function MultiplayerHub({ connected, onCreate, onJoin, onBack }: MultiplayerHubProps) {
  return (
    <div className="overlay-panel overlay-panel--card">
      <p className="setup-panel__mode">Multiplayer</p>
      <h2 className="overlay-panel__heading">Online</h2>
      {connected ? null : <p className="overlay-panel__sub">Connecting to the server…</p>}
      <div className="overlay-actions overlay-actions--stack">
        <button
          type="button"
          className="gh-btn gh-btn--primary"
          disabled={!connected}
          onClick={onCreate}
        >
          Create Room
        </button>
        <button
          type="button"
          className="gh-btn gh-btn--ghost"
          disabled={!connected}
          onClick={onJoin}
        >
          Join Room
        </button>
        <button type="button" className="gh-btn gh-btn--ghost" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}
