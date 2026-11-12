import { cameraFovForAspect, type CameraTarget, type LatLng } from '../../globe'

/** Space kept clear at the top of the screen (corner readouts). */
const TOP_CLEARANCE_PX = 70

/**
 * Camera for the post-round reveal. Normally it centres the answer, but when a result
 * card covers the middle of the screen the camera looks a little south of the answer,
 * so the answer and its marker sit in the clear space above the card.
 *
 * `cardTop` is the card's top edge in px (or null if no card covers the centre).
 */
export function revealView(loc: LatLng, altitude: number, cardTop: number | null): CameraTarget {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280
  const h = typeof window !== 'undefined' ? window.innerHeight : 800
  if (cardTop === null || cardTop > h * 0.62) return { ...loc, altitude }

  // Where the answer should appear on screen, as normalised device y (+1 = top edge).
  const targetY = (Math.max(TOP_CLEARANCE_PX, 0) + Math.max(TOP_CLEARANCE_PX + 40, cardTop)) / 2
  const ndcY = 1 - (2 * targetY) / h
  if (ndcY <= 0) return { ...loc, altitude }

  // A surface point θ radians north of the view centre, seen from distance `altitude`,
  // projects to ndc y = (sin θ / (D − cos θ)) / tan(fov/2). Solve for θ by bisection.
  const t = Math.tan(((cameraFovForAspect(w / h) / 2) * Math.PI) / 180)
  const ndcAt = (theta: number) => Math.sin(theta) / (altitude - Math.cos(theta)) / t
  let lo = 0
  let hi = Math.acos(1 / altitude) * 0.9
  if (ndcAt(hi) < ndcY) return { lat: Math.max(-85, loc.lat - (hi * 180) / Math.PI), lng: loc.lng, altitude }
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (ndcAt(mid) < ndcY) lo = mid
    else hi = mid
  }
  const shift = (((lo + hi) / 2) * 180) / Math.PI
  return { lat: Math.max(-85, Math.min(85, loc.lat - shift)), lng: loc.lng, altitude }
}
