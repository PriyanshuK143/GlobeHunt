import * as THREE from 'three'

export type SatelliteKind = 'comm' | 'observer' | 'telescope' | 'station'

export interface OrbitSpec {
  id: string
  radius: number
  /** Inclination in degrees relative to the equator. */
  inclination: number
  /** Longitude of ascending node (degrees). */
  node: number
  color: string
  /** Ring line opacity per mode. */
  showcaseOpacity: number
  gameplayOpacity: number
  /** Drawn even in the reduced effects level. */
  essential: boolean
}

export interface SatelliteInfo {
  /** e.g. "Crewed space station". */
  type: string
  operator: string
  launched: string
  /** Real orbit (the scene is not to scale). */
  orbit: string
  fact: string
}

export interface SatelliteSpec {
  id: string
  label: string
  kind: SatelliteKind
  orbit: string
  /** Initial phase (0..1 of a revolution). */
  phase: number
  /** Seconds per revolution (ambient time, not real time). */
  period: number
  scale: number
  essential: boolean
  info: SatelliteInfo
}

/** Thin luminous orbit paths. Few enough that continents stay clear. */
export const ORBITS: OrbitSpec[] = [
  { id: 'leo', radius: 1.34, inclination: 51.6, node: 25, color: '#62d8ff', showcaseOpacity: 0.42, gameplayOpacity: 0.1, essential: true },
  { id: 'polar', radius: 1.58, inclination: 97.5, node: -55, color: '#5eead4', showcaseOpacity: 0.32, gameplayOpacity: 0.08, essential: false },
  { id: 'meo', radius: 2.02, inclination: 28, node: 140, color: '#7aa8ff', showcaseOpacity: 0.3, gameplayOpacity: 0.07, essential: true },
  // High, steep orbit that sweeps through the foreground of the home camera.
  { id: 'high', radius: 3.05, inclination: 64, node: 205, color: '#9bc4ff', showcaseOpacity: 0.16, gameplayOpacity: 0, essential: false },
]

/** Real spacecraft, placed on stylised orbits (distances and sizes are not to scale). */
export const SATELLITES: SatelliteSpec[] = [
  {
    id: 'iss', label: 'International Space Station', kind: 'station', orbit: 'leo', phase: 0.1, period: 80, scale: 1.25, essential: true,
    info: { type: 'Crewed space station', operator: 'NASA, Roscosmos, ESA, JAXA, CSA', launched: '1998 (first module)', orbit: 'Low Earth orbit, ~400 km', fact: 'Continuously crewed since November 2000; it circles Earth about every 90 minutes.' },
  },
  {
    id: 'hubble', label: 'Hubble Space Telescope', kind: 'telescope', orbit: 'leo', phase: 0.6, period: 80, scale: 1, essential: false,
    info: { type: 'Space telescope', operator: 'NASA / ESA', launched: '1990', orbit: 'Low Earth orbit, ~540 km', fact: 'Observes in ultraviolet, visible and near-infrared light from above the atmosphere.' },
  },
  {
    id: 'landsat9', label: 'Landsat 9', kind: 'observer', orbit: 'polar', phase: 0.35, period: 96, scale: 1.1, essential: true,
    info: { type: 'Earth-observation satellite', operator: 'NASA / USGS', launched: '2021', orbit: 'Sun-synchronous, ~705 km', fact: 'Continues the Landsat record of Earth’s land surface that began in 1972.' },
  },
  {
    id: 'sentinel2a', label: 'Sentinel-2A', kind: 'observer', orbit: 'polar', phase: 0.85, period: 96, scale: 0.9, essential: false,
    info: { type: 'Earth-observation satellite', operator: 'ESA (Copernicus)', launched: '2015', orbit: 'Sun-synchronous, ~786 km', fact: 'Captures multispectral images of land and coastal areas for the EU’s Copernicus programme.' },
  },
  {
    id: 'gps3', label: 'GPS III', kind: 'comm', orbit: 'meo', phase: 0.2, period: 150, scale: 1.3, essential: true,
    info: { type: 'Navigation satellite', operator: 'U.S. Space Force', launched: '2018 (first GPS III)', orbit: 'Medium Earth orbit, ~20,200 km', fact: 'Part of the constellation that provides the Global Positioning System.' },
  },
  {
    id: 'galileo', label: 'Galileo', kind: 'comm', orbit: 'meo', phase: 0.7, period: 150, scale: 1.1, essential: false,
    info: { type: 'Navigation satellite', operator: 'European Union / ESA', launched: '2011 (first satellites)', orbit: 'Medium Earth orbit, ~23,200 km', fact: 'Europe’s global satellite navigation system.' },
  },
  {
    id: 'goes16', label: 'GOES-16', kind: 'comm', orbit: 'high', phase: 0.05, period: 210, scale: 1.6, essential: false,
    info: { type: 'Weather satellite', operator: 'NOAA / NASA', launched: '2016', orbit: 'Geostationary, ~35,786 km', fact: 'Watches weather over the Americas from a fixed point above the equator.' },
  },
]

/** Rotation that takes the orbit's base XZ circle into its inclined plane. */
export function orbitQuaternion(spec: OrbitSpec): THREE.Quaternion {
  const tilt = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    THREE.MathUtils.degToRad(spec.inclination),
  )
  const node = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    THREE.MathUtils.degToRad(spec.node),
  )
  return node.multiply(tilt)
}

/** Position on an orbit for phase ∈ [0, 1). */
export function orbitPosition(
  radius: number,
  quat: THREE.Quaternion,
  phase: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const a = phase * Math.PI * 2
  return out.set(Math.cos(a) * radius, 0, Math.sin(a) * radius).applyQuaternion(quat)
}
