import type { ReactNode } from 'react'
import type { LatLng } from '../globe'

export interface DiscoveryInfo {
  name: string
  /** e.g. "City · Japan" or "River · South America" */
  subtitle: string
  location: LatLng
  fact?: string
}

function formatLatLng({ lat, lng }: LatLng): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`
}

interface DiscoveryCardProps {
  info: DiscoveryInfo
  found: boolean
  /** Stats row (time, points…). */
  stats?: Array<{ label: string; value: string }>
  children?: ReactNode
  footer?: ReactNode
}

/** The "you found it" card: place, region, coordinates, one verified fact, stats. */
export function DiscoveryCard({ info, found, stats, children, footer }: DiscoveryCardProps) {
  return (
    <section className={`discovery-card ${found ? 'is-found' : 'is-missed'}`} aria-live="polite">
      <p className="discovery-card__banner">{found ? 'Discovered' : 'Time’s up — here it is'}</p>
      <h2 className="discovery-card__name">{info.name}</h2>
      <p className="discovery-card__subtitle">{info.subtitle}</p>
      <p className="discovery-card__coords">{formatLatLng(info.location)}</p>
      {info.fact ? <p className="discovery-card__fact">{info.fact}</p> : null}
      {stats && stats.length ? (
        <dl className="discovery-card__stats">
          {stats.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
      {footer ? <div className="discovery-card__footer">{footer}</div> : null}
    </section>
  )
}
