import { useEffect, useRef, useState } from 'react'

/**
 * Entrance: until the first click the game is shown in black & white (a desaturating
 * backdrop filter over everything). The click — which also lets the browser start the
 * music — sends colour flooding out from that exact point as a liquid, wavy, dripping
 * front with a soft glowing edge.
 *
 * The hole in the monochrome layer is a per-frame `clip-path: path(evenodd …)`; the
 * glowing edge is the same blob drawn into an SVG with turbulence displacement.
 */

const DURATION = 2200
const POINTS = 120

interface Drip {
  angle: number
  width: number
  length: number
}

function makeDrips(): Drip[] {
  const drips: Drip[] = []
  const n = 7 + Math.floor(Math.random() * 4)
  for (let i = 0; i < n; i++) {
    // Mostly downward (screen y grows down: angles around +90°), a few sideways.
    const down = Math.random() < 0.75
    drips.push({
      angle: down ? Math.PI / 2 + (Math.random() - 0.5) * 2.2 : Math.random() * Math.PI * 2,
      width: 0.05 + Math.random() * 0.08,
      length: 0.12 + Math.random() * 0.22,
    })
  }
  return drips
}

/** Blob outline around (cx, cy) with base radius r, wobble phase t (s) and drip growth. */
function blobPath(cx: number, cy: number, r: number, t: number, drips: Drip[], grow: number): string {
  let d = ''
  for (let i = 0; i <= POINTS; i++) {
    const a = (i / POINTS) * Math.PI * 2
    let k = 1 + 0.06 * Math.sin(5 * a + t * 3.1) + 0.04 * Math.sin(9 * a - t * 4.3) + 0.025 * Math.sin(17 * a + t * 6)
    for (const dr of drips) {
      let da = Math.abs(a - dr.angle) % (Math.PI * 2)
      if (da > Math.PI) da = Math.PI * 2 - da
      k += dr.length * grow * Math.exp(-((da / dr.width) ** 2))
    }
    const rr = r * k
    d += `${i === 0 ? 'M' : 'L'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`
  }
  return d + 'Z'
}

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

export function ColorReveal({ disabled, onEnter }: { disabled: boolean; onEnter: () => void }) {
  // 'mono' (waiting) → 'revealing' (ripple running) → 'done' (unmounted).
  const [phase, setPhase] = useState<'mono' | 'revealing' | 'done'>(() => (disabled ? 'done' : 'mono'))
  const didEnter = useRef(false)
  const mono = useRef<HTMLDivElement>(null)
  const edge = useRef<SVGPathElement>(null)
  const origin = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (phase !== 'done' || didEnter.current) return
    didEnter.current = true
    onEnter()
  }, [phase, onEnter])

  // First click / tap / key anywhere starts the reveal from that point.
  useEffect(() => {
    if (phase !== 'mono') return
    const start = (x: number, y: number) => {
      if (origin.current) return
      origin.current = { x, y }
      if (!didEnter.current) {
        didEnter.current = true
        onEnter()
      }
      setPhase('revealing')
    }
    const onPointer = (e: PointerEvent) => start(e.clientX, e.clientY)
    const opts = { capture: true, passive: true } as const
    window.addEventListener('pointerdown', onPointer, opts)
    return () => {
      window.removeEventListener('pointerdown', onPointer, opts)
    }
  }, [phase, onEnter])

  // The ripple itself.
  useEffect(() => {
    if (phase !== 'revealing' || !origin.current) return
    const { x, y } = origin.current
    const W = window.innerWidth
    const H = window.innerHeight
    // Far enough to cover the furthest corner even after the wobble pulls inwards.
    const maxR = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) * 1.18
    const drips = makeDrips()
    const t0 = performance.now()
    let raf = 0
    const frame = () => {
      const p = Math.min(1, (performance.now() - t0) / DURATION)
      const r = maxR * easeInOut(p)
      const blob = blobPath(x, y, Math.max(1, r), (performance.now() - t0) / 1000, drips, Math.min(1, p * 1.6))
      if (mono.current) mono.current.style.clipPath = `path(evenodd, "M0 0H${W}V${H}H0Z ${blob}")`
      if (edge.current) {
        edge.current.setAttribute('d', blob)
        edge.current.style.opacity = String(Math.min(1, p * 6) * (1 - Math.max(0, (p - 0.7) / 0.3)))
      }
      if (p < 1) raf = requestAnimationFrame(frame)
      else setPhase('done')
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  if (phase === 'done') return null
  return (
    <div className="color-reveal" aria-hidden={phase !== 'mono'}>
      <div ref={mono} className="color-reveal__mono" />
      <svg className="color-reveal__edge" width="100%" height="100%">
        <defs>
          <filter id="reveal-drip" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G" result="d" />
            <feGaussianBlur in="d" stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="d" />
            </feMerge>
          </filter>
          <linearGradient id="reveal-glow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8fe9ff" />
            <stop offset="0.5" stopColor="#c7a6ff" />
            <stop offset="1" stopColor="#5eead4" />
          </linearGradient>
        </defs>
        <path ref={edge} fill="none" stroke="url(#reveal-glow)" strokeWidth={6} strokeLinejoin="round" strokeOpacity={0.8} filter="url(#reveal-drip)" style={{ opacity: 0 }} />
      </svg>
      {phase === 'mono' ? (
        <div className="color-reveal__prompt" role="status">
          <span className="color-reveal__ring" aria-hidden />
          <span>Click anywhere to enter</span>
        </div>
      ) : null}
    </div>
  )
}
