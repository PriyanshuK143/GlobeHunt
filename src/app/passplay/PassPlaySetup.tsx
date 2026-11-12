import { useState } from 'react'
import {
  PASS_PLAY_COLORS,
  PASS_PLAY_MAX_PLAYERS,
  PASS_PLAY_MIN_PLAYERS,
  type GameConfig,
  type PassPlayPlayer,
} from '../../game'
import { GameSetupOptions } from '../setup/GameSetupOptions'

interface PassPlaySetupProps {
  config: GameConfig
  error: string | null
  /** Players from the previous game, so "Change Players" keeps their names. */
  initialPlayers: PassPlayPlayer[]
  onConfig: (patch: Partial<GameConfig>) => void
  onStart: (players: PassPlayPlayer[]) => void
  onBack: () => void
}

const MAX_NAME = 16

function seat(i: number): PassPlayPlayer {
  return { name: '', color: PASS_PLAY_COLORS[i % PASS_PLAY_COLORS.length] }
}

/** Pass & Play setup: player count, names, colours, then the usual game options. */
export function PassPlaySetup({ config, error, initialPlayers, onConfig, onStart, onBack }: PassPlaySetupProps) {
  const [seats, setSeats] = useState<PassPlayPlayer[]>(() =>
    initialPlayers.length >= PASS_PLAY_MIN_PLAYERS ? initialPlayers : [seat(0), seat(1)],
  )
  const [problem, setProblem] = useState<string | null>(null)

  const setCount = (n: number) => {
    setProblem(null)
    setSeats((prev) => {
      if (n <= prev.length) return prev.slice(0, n)
      const next = [...prev]
      while (next.length < n) {
        // New seats take the first colour nobody is using.
        const free = PASS_PLAY_COLORS.find((c) => !next.some((p) => p.color === c)) ?? PASS_PLAY_COLORS[0]
        next.push({ name: '', color: free })
      }
      return next
    })
  }

  const update = (i: number, patch: Partial<PassPlayPlayer>) => {
    setProblem(null)
    setSeats((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  }

  /** Step to the next colour that no other player has. */
  const cycleColor = (i: number) => {
    const taken = new Set(seats.filter((_, j) => j !== i).map((p) => p.color))
    const start = PASS_PLAY_COLORS.indexOf(seats[i].color as (typeof PASS_PLAY_COLORS)[number])
    for (let k = 1; k <= PASS_PLAY_COLORS.length; k++) {
      const c = PASS_PLAY_COLORS[(start + k) % PASS_PLAY_COLORS.length]
      if (!taken.has(c)) return update(i, { color: c })
    }
  }

  const begin = () => {
    const players = seats.map((p, i) => ({ ...p, name: p.name.trim() || `Player ${i + 1}` }))
    const names = players.map((p) => p.name.toLowerCase())
    if (new Set(names).size !== names.length) {
      setProblem('Each player needs a different name.')
      return
    }
    onStart(players)
  }

  return (
    <div className="overlay-panel overlay-panel--card setup-panel">
      <p className="setup-panel__mode">Multiplayer · Pass &amp; Play</p>
      <h2 className="overlay-panel__heading">Game Setup</h2>

      <div className="setup-options">
        <fieldset className="option-group">
          <legend>Players</legend>
          <div className="option-row">
            {Array.from({ length: PASS_PLAY_MAX_PLAYERS - PASS_PLAY_MIN_PLAYERS + 1 }, (_, k) => k + PASS_PLAY_MIN_PLAYERS).map((n) => (
              <button
                key={n}
                type="button"
                className={`option-pill ${seats.length === n ? 'is-active' : ''}`}
                aria-pressed={seats.length === n}
                onClick={() => setCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <ol className="pp-seats">
            {seats.map((p, i) => (
              <li key={i} className="pp-seat">
                <button
                  type="button"
                  className="pp-swatch"
                  style={{ ['--player-color' as string]: p.color }}
                  onClick={() => cycleColor(i)}
                  aria-label={`Change colour for player ${i + 1}`}
                  title="Change colour"
                />
                <label className="field pp-seat__field">
                  <span className="sr-only">Name of player {i + 1}</span>
                  <input
                    type="text"
                    value={p.name}
                    maxLength={MAX_NAME}
                    placeholder={`Player ${i + 1}`}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => update(i, { name: e.target.value })}
                  />
                </label>
              </li>
            ))}
          </ol>
        </fieldset>

        <GameSetupOptions config={config} onChange={onConfig} />
      </div>

      {problem || error ? (
        <p className="form-error" role="alert">
          {problem ?? error}
        </p>
      ) : null}

      <div className="overlay-actions">
        <button type="button" className="gh-btn gh-btn--ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="gh-btn gh-btn--primary" onClick={begin}>
          Start Game
        </button>
      </div>
    </div>
  )
}
