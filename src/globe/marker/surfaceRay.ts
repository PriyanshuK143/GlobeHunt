import * as THREE from 'three'
import { EARTH_RADIUS } from '../navigation/geo'

const _closest = new THREE.Vector3()
const _origin = new THREE.Vector3()
const _camDir = new THREE.Vector3()
const _perp = new THREE.Vector3()

/**
 * Exact ray ↔ Earth-sphere intersection (nearest hit). When the ray misses the globe
 * (pointer dragged past the limb), returns the horizon point closest to the ray, so a
 * dragged marker slides along the visible edge instead of jumping or leaving the surface.
 */
export function raySurfacePoint(ray: THREE.Ray, out = new THREE.Vector3()): THREE.Vector3 {
  const o = ray.origin
  const d = ray.direction
  const b = o.dot(d)
  const c = o.lengthSq() - EARTH_RADIUS * EARTH_RADIUS
  const disc = b * b - c
  if (disc >= 0) {
    const t = -b - Math.sqrt(disc)
    if (t > 0) return out.copy(d).multiplyScalar(t).add(o)
  }
  // Miss: clamp to the visible horizon in the direction the pointer went off-globe.
  ray.closestPointToPoint(_origin, _closest)
  _camDir.copy(o).normalize()
  _perp.copy(_closest).addScaledVector(_camDir, -_closest.dot(_camDir))
  if (_perp.lengthSq() < 1e-10) return out.copy(_camDir).multiplyScalar(EARTH_RADIUS)
  _perp.normalize()
  const horizon = Math.acos(Math.min(1, EARTH_RADIUS / o.length())) * 0.985
  return out
    .copy(_camDir)
    .multiplyScalar(Math.cos(horizon))
    .addScaledVector(_perp, Math.sin(horizon))
    .multiplyScalar(EARTH_RADIUS)
}
