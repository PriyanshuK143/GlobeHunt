import * as THREE from 'three'
import { latLngToVector3, type LatLng } from '../navigation/geo'

const MS_PER_DAY = 86_400_000
/** J2000.0 epoch (2000-01-01T12:00:00Z) in ms. */
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0)

const rad = THREE.MathUtils.degToRad
const deg = THREE.MathUtils.radToDeg

function wrap180(value: number): number {
  return ((((value + 180) % 360) + 360) % 360) - 180
}

/**
 * Approximate sub-solar point (where the Sun is directly overhead) for a UTC instant.
 * Uses the NOAA/USNO low-precision solar position formulas (accurate to ~0.1°),
 * including declination and the equation of time.
 */
export function subsolarPoint(date: Date = new Date()): LatLng {
  const d = (date.getTime() - J2000_MS) / MS_PER_DAY
  const g = rad((357.529 + 0.98560028 * d) % 360) // mean anomaly
  const q = (280.459 + 0.98564736 * d) % 360 // mean longitude (deg)
  const L = rad(q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) // ecliptic longitude
  const e = rad(23.439 - 0.00000036 * d) // obliquity

  const ra = deg(Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)))
  const declination = deg(Math.asin(Math.sin(e) * Math.sin(L)))
  const equationOfTimeDeg = wrap180(q - ra)

  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const lng = wrap180(-15 * (utcHours - 12) - equationOfTimeDeg)

  return { lat: declination, lng }
}

/** Unit vector from Earth's center toward the Sun, in globe (Earth-fixed) space. */
export function sunDirection(date: Date = new Date(), out = new THREE.Vector3()): THREE.Vector3 {
  const { lat, lng } = subsolarPoint(date)
  return out.copy(latLngToVector3(lat, lng, 1)).normalize()
}
