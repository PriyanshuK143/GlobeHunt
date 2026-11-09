import { memo } from 'react'

/**
 * Real photographs where a clearly public-domain NASA image exists (crew photos from
 * NASA's Image and Video Library). Satellites without one show no picture at all —
 * ESA (Sentinel, Galileo) and contractor imagery is not public domain.
 */
const PHOTOS: Record<string, { src: string; credit: string; nasaId: string }> = {
  iss: { src: '/images/satellites/iss.jpg', credit: 'Photo: NASA (STS-134 crew, 2011)', nasaId: 's134e010137' },
  hubble: { src: '/images/satellites/hubble.jpg', credit: 'Photo: NASA (STS-125 crew, 2009)', nasaId: 's125e006948' },
}

export const SatelliteArt = memo(function SatelliteArt({ id, label }: { id: string; label: string }) {
  const photo = PHOTOS[id]
  if (!photo) return null
  return (
    <figure className="satellite-card__art satellite-card__art--photo">
      <img src={photo.src} alt={`${label}, photographed in orbit`} width={640} height={300} loading="lazy" decoding="async" />
      <figcaption className="satellite-card__credit">{photo.credit}</figcaption>
    </figure>
  )
})
