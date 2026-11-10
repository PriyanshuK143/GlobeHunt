import { useEffect, useRef, type AnimationEvent } from 'react'
import './studioIntro.css'

/** Small squares that drift in around the controller, then converge into the mark. */
const FRAGMENTS: Array<{ x: number; y: number; s: number }> = [
  { x: 44, y: 22, s: 6 },
  { x: 62, y: 10, s: 5 },
  { x: 154, y: 18, s: 5 },
  { x: 30, y: 98, s: 5 },
  { x: 172, y: 110, s: 6 },
]
const CENTER = { x: 100, y: 70 }

/** Longest the intro may stay up, even if animation events never arrive. */
const SAFETY_MS = 6500

/**
 * Escape Matrix Studio intro (exactly 5 s): terminal cursor → tagline + progress →
 * controller outline → EM mark → wordmark, then a fade into the site.
 *
 * Purely declarative: every step is a CSS animation on transform / opacity /
 * stroke-dashoffset, so there is no JavaScript animation loop. `onDone` fires
 * once, when the final fade-out ends.
 */
export function StudioIntro({ onDone }: { onDone: () => void }) {
  const finished = useRef(false)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  const finish = () => {
    if (finished.current) return
    finished.current = true
    doneRef.current()
  }

  useEffect(() => {
    const timer = window.setTimeout(finish, SAFETY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  const onAnimationEnd = (e: AnimationEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.animationName === 'em-out') finish()
  }

  return (
    <div className="em-intro" role="img" aria-label="Escape Matrix Studio" onAnimationEnd={onAnimationEnd}>
      <div className="em-intro__stage" aria-hidden="true">
        <p className="em-term em-term--cursor">
          &gt;<span className="em-caret">_</span>
        </p>

        <div className="em-term em-term--tag">
          <p className="em-line em-line--1">&gt; ESCAPE</p>
          <p className="em-line em-line--2">THE ORDINARY...</p>
          <div className="em-bar">
            <div className="em-bar__fill" />
          </div>
        </div>

        <div className="em-art">
          <svg viewBox="0 0 200 140" fill="none">
            <g className="em-pad" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <path pathLength={1} d="M62 32H138C156 32 166 40 171 56L181 92C186 110 176 120 164 118C154 116 148 106 140 98C134 92 128 90 120 90H80C72 90 66 92 60 98C52 106 46 116 36 118C24 120 14 110 19 92L29 56C34 40 44 32 62 32Z" />
              <path pathLength={1} d="M56 50h8v8h8v8h-8v8h-8v-8h-8v-8h8Z" />
              <path pathLength={1} d="M136 52a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M146 62a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M136 72a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M126 62a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
              <path pathLength={1} d="M77 80a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M109 80a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
            </g>
            <g className="em-frags">
              {FRAGMENTS.map((f, i) => (
                <rect
                  key={i}
                  className="em-frag"
                  x={f.x}
                  y={f.y}
                  width={f.s}
                  height={f.s}
                  style={{
                    animationDelay: `${1.95 + i * 0.06}s, 2.8s`,
                    ['--dx' as string]: `${CENTER.x - f.x - f.s / 2}px`,
                    ['--dy' as string]: `${CENTER.y - f.y - f.s / 2}px`,
                  }}
                />
              ))}
            </g>
            <g className="em-mark" strokeWidth="9" strokeLinejoin="miter" strokeLinecap="butt">
              <path pathLength={1} d="M62 106V40L100 66L138 40V106" />
              <path pathLength={1} d="M81 106V77L100 90L119 77V106" />
            </g>
          </svg>
        </div>

        <div className="em-word">
          <span className="em-word__name">ESCAPE MATRIX</span>
          <span className="em-word__sub">STUDIO</span>
        </div>
      </div>
    </div>
  )
}
