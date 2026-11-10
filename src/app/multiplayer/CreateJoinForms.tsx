interface NicknameFormProps {
  mode: 'create' | 'join'
  nickname: string
  joinCode: string
  error: string | null
  onNickname: (v: string) => void
  onCode: (v: string) => void
  onSubmit: () => void
  onBack: () => void
}

export function CreateJoinForms({
  mode,
  nickname,
  joinCode,
  error,
  onNickname,
  onCode,
  onSubmit,
  onBack,
}: NicknameFormProps) {
  return (
    <div className="overlay-panel overlay-panel--card">
      <h2 className="overlay-panel__heading">
        {mode === 'create' ? 'Create Room' : 'Join Room'}
      </h2>
      <p className="overlay-panel__sub">Session nickname only — no account needed</p>

      <label className="field">
        <span>Nickname</span>
        <input
          value={nickname}
          maxLength={16}
          placeholder="Explorer"
          autoComplete="nickname"
          enterKeyHint={mode === 'create' ? 'done' : 'next'}
          onChange={(e) => onNickname(e.target.value)}
        />
      </label>

      {mode === 'join' ? (
        <label className="field">
          <span>Room code</span>
          <input
            value={joinCode}
            inputMode="numeric"
            maxLength={4}
            placeholder="1234"
            autoComplete="one-time-code"
            enterKeyHint="go"
            onChange={(e) => onCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </label>
      ) : null}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overlay-actions">
        <button type="button" className="gh-btn gh-btn--ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="gh-btn gh-btn--primary" onClick={onSubmit}>
          {mode === 'create' ? 'Create' : 'Join'}
        </button>
      </div>
    </div>
  )
}
