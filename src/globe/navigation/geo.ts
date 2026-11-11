import * as THREE from 'three'

/** Earth radius used by the globe mesh (Three.js units). */
export const EARTH_RADIUS = 1

export interface LatLng {
  lat: number
  lng: number
}

export interface CameraTarget extends LatLng {
  /** Distance from Earth center. Defaults to a comfortable mid zoom. */
  altitude?: number
}

/**
 * Convert geographic coordinates to a point on (or above) the unit sphere.
 * Convention: lat ∈ [-90, 90], lng ∈ [-180, 180], Y-up, longitude 0 on +X.
 */
export function latLngToVector3(
  lat: number,
  lng: number,
  radius: number = EARTH_RADIUS,
): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat)
  const theta = THREE.MathUtils.degToRad(lng + 180)

  const x = -radius * Math.sin(phi) * Math.cos(theta)
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)

  return new THREE.Vector3(x, y, z)
}

/** Inverse of latLngToVector3 for a direction from the Earth center. */
export function vector3ToLatLng(position: THREE.Vector3): LatLng {
  const radius = position.length() || 1
  const lat = 90 - THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(position.y / radius, -1, 1)))
  const lng =
    THREE.MathUtils.radToDeg(Math.atan2(position.z, -position.x)) - 180
  // Normalize longitude to [-180, 180]
  const normalizedLng = ((((lng + 180) % 360) + 360) % 360) - 180
  return { lat, lng: normalizedLng }
}

export const DEFAULT_FLY_ALTITUDE = 2.6
/** Far pull-back used by the home → menu cinematic. */
export const HOME_CAMERA_ALTITUDE = 4.35
/** Menu framing after the Fly animation. */
export const MENU_CAMERA_ALTITUDE = 2.55
/**
 * Closest zoom (~510 km altitude). NASA Blue Marble tiles top out at ~490 m/px, so
 * this is about where imagery stops getting sharper; labels go down to villages here.
 */
export const MIN_CAMERA_DISTANCE = 1.08
export const MAX_CAMERA_DISTANCE = 4.5

/** Vertical field of view on desktop, landscape and tablets. */
export const BASE_CAMERA_FOV = 42
/** Narrowest horizontal field of view allowed on portrait phones. */
const MIN_HORIZONTAL_FOV = 34

/**
 * Vertical FOV for a viewport aspect (width / height). A fixed 42° vertical FOV turns
 * into a ~20° telephoto horizontally on a portrait phone, so the globe overflows both
 * screen edges. Tall screens widen the vertical FOV just enough to keep ~34° across;
 * landscape and desktop keep exactly 42° (portrait tablets ≈ 42–44°).
 */
export function cameraFovForAspect(aspect: number): number {
  if (!(aspect > 0)) return BASE_CAMERA_FOV
  const halfH = THREE.MathUtils.degToRad(MIN_HORIZONTAL_FOV / 2)
  const vertical = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(halfH) / aspect))
  return THREE.MathUtils.clamp(vertical, BASE_CAMERA_FOV, 70)
}

const EARTH_RADIUS_KM = 6371

/** Great-circle distance in kilometers. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}
