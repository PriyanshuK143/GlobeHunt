import { useEffect, useState, type ReactNode } from 'react'
import { LAND_PATH } from './story/atlasSketch'

interface Step {
  title: string
  line: string
  demo: ReactNode
}

function MiniMap({ children }: { children?: ReactNode }) {
  return (
    <svg viewBox="0 0 360 180" className="demo-map" aria-hidden>
      <rect width="360" height="180" fill="#0b2346" />
      <path d={LAND_PATH} fill="#4f7a3e" stroke="#c9d8ee" strokeWidth={0.6} />
      {children}
    </svg>
  )
}

const STEPS: Step[] = [
  {
    title: 'Choose your game',
    line: 'Singleplayer to explore alone, or Multiplayer to race friends with a room code.',
    demo: (
      <div className="demo demo-choose">
        <span className="demo-btn is-primary">Singleplayer</span>
        <span className="demo-btn is-primary">Multiplayer</span>
        <span className="demo-cursor" />
      </div>
    ),
  },
  {
    title: 'Set your challenge',
    line: 'Pick difficulty, rounds (or a custom count), the timer, and whether place names show on the map.',
    demo: (
      <div className="demo demo-config">
        <div className="demo-chips">
          {['Simple', 'Medium', 'Hard', 'Expert'].map((d, i) => (
            <span key={d} className="demo-chip" style={{ animationDelay: `${i * 1.2}s` }}>
              {d}
            </span>
          ))}
        </div>
        <div className="demo-chips">
          {['5', '10', '15', '20', 'Custom'].map((r) => (
            <span key={r} className="demo-pill">
              {r}
            </span>
          ))}
        </div>
        <div className="demo-toggle">
          <span>Place names</span>
          <span className="demo-switch" />
        </div>
      </div>
    ),
  },
  {
    title: 'Find the place',
    line: 'Read the target — Earth flies to the right region. Rotate and zoom to search.',
    demo: (
      <div className="demo demo-find">
        <div className="demo-card">
          <small>Medium</small>
          <strong>Rio de Janeiro</strong>
        </div>
        <div className="demo-globe">
          <div className="demo-globe__spin">
            <MiniMap />
            <MiniMap />
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Drop your target',
    line: 'Tap the globe to drop the red ring, drag it onto the spot, then press Confirm.',
    demo: (
      <div className="demo demo-place">
        <MiniMap>
          <g className="demo-reticle">
            <circle r="7" fill="none" stroke="#ff3d2e" strokeWidth="2" />
            <circle r="1.8" fill="#fff1ec" stroke="#ff3d2e" strokeWidth="1" />
          </g>
        </MiniMap>
        <span className="demo-confirm">Confirm ⏎</span>
      </div>
    ),
  },
  {
    title: 'Discover & score',
    line: 'Find it before the timer runs out. The faster you find it, the more points you earn.',
    demo: (
      <div className="demo demo-score">
        <span className="demo-timer" />
        <div className="demo-found">
          <small>Discovered</small>
          <strong>Brazil</strong>
          <em>+780</em>
        </div>
      </div>
    ),
  },
  {
    title: 'Compete with friends',
    line: 'Everyone gets the same place. The fastest finders climb the leaderboard.',
    demo: (
      <div className="demo demo-board">
        {[
          ['You', '2,340'],
          ['Meera', '2,120'],
          ['Kabir', '1,980'],
        ].map(([n, s], i) => (
          <div key={n} className={`demo-row demo-row--${i}`}>
            <span>{n}</span>
            <span>{s}</span>
          </div>
        ))}
      </div>
    ),
  },
]

interface HowToStepsProps {
  onPlay: () => void
  onReplay: () => void
  onMenu: () => void
}

/** "That game is now GLOBEHUNT": six short animated steps of the real game. */
export function HowToSteps({ onPlay, onReplay, onMenu }: HowToStepsProps) {
  const [index, setIndex] = useState(0)
  const [auto, setAuto] = useState(true)

  useEffect(() => {
    if (!auto) return
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % STEPS.length), 6500)
    return () => window.clearTimeout(id)
  }, [index, auto])

  const go = (i: number) => {
    setAuto(false)
    setIndex((i + STEPS.length) % STEPS.length)
  }
  const step = STEPS[index]

  return (
    <div className="howto-steps">
      <p className="howto-steps__kicker">How to play GLOBEHUNT</p>
      <div className="howto-steps__stage" key={index}>
        <div className="howto-steps__demo">{step.demo}</div>
        <div className="howto-steps__text">
          <span className="howto-steps__num">{String(index + 1).padStart(2, '0')}</span>
          <h2>{step.title}</h2>
          <p>{step.line}</p>
        </div>
      </div>
      <div className="howto-steps__nav">
        <button type="button" className="gh-btn gh-btn--ghost howto-steps__arrow" onClick={() => go(index - 1)} aria-label="Previous step">
          ‹
        </button>
        <div className="howto-steps__dots" role="tablist">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Step ${i + 1}: ${s.title}`}
              className={`howto-dot ${i === index ? 'is-active' : ''}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button type="button" className="gh-btn gh-btn--ghost howto-steps__arrow" onClick={() => go(index + 1)} aria-label="Next step">
          ›
        </button>
      </div>
      <div className="howto-steps__actions">
        <button type="button" className="gh-btn gh-btn--ghost" onClick={onMenu}>
          Main Menu
        </button>
        <button type="button" className="gh-btn gh-btn--ghost" onClick={onReplay}>
          Replay the memory
        </button>
        <button type="button" className="gh-btn gh-btn--primary" onClick={onPlay}>
          Play now
        </button>
      </div>
    </div>
  )
}
