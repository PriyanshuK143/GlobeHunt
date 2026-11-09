interface MultiplayerHubProps {
  connected: boolean
  onCreate: () => void
  onJoin: () => void
  onBack: () => void
}

export function MultiplayerHub({ connected, onCreate, onJoin, onBack }: MultiplayerHubProps) {
  return (
    <div className="overlay-panel overlay-panel--card">
      <h2 className="overlay-panel__heading">Multiplayer</h2>
      <p className="overlay-panel__sub">
        {connected ? 'Create or join a room — up to 8 players' : 'Connecting to server…'}
      </p>
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
