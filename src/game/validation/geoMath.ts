import { haversineKm, type LatLng } from '../../globe'

/** Ray-casting point-in-polygon for a single ring (lon/lat degrees). */
export function pointInRing(point: LatLng, ring: number[][]): boolean {
  const x = point.lng
  const y = point.lat
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!
    const yi = ring[i]![1]!
    const xj = ring[j]![0]!
    const yj = ring[j]![1]!

    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersects) inside = !inside
  }

  return inside
}

export function pointInPolygon(point: LatLng, polygon: number[][][]): boolean {
  if (!polygon.length) return false
  if (!pointInRing(point, polygon[0]!)) return false
  // Holes
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(point, polygon[i]!)) return false
  }
  return true
}

export function pointInMultiPolygon(point: LatLng, multi: number[][][][]): boolean {
  return multi.some((poly) => pointInPolygon(point, poly))
}

/** Minimum great-circle distance from a point to a polyline (km). */
export function distanceToPathKm(point: LatLng, path: LatLng[]): number {
  if (path.length === 0) return Infinity
  if (path.length === 1) return haversineKm(point, path[0]!)

  let min = Infinity
  for (let i = 0; i < path.length - 1; i++) {
    min = Math.min(min, distanceToSegmentKm(point, path[i]!, path[i + 1]!))
  }
  return min
}

function distanceToSegmentKm(p: LatLng, a: LatLng, b: LatLng): number {
  // Approximate on local tangent plane for short segments
  const samples = 8
  let min = Infinity
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const q: LatLng = {
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + shortestLngDelta(a.lng, b.lng) * t,
    }
    // Normalize lng
    q.lng = ((((q.lng + 180) % 360) + 360) % 360) - 180
    min = Math.min(min, haversineKm(p, q))
  }
  return min
}

function shortestLngDelta(from: number, to: number): number {
  return ((((to - from + 540) % 360) + 360) % 360) - 180
}
