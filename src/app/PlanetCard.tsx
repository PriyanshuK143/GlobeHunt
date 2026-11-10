import type { CelestialSpec } from '../globe'

/** Card for a clicked Sun / planet / Moon (home & menu screens), styled like the satellite card. */
export function PlanetCard({ spec, onClose }: { spec: CelestialSpec; onClose: () => void }) {
  return (
    <section className="satellite-card" role="dialog" aria-label={spec.label}>
      <figure className="satellite-card__art satellite-card__art--body">
        <img src={spec.photo.src} alt={spec.label} width={520} height={520} loading="lazy" decoding="async" />
        <figcaption className="satellite-card__credit">{spec.photo.credit}</figcaption>
      </figure>
      <p className="satellite-card__type">{spec.type}</p>
      <h2 className="satellite-card__name">{spec.label}</h2>
      <dl className="satellite-card__facts">
        {spec.facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="satellite-card__fact">{spec.fact}</p>
      <p className="satellite-card__note">Sizes and distances in this scene are not to scale.</p>
      <button type="button" className="gh-btn gh-btn--ghost" onClick={onClose}>Close</button>
    </section>
  )
}
