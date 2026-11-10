import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CREDIT_ATTRIBUTION, CREDIT_BLOCKS, CREDIT_INSTAGRAM } from './creditLines'
import { audio } from '../../audio'
import { CreditsSky } from './CreditsSky'
import { mulberry32 } from '../../globe/ambient/motion'

/**
 * Credits flypast: three formations fly at once, one through each row of the layout —
 *   title row → left to right, second row → right to left, third row → left to right.
 * Three jets (a lead and two wingmen) leave billowing smoke clouds; each credit fades in
 * as the smoke behind it dissolves, timed to when the jets passed it, and stays. The text
 * stays centred (the camera holds still) and pulls back to the full overview at the end.
 */

/** Seconds for the formation to cross the whole sky. */
const PASS = 4
/** Pause before the jets arrive. */
const CAMERA = 1.3
/** Delay between the jets passing a credit and its text fading in (smoke dissolving). */
const SETTLE = 2.6
/** Extra hold after the last text of a row has appeared. */
const HOLD = 2.6
/** Zoom while following the formation (1 = full overview). */
const ZOOM = 1.08
/** Jets fly between -8% and 108% of the sky's width. */
const EDGE_L = -8
const EDGE_R = 108
const SPAN = EDGE_R - EDGE_L

/** Rows of block indices and the direction the formation flies through them. */
const ROWS: Array<{ blocks: number[]; dir: 1 | -1 }> = [
  { blocks: [0], dir: 1 },
  { blocks: [1, 2], dir: -1 },
  { blocks: [3, 4], dir: 1 },
]

interface Props {
  reducedMotion: boolean
  skipToken: number
  onComplete: () => void
  onLine: (index: number) => void
}

function Jet() {
  // Original side-view fighter silhouette, nose pointing right.
  return (
    <svg className="flypast-jet__svg" viewBox="0 0 64 24" aria-hidden>
      <path d="M2 13 L14 11 L22 4 L27 4 L24 11 L44 10.5 Q58 11 62 12.5 Q58 14 44 14.5 L24 14 L27 21 L22 21 L14 14 Z" fill="#a9b8cd" stroke="#3a4a63" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M44 10.6 Q52 9 56 11.4 Q52 12 44 12.2 Z" fill="#2b3a52" />
      <path d="M4 12 L0 10.5 L0 15.5 L4 14 Z" fill="#ffb35c" opacity="0.85" />
    </svg>
  )
}

/** Seconds (from the start of the pass) until the formation reaches x% of the sky. */
const reach = (xPct: number, dir: 1 | -1) => ((dir === 1 ? xPct - EDGE_L : EDGE_R - xPct) / SPAN) * PASS

interface Puff {
  x: number
  y: number
  size: number
  at: number
  drift: number
  life: number
}

/** Seeded, tightly overlapping soft puffs: read as one continuous billowing cloud. */
function makePuffs(seed: number): Array<Omit<Puff, 'at'> & { jitter: number }> {
  const r = mulberry32(seed)
  const puffs: Array<Omit<Puff, 'at'> & { jitter: number }> = []
  for (let x = -2; x <= 104; x += 1.15 + r() * 0.8) {
    const big = r() < 0.18
    puffs.push({
      x: x + (r() - 0.5) * 0.6,
      y: (r() - 0.5) * (big ? 14 : 9),
      size: big ? 54 + r() * 26 : 30 + r() * 24,
      jitter: r() * 0.05,
      drift: (r() - 0.5) * 22,
      life: 3.6 + r() * 1.6,
    })
  }
  return puffs
}

const LANES = [
  { lane: 0, lag: 0 },
  { lane: -1, lag: 0.22 },
  { lane: 1, lag: 0.22 },
] as const

export function FormationFlypast({ reducedMotion, skipToken, onComplete, onLine }: Props) {
  // row = pass in progress; rowCount = overview.
  /** false = the flypast is running, true = full overview. */
  const [done, setDone] = useState(reducedMotion)
  const startToken = useRef(skipToken)
  const world = useRef<HTMLDivElement>(null)
  const slots = useRef<Array<HTMLDivElement | null>>([])
  const [geo, setGeo] = useState<{ W: number; H: number; x: number[]; cx: number[]; cy: number[] } | null>(null)

  const lanePuffs = useMemo(() => LANES.map((_, i) => makePuffs(101 + i * 17)), [])

  // Measure the layout (untransformed offsets) so passes and camera know where each credit is.
  useLayoutEffect(() => {
    const measure = () => {
      const w = world.current
      if (!w) return
      const W = w.clientWidth
      const H = w.clientHeight
      const cx: number[] = []
      const cy: number[] = []
      slots.current.forEach((el, i) => {
        cx[i] = el ? el.offsetLeft + el.offsetWidth / 2 : W / 2
        cy[i] = el ? el.offsetTop + el.offsetHeight / 2 : H / 2
      })
      setGeo({ W, H, x: cx.map((v) => (v / W) * 100), cx, cy })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const rowOf = (block: number) => ROWS.findIndex((r) => r.blocks.includes(block))
  const textAt = (block: number) => (geo ? CAMERA + reach(geo.x[block], ROWS[rowOf(block)].dir) + SETTLE : 0)

  // Timeline: the overview once every credit has appeared.
  useEffect(() => {
    if (!geo) return
    if (done) {
      onComplete()
      return
    }
    onLine(0)
    const lastText = Math.max(...CREDIT_BLOCKS.map((_, i) => textAt(i)))
    const id = window.setTimeout(() => setDone(true), (lastText + HOLD) * 1000)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, geo === null])

  // Air rush sweeping across with the formations.
  useEffect(() => {
    if (done) return
    const dir = 1
    let raf = 0
    let started = false
    const t0 = performance.now() + CAMERA * 1000
    const tick = () => {
      const k = (performance.now() - t0) / 1000 / PASS
      if (k >= 0 && !started) {
        started = true
        audio.startAircraft()
      }
      if (k >= 1.05) {
        audio.stopAircraft()
        return
      }
      if (started) audio.updateAircraft(dir * (-1 + 2 * k), 0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, k)), true)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      audio.stopAircraft()
    }
  }, [done])

  useEffect(() => {
    if (skipToken === startToken.current) return
    setDone(true)
  }, [skipToken])

  // Camera: holds still, gently zoomed on the centred layout; pulls back for the overview.
  let camera = { x: 0, y: 0, s: 1 }
  if (geo && !done) {
    const s = ZOOM
    camera = { x: (geo.W / 2) * (1 - s), y: (geo.H / 2) * (1 - s), s }
  }

  const renderBlock = (i: number) => {
    const b = CREDIT_BLOCKS[i]
    const state = done ? 'is-shown' : 'is-writing'
    return (
      <div
        key={b.id}
        ref={(el) => {
          slots.current[i] = el
        }}
        className={`flypast-slot ${state}`}
        style={!done ? { ['--text-at' as string]: `${textAt(i)}s` } : undefined}
      >
        {b.lines.map((l, j) => (
          <p key={j} className="flypast-line" style={{ ['--size' as string]: l.size ?? 1, ['--i' as string]: j }}>
            {l.text}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="flypast" style={{ ['--pass' as string]: `${PASS}s`, ['--camera' as string]: `${CAMERA}s` }}>
      <CreditsSky reducedMotion={reducedMotion} calm={done} />

      <div
        ref={world}
        className={`flypast-world ${done ? 'is-overview' : ''}`}
        style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.s})` }}
      >
        <div className="flypast-layout">
          <div className="flypast-title">{renderBlock(0)}</div>
          <div className="flypast-grid">{[1, 2, 3, 4].map(renderBlock)}</div>
          <div className="flypast-meta">
            <p className="flypast-attribution">{CREDIT_ATTRIBUTION}</p>
            <a className="flypast-social" href={CREDIT_INSTAGRAM.href} target="_blank" rel="noreferrer">
              {CREDIT_INSTAGRAM.label} <span aria-hidden="true">·</span> {CREDIT_INSTAGRAM.handle}
            </a>
          </div>
        </div>

        {geo && !done
          ? ROWS.map((current, ri) => (
          <div key={`pass-${ri}`} className={`flypast-formation ${current.dir === -1 ? 'is-reverse' : ''}`} style={{ top: geo.cy[current.blocks[0]] }} aria-hidden>
            {LANES.map((l, i) => (
              <div key={l.lane} className="flypast-lane" style={{ ['--lane' as string]: l.lane }}>
                {lanePuffs[(i + ri) % lanePuffs.length].map((p, k) => (
                  <span
                    key={k}
                    className="flypast-puff"
                    style={{
                      left: `${p.x}%`,
                      top: p.y,
                      width: p.size,
                      height: p.size,
                      marginLeft: -p.size / 2,
                      marginTop: -p.size / 2,
                      animationDelay: `${CAMERA + l.lag + reach(p.x, current.dir) + p.jitter}s`,
                      animationDuration: `${p.life}s`,
                      ['--drift' as string]: `${p.drift * current.dir}px`,
                    }}
                  />
                ))}
                <div className="flypast-jet" style={{ animationDelay: `calc(var(--camera) + ${l.lag}s)` }}>
                  <Jet />
                </div>
              </div>
            ))}
          </div>
            ))
          : null}
      </div>
    </div>
  )
}
