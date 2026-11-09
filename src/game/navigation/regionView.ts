import * as THREE from 'three'
import { latLngToVector3, vector3ToLatLng, type CameraTarget } from '../../globe'
import type { LocationPool } from '../../../shared/geoPool'
import type { Challenge, Difficulty } from '../types'

/** Round-start altitude per difficulty (Expert: per feature size). */
const ALTITUDE: Record<Difficulty, number> = { simple: 2.55, medium: 2.4, hard: 2.2, expert: 2.4 }
const FEATURE_ALTITUDE: Record<string, number> = {
  sea: 2.6,
  desert: 2.55,
  range: 2.55,
  island: 2.5,
  river: 2.5,
  lake: 2.3,
  mountain: 2.3,
  strait: 2.3,
}
/** Keep the target inside this fraction of the visible ground radius. */
const VISIBLE_FRACTION = 0.72

let centroids: Map<string, THREE.Vector3> | null = null

/** Centroid of every pool location in each subregion (target-independent anchors). */
function regionCentroids(pool: LocationPool): Map<string, THREE.Vector3> {
  if (centroids) return centroids
  const sums = new Map<string, THREE.Vector3>()
  for (const list of Object.values(pool.difficulties))
    for (const e of list) {
      const key = `${e.continent}|${e.region}`
      let v = sums.get(key)
      if (!v) sums.set(key, (v = new THREE.Vector3()))
      v.add(latLngToVector3(e.point[0], e.point[1], 1))
    }
  for (const v of sums.values()) v.normalize()
  centroids = sums
  return sums
}

/** Angular radius of ground visible from distance `d` (narrowest screen axis). */
function visibleGroundAngle(d: number, fovDeg = 42): number {
  const aspect = typeof window !== 'undefined' ? window.innerWidth / Math.max(1, window.innerHeight) : 1.6
  const vHalf = THREE.MathUtils.degToRad(fovDeg / 2)
  const half = aspect < 1 ? Math.atan(Math.tan(vHalf) * aspect) : vHalf
  const s = d * Math.sin(half)
  return s >= 1 ? Math.acos(1 / d) : Math.asin(s) - half
}

/**
 * Round-start camera: guided to the target's broad region, not to the target.
 * The camera looks at the centroid of the target's subregion — identical for every
 * location in that region — and only if the target would fall outside the comfortable
 * view is the camera nudged toward it, just enough to bring it on screen.
 */
export function regionalRoundView(challenge: Challenge, difficulty: Difficulty, pool: LocationPool): CameraTarget {
  const altitude = difficulty === 'expert' ? FEATURE_ALTITUDE[challenge.featureKind ?? ''] ?? ALTITUDE.expert : ALTITUDE[difficulty]
  const target = latLngToVector3(challenge.point[0], challenge.point[1], 1)
  const anchor = regionCentroids(pool).get(`${challenge.continent}|${challenge.region}`)?.clone() ?? target.clone()
  const limit = visibleGroundAngle(altitude) * VISIBLE_FRACTION
  const angle = anchor.angleTo(target)
  if (angle > limit) {
    // Rotate the anchor toward the target by the overshoot only.
    const axis = new THREE.Vector3().crossVectors(anchor, target).normalize()
    if (axis.lengthSq() > 0) anchor.applyAxisAngle(axis, angle - limit)
  }
  const { lat, lng } = vector3ToLatLng(anchor)
  return { lat, lng, altitude }
}
