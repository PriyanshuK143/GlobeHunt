import { DEFAULT_MP_CONFIG, type GameConfig, type PublicRoom } from '../../../shared/multiplayer'
import { useEffect, useRef, useState } from 'react'
import { GameSetupOptions, configSummary } from '../setup/GameSetupOptions'
import { copyText, inviteLink } from '../../multiplayer/invite'

interface LobbyPanelProps {
  room: PublicRoom
  isHost: boolean
  ready: boolean
  error: string | null
  onReady: (ready: boolean) => void
  onConfig: (patch: Partial<GameConfig>) => void
  onStart: () => void
  onLeave: () => void
}

export function LobbyPanel({
  room,
  isHost,
  ready,
  error,
  onReady,
  onConfig,
  onStart,
  onLeave,
}: LobbyPanelProps) {
  const connected = room.players.filter((p) => p.connected)
  const allReady = connected.length > 0 && connected.every((p) => p.ready)
  const canStart = isHost && allReady

  const link = inviteLink(room.code)
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle')
  const resetTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (resetTimer.current) window.clearTimeout(resetTimer.current)
  }, [])
  // Start pressed while someone isn't ready: a short, self-dismissing nudge naming them.
  const NUDGE_MS = 2000
  const [nudge, setNudge] = useState<{ key: number; text: string; ids: string[] } | null>(null)
  const nudgeTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (nudgeTimer.current) window.clearTimeout(nudgeTimer.current)
  }, [])
  const notReady = connected.filter((p) => !p.ready)
  const nudgeText = () => {
    const selfWaiting = notReady.some((p) => p.isHost)
    const others = notReady.filter((p) => !p.isHost).map((p) => p.nickname)
    if (others.length === 0) return selfWaiting ? "You're not ready yet — tap Ready first" : 'Waiting for players'
    const names = others.length === 1 ? others[0] : `${others.slice(0, -1).join(', ')} and ${others[others.length - 1]}`
    return `Waiting for ${names} to tap Ready${selfWaiting ? ' (you too)' : ''}`
  }
  const tryStart = () => {
    if (canStart) return onStart()
    setNudge({ key: Date.now(), text: nudgeText(), ids: notReady.map((p) => p.id) })
    if (nudgeTimer.current) window.clearTimeout(nudgeTimer.current)
    nudgeTimer.current = window.setTimeout(() => setNudge(null), NUDGE_MS)
  }

  const copyInvite = async () => {
    const ok = await copyText(link)
    setCopied(ok ? 'ok' : 'fail')
    if (resetTimer.current) window.clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => setCopied('idle'), 2200)
  }

  return (
    <div className="overlay-panel overlay-panel--card lobby-panel">
      <div className="lobby-code-row">
        <div>
          <p className="hud-stat__label">Room code</p>
          <p className="lobby-code">{room.code}</p>
        </div>
        <button
          type="button"
          className={`gh-btn gh-btn--ghost lobby-copy ${copied === 'ok' ? 'is-copied' : ''}`}
          onClick={() => void copyInvite()}
          aria-live="polite"
        >
          {copied === 'ok' ? 'Link copied' : copied === 'fail' ? 'Copy failed' : 'Copy invite link'}
        </button>
      </div>
      <p className="lobby-invite">
        <span className="lobby-invite__label">Same Wi-Fi? Share</span>
        <span className="lobby-invite__url" onClick={(e) => window.getSelection()?.selectAllChildren(e.currentTarget)}>
          {link}
        </span>
      </p>

      <p className="overlay-panel__sub">
        Players {connected.length}/{room.maxPlayers}
      </p>

      <ul className="player-list">
        {room.players
          .filter((p) => p.connected)
          .map((p) => (
            <li
              key={p.id + (nudge?.ids.includes(p.id) ? `-${nudge.key}` : '')}
              className={`player-list__item ${nudge?.ids.includes(p.id) ? 'is-nudged' : ''}`}
            >
              <span>
                {p.nickname}
                {p.isHost ? ' · Host' : ''}
                {!p.connected ? ' · Offline' : ''}
              </span>
              <span className={p.ready ? 'tag-ready' : 'tag-wait'}>
                {p.ready ? 'Ready' : 'Not ready'}
              </span>
            </li>
          ))}
      </ul>

      <div className="setup-panel__lobby">
        <p className="setup-panel__mode">Multiplayer · {isHost ? 'You are the host' : 'Host sets the game'}</p>
        {isHost ? (
          <GameSetupOptions config={{ ...DEFAULT_MP_CONFIG, ...room.config }} onChange={onConfig} />
        ) : (
          <p className="overlay-panel__sub">{configSummary({ ...DEFAULT_MP_CONFIG, ...room.config })}</p>
        )}
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overlay-actions lobby-actions">
        {nudge ? (
          <div key={nudge.key} className="lobby-nudge" role="status" style={{ ['--nudge-ms' as string]: `${NUDGE_MS}ms` }}>
            <span className="lobby-nudge__text">{nudge.text}</span>
            <span className="lobby-nudge__timer" aria-hidden />
          </div>
        ) : null}
        <button type="button" className="gh-btn gh-btn--ghost" onClick={onLeave}>
          Leave
        </button>
        <button
          type="button"
          className={`gh-btn ${ready ? 'gh-btn--ghost' : 'gh-btn--primary'}`}
          onClick={() => onReady(!ready)}
        >
          {ready ? 'Unready' : 'Ready'}
        </button>
        {isHost ? (
          <button
            type="button"
            className={`gh-btn gh-btn--primary lobby-start ${canStart ? '' : 'is-waiting'}`}
            aria-disabled={!canStart}
            onClick={tryStart}
          >
            Start Game
          </button>
        ) : null}
      </div>
    </div>
  )
}
