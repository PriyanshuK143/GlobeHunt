import { useEffect, useState } from 'react'
import { SATELLITES, subsolarPoint } from '../../globe'

function formatCoord(value: number, pos: string, neg: string): string {
  return `${Math.abs(value).toFixed(1)}°${value >= 0 ? pos : neg}`
}

function useClock(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/** Samples frame cadence without causing per-frame React renders. */
function useLiveFps(enabled: boolean): number | null {
  const [fps, setFps] = useState<number | null>(null)
  useEffect(() => {
    if (!enabled) {
      setFps(null)
      return
    }
    let frame = 0
    let began = performance.now()
    let raf = 0
    const tick = (now: number) => {
      frame++
      const elapsed = now - began
      if (elapsed >= 750) {
        setFps(Math.round((frame * 1000) / elapsed))
        frame = 0
        began = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [enabled])
  return fps
}

/** Real round-trip to the game server; a dash means the server is temporarily unavailable. */
function useServerPing(enabled: boolean): number | null {
  const [ping, setPing] = useState<number | null>(null)
  useEffect(() => {
    if (!enabled) {
      setPing(null)
      return
    }
    let cancelled = false
    let timer: number | undefined
    const base = (import.meta.env.VITE_SERVER_URL as string | undefined)?.replace(/\/$/, '') ?? ''
    const probe = async () => {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 3_000)
      const began = performance.now()
      try {
        const response = await fetch(`${base}/health`, { cache: 'no-store', signal: controller.signal })
        if (!cancelled) setPing(response.ok ? Math.round(performance.now() - began) : null)
      } catch {
        if (!cancelled) setPing(null)
      } finally {
        window.clearTimeout(timeout)
        if (!cancelled) timer = window.setTimeout(probe, 5_000)
      }
    }
    void probe()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [enabled])
  return ping
}

const TRACKED = SATELLITES.filter((s) => s.essential)

/** Small Orion-like constellation glyph. */
function Constellation() {
  const stars: Array<[number, number, number]> = [
    [10, 8, 1.6], [34, 12, 1.3], [18, 30, 1], [22, 31, 1], [26, 32, 1], [8, 52, 1.4], [36, 50, 1.7],
  ]
  return (
    <svg className="space-corner__constellation" viewBox="0 0 44 60" aria-hidden>
      <polyline points="10,8 18,30 26,32 34,12" />
      <polyline points="18,30 8,52" />
      <polyline points="26,32 36,50" />
      {stars.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} style={{ animationDelay: `${i * 0.7}s` }} />
      ))}
    </svg>
  )
}

interface SpaceCornersProps {
  /** Gameplay shows only the clock (top-left) and FPS / ping (top-right). */
  mode: 'showcase' | 'gameplay'
  showTracking: boolean
}

/**
 * Four-corner ambient telemetry: UTC time, live sub-solar point, orbital tracking,
 * and a tiny constellation. Purely decorative, never interactive.
 */
export function SpaceCorners({ mode, showTracking }: SpaceCornersProps) {
  const now = useClock()
  const sun = subsolarPoint(now)
  const time = now.toISOString().slice(11, 19)
  const date = now
    .toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .toUpperCase()
  const gameplay = mode === 'gameplay'
  const fps = useLiveFps(gameplay)
  const ping = useServerPing(gameplay)

  return (
    <div className={`space-corners ${gameplay ? 'is-gameplay' : ''}`} aria-hidden>
      {gameplay ? (
        <>
          <div className="space-corner space-corner--tl">
            <span className="space-corner__label">{time} UTC</span>
          </div>
          <div className="space-corner space-corner--tr">
            <span className="space-corner__performance">
              <b>FPS</b> {fps ?? '—'} <i aria-hidden>·</i> <b>PING</b> {ping === null ? '—' : `${ping}ms`}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="space-corner space-corner--tl">
            <span className="space-corner__label">
              <i className="space-corner__live" /> Earth · Live
            </span>
            <span className="space-corner__value">{time} UTC</span>
            <span className="space-corner__meta">{date}</span>
          </div>

          <div className="space-corner space-corner--tr">
            <span className="space-corner__label">Sun overhead</span>
            <span className="space-corner__value">
              {formatCoord(sun.lat, 'N', 'S')} · {formatCoord(sun.lng, 'E', 'W')}
            </span>
            <span className="space-corner__meta">Sub-solar point · live UTC</span>
          </div>

          {showTracking ? (
            <div className="space-corner space-corner--bl">
              <span className="space-corner__label">Orbital track</span>
              <ul className="space-corner__list">
                {TRACKED.map((s, i) => (
                  <li key={s.id}>
                    <i className="space-corner__blip" style={{ animationDelay: `${i * 0.9}s` }} />
                    {s.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Rotation + data credits live on the home / menu screens only. */}
          <div className="space-corner space-corner--br">
            <Constellation />
            <div className="space-corner__stack">
              <span className="space-corner__label">Rotation</span>
              <span className="space-corner__meta">15.04° / hour</span>
              <span className="space-corner__credit">Imagery: NASA · Map data: Natural Earth, GeoNames (CC BY 4.0)</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
