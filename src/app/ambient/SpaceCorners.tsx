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
  /** Gameplay shows only the minimal bottom-right indicator. */
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

  return (
    <div className={`space-corners ${gameplay ? 'is-gameplay' : ''}`} aria-hidden>
      {!gameplay ? (
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
        </>
      ) : null}

      <div className="space-corner space-corner--br">
        {!gameplay ? <Constellation /> : null}
        <div className="space-corner__stack">
          <span className="space-corner__label">{gameplay ? `${time} UTC` : 'Rotation'}</span>
          <span className="space-corner__meta">
            {gameplay ? `Sun ${formatCoord(sun.lat, 'N', 'S')} ${formatCoord(sun.lng, 'E', 'W')}` : '15.04° / hour'}
          </span>
          <span className="space-corner__credit">Imagery: NASA · Map data: Natural Earth, GeoNames (CC BY 4.0)</span>
        </div>
      </div>
    </div>
  )
}
