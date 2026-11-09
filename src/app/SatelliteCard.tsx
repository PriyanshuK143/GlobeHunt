import type { SatelliteSpec } from '../globe'
import { SatelliteArt } from './SatelliteArt'

/** Short, factual card for a clicked satellite (home / menu screens). */
export function SatelliteCard({ spec, onClose }: { spec: SatelliteSpec; onClose: () => void }) {
  const i = spec.info
  return (
    <section className="satellite-card" role="dialog" aria-label={spec.label}>
      <SatelliteArt id={spec.id} label={spec.label} />
      <p className="satellite-card__type">{i.type}</p>
      <h2 className="satellite-card__name">{spec.label}</h2>
      <dl className="satellite-card__facts">
        <div><dt>Operator</dt><dd>{i.operator}</dd></div>
        <div><dt>Launched</dt><dd>{i.launched}</dd></div>
        <div><dt>Orbit</dt><dd>{i.orbit}</dd></div>
      </dl>
      <p className="satellite-card__fact">{i.fact}</p>
      <p className="satellite-card__note">Orbits and sizes in this scene are not to scale.</p>
      <button type="button" className="gh-btn gh-btn--ghost" onClick={onClose}>Close</button>
    </section>
  )
}
