import { useEffect, useMemo, useRef, useState } from 'react'
import { audio } from '../../../audio'
import { CAST, BACK_ROW, FRONT_ROW } from './cast'
import { BUBBLES, STORY_LENGTH, bubbleReveal, frameAt, type Frame } from './choreography'
import { INK, Kid } from './Kid'
import { Atlas, Room } from './Set'
import { FilmFX } from './FilmFX'

const FPS = 24
const VIEW_W = 1600
const VIEW_H = 900

/** Visible region (stage units). Wide screens show the full 16:9 set; narrower ones
 *  keep the whole circle of friends (x 300–1300) and gain height instead. */
export interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}
function viewBoxFor(aspect: number): ViewBox {
  if (aspect >= VIEW_W / VIEW_H) return { x: 0, y: 0, w: VIEW_W, h: VIEW_H }
  if (aspect >= 1000 / VIEW_H) {
    const w = VIEW_H * aspect
    return { x: VIEW_W / 2 - w / 2, y: 0, w, h: VIEW_H }
  }
  const h = 1000 / aspect
  return { x: 300, y: VIEW_H / 2 - h / 2, w: 1000, h }
}

interface StoryPlayerProps {
  onFinished: () => void
  reducedMotion: boolean
}

/** Screen-space position of a world point under the current camera. */
function toScreen(frame: Frame, x: number, y: number) {
  const { camera } = frame
  return { x: (x - camera.x) * camera.zoom + VIEW_W / 2, y: (y - camera.y) * camera.zoom + VIEW_H / 2 }
}

function SpeechBubble({ frame, t, index, vb }: { frame: Frame; t: number; index: number; vb: ViewBox }) {
  const b = BUBBLES[index]
  const r = bubbleReveal(b, t)
  if (r.opacity <= 0) return null
  const kid = CAST[b.speaker]
  const pose = frame.poses[b.speaker]
  const lift = kid.view === 'back' ? -pose.forward : pose.forward
  const head = toScreen(frame, kid.x, kid.y + (-232 + lift) * kid.scale)
  // Larger lettering on narrow/portrait screens so bubbles stay readable.
  const fs = vb.w < 1200 ? 42 : 34
  const w = Math.max(170, b.text.length * fs * 0.46 + 56)
  const h = fs * 2.15
  const side = kid.x < 800 ? -1 : 1
  let cx = head.x + side * (w * 0.32)
  let cy = head.y - 92
  cx = Math.max(vb.x + w / 2 + 24, Math.min(vb.x + vb.w - w / 2 - 24, cx))
  cy = Math.max(vb.y + h / 2 + 24, cy)
  const tailX = Math.max(cx - w / 2 + 30, Math.min(cx + w / 2 - 30, head.x))
  const text = b.text.slice(0, Math.max(0, r.chars))
  return (
    <g opacity={r.opacity} transform={`translate(${cx} ${cy}) scale(${r.scale}) translate(${-cx} ${-cy})`}>
      <path
        d={`M${cx - w / 2 + 18},${cy - h / 2}
            Q${cx},${cy - h / 2 - 6} ${cx + w / 2 - 18},${cy - h / 2}
            Q${cx + w / 2 + 4},${cy - h / 2 + 2} ${cx + w / 2},${cy}
            Q${cx + w / 2 + 2},${cy + h / 2 - 2} ${cx + w / 2 - 18},${cy + h / 2}
            L${tailX + 16},${cy + h / 2}
            L${(tailX + head.x) / 2},${head.y - 14}
            L${tailX - 6},${cy + h / 2}
            L${cx - w / 2 + 18},${cy + h / 2}
            Q${cx - w / 2 - 3},${cy + h / 2 - 2} ${cx - w / 2},${cy}
            Q${cx - w / 2 - 2},${cy - h / 2 + 3} ${cx - w / 2 + 18},${cy - h / 2} Z`}
        fill="#f6e8c6"
        stroke={INK}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      <text x={cx} y={cy + fs * 0.32} textAnchor="middle" fontFamily="'Patrick Hand', 'Comic Sans MS', cursive" fontSize={fs} fill={INK}>
        {text}
      </text>
    </g>
  )
}

function Countdown({ frame, vb }: { frame: Frame; vb: ViewBox }) {
  const c = frame.countdown
  if (c.visible <= 0) return null
  // Sits on the rug between the two front friends — never over a face or the atlas.
  const x = VIEW_W / 2
  const y = Math.min(vb.y + vb.h, VIEW_H) - 150
  return (
    <g opacity={c.visible}>
      <path
        d={`M${x - 52},${y} C${x - 54},${y - 56} ${x + 50},${y - 60} ${x + 54},${y - 4} C${x + 58},${y + 50} ${x - 40},${y + 60} ${x - 54},${y + 8} C${x - 56},${y - 10} ${x - 40},${y - 40} ${x - 20},${y - 50}`}
        fill="rgba(246, 232, 198, 0.82)"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <text x={x} y={y + 22} textAnchor="middle" fontFamily="'Patrick Hand', cursive" fontSize={c.value === null ? 70 : 62} fill={c.value === null ? '#a4441a' : INK}>
        {c.value === null ? '✓' : c.value}
      </text>
      <text x={x} y={y + 86} textAnchor="middle" fontFamily="'Patrick Hand', cursive" fontSize={26} fill={INK}>
        {c.value === null ? 'found!' : 'seconds'}
      </text>
    </g>
  )
}

/**
 * The childhood flashback: a hand-animated SVG short (24 fps, "on twos" feel) with a
 * vintage film treatment. All dialogue is visual — speech bubbles only, no voices.
 */
export function StoryPlayer({ onFinished, reducedMotion }: StoryPlayerProps) {
  const [t, setT] = useState(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const [aspect, setAspect] = useState(16 / 9)
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setAspect(e.contentRect.width / Math.max(1, e.contentRect.height)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const vb = viewBoxFor(aspect)
  const startRef = useRef<number | null>(null)
  const finishedRef = useRef(false)
  const boilRef = useRef<SVGFETurbulenceElement>(null)
  const lastCount = useRef<number | null>(null)
  const lastT = useRef(0)

  useEffect(() => {
    let raf = 0
    let lastFrame = -1
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (startRef.current === null) startRef.current = now
      const time = (now - startRef.current) / 1000
      const frameIndex = Math.floor(time * FPS)
      if (frameIndex === lastFrame) return
      lastFrame = frameIndex
      setT(frameIndex / FPS)
      // "Line boil": redraw the ink wobble a few times a second like hand-drawn frames.
      if (boilRef.current && frameIndex % 3 === 0) boilRef.current.setAttribute('seed', String((frameIndex / 3) % 7))
      if (time >= STORY_LENGTH && !finishedRef.current) {
        finishedRef.current = true
        onFinished()
      }
    }
    raf = requestAnimationFrame(loop)
    // Dev-only: jump to a moment of the story (QA of individual scenes).
    const w = window as unknown as { __HOWTO_SEEK__?: (sec: number) => void }
    if (import.meta.env.DEV) w.__HOWTO_SEEK__ = (sec) => (startRef.current = performance.now() - sec * 1000)
    return () => {
      cancelAnimationFrame(raf)
      if (import.meta.env.DEV) delete w.__HOWTO_SEEK__
    }
  }, [onFinished])

  const frame = useMemo(() => frameAt(t), [t])

  // Subtle sound cues (no voices): page turn, countdown ticks, the discovery chime.
  useEffect(() => {
    const prev = lastT.current
    lastT.current = t
    const crossed = (at: number) => prev < at && t >= at && t - prev < 1
    if (crossed(3.6)) audio.play('memory') // the photo comes alive: into the memory
    if (crossed(7.4)) audio.play('adjust')
    if (crossed(10.4) || crossed(33.4)) audio.play('schoolBell') // "Find Brazil!" / "your turn!"
    const v = frame.countdown.visible > 0.5 ? frame.countdown.value : null
    if (v !== lastCount.current) {
      if (v !== null && lastCount.current !== null) audio.play('tick')
      if (v === null && lastCount.current !== null) audio.play('pop')
      lastCount.current = v
    }
  }, [t, frame])

  const { camera, photo } = frame
  const photoScale = 0.6 + 0.4 * (1 - photo)
  const photoRot = -3.5 * photo
  const world = `translate(${VIEW_W / 2} ${VIEW_H / 2}) scale(${camera.zoom}) translate(${-camera.x} ${-camera.y})`
  const photoT = `translate(${VIEW_W / 2} ${VIEW_H / 2 - 30 * photo}) rotate(${photoRot}) scale(${photoScale}) translate(${-VIEW_W / 2} ${-VIEW_H / 2})`

  return (
    <div ref={stageRef} className={`story-stage ${reducedMotion ? '' : 'is-flicker'}`}>
      <svg className="story-svg" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Animated memory: five school friends play a map-finding game with an atlas.">
        <defs>
          <filter id="ink-boil" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence ref={boilRef} type="fractalNoise" baseFrequency="0.035" numOctaves={1} seed={1} />
            <feDisplacementMap in="SourceGraphic" scale={reducedMotion ? 0 : 3.2} />
          </filter>
          <clipPath id="photo-clip">
            <rect x={-400} y={-1200} width={2400} height={3300} />
          </clipPath>
          <radialGradient id="gold-glow" cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="#fff2c4" />
            <stop offset="60%" stopColor="#f0c873" />
            <stop offset="100%" stopColor="#b9853c" />
          </radialGradient>
        </defs>

        {/* album page behind the photograph */}
        <rect x={vb.x - 10} y={vb.y - 10} width={vb.w + 20} height={vb.h + 20} fill="#5a3a1e" />
        <g transform={photoT}>
          {photo > 0.01 ? (
            <g opacity={Math.min(1, photo * 1.6)}>
              <rect x={-46} y={-46} width={VIEW_W + 92} height={VIEW_H + 150} fill="rgba(20,10,0,0.45)" transform="translate(18 22)" />
              <rect x={-46} y={-46} width={VIEW_W + 92} height={VIEW_H + 150} fill="#efe1bf" />
              <rect x={VIEW_W / 2 - 360} y={-80} width={180} height={64} fill="rgba(235,220,170,0.75)" transform="rotate(-6 640 -50)" />
              <rect x={VIEW_W / 2 + 200} y={-74} width={180} height={64} fill="rgba(235,220,170,0.75)" transform="rotate(5 1000 -40)" />
              <text x={VIEW_W / 2} y={VIEW_H + 76} textAnchor="middle" fontFamily="'Patrick Hand', cursive" fontSize={54} fill="#5a3a1e">
                Class 5 · Geography period
              </text>
            </g>
          ) : null}
          <g clipPath="url(#photo-clip)">
            <g transform={world} filter="url(#ink-boil)">
              <Room />
              {BACK_ROW.map((id) => (
                <g key={`${id}-legs`} transform={`translate(${CAST[id].x} ${CAST[id].y}) scale(${CAST[id].scale})`}>
                  <Kid look={CAST[id]} pose={frame.poses[id]} layer="body" />
                </g>
              ))}
              <Atlas open={frame.atlasOpen} brazilGlow={frame.brazilGlow} wrongMark={frame.wrongMark} />
              {BACK_ROW.map((id) => (
                <g key={`${id}-upper`} transform={`translate(${CAST[id].x} ${CAST[id].y}) scale(${CAST[id].scale})`}>
                  <Kid look={CAST[id]} pose={frame.poses[id]} layer="arms" />
                </g>
              ))}
              {FRONT_ROW.map((id) => (
                <g key={id} transform={`translate(${CAST[id].x} ${CAST[id].y}) scale(${CAST[id].scale})`}>
                  <Kid look={CAST[id]} pose={frame.poses[id]} />
                </g>
              ))}
            </g>
            {/* faded-photo wash that lifts as the memory comes alive */}
            <rect x={-400} y={-1200} width={2400} height={3300} fill="#e8d3a6" opacity={0.45 * photo} />
          </g>
        </g>

        {/* screen-space storytelling layer */}
        <g filter="url(#ink-boil)">
          {BUBBLES.map((_, i) => (
            <SpeechBubble key={i} frame={frame} t={t} index={i} vb={vb} />
          ))}
          <Countdown frame={frame} vb={vb} />
        </g>

        <rect x={vb.x - 10} y={vb.y - 10} width={vb.w + 20} height={vb.h + 20} fill="url(#gold-glow)" opacity={frame.gold * 0.92} />
        {frame.captions.map((c) =>
          c.opacity > 0 ? (
            <text
              key={c.id}
              x={VIEW_W / 2}
              y={
                c.id === 'c1'
                  ? Math.min(vb.y + vb.h - 70, VIEW_H + 130)
                  : c.id === 'c2'
                    ? Math.max(vb.y, 0) + 120
                    : c.kind === 'title'
                      ? VIEW_H / 2 + 70
                      : VIEW_H / 2 - 40
              }
              textAnchor="middle"
              opacity={c.opacity}
              fontFamily={c.kind === 'title' ? "'Orbitron', sans-serif" : "'Patrick Hand', cursive"}
              fontSize={(c.kind === 'title' ? 96 : 60) * Math.min(1, vb.w / 1250)}
              letterSpacing={(c.kind === 'title' ? 18 : 1) * Math.min(1, vb.w / 1250)}
              fill={c.id === 'c1' || c.id === 'c2' ? '#f3e2bb' : '#4a2c12'}
              stroke={c.id === 'c1' || c.id === 'c2' ? '#3b2412' : 'none'}
              strokeWidth={c.id === 'c1' || c.id === 'c2' ? 1.4 : 0}
              paintOrder="stroke"
            >
              {c.text}
            </text>
          ) : null,
        )}
      </svg>
      <FilmFX animate={!reducedMotion} />
    </div>
  )
}
