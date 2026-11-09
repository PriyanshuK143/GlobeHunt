import { latLngToVector3, type CameraTarget, type GlobeNavigationApi } from '../../globe'
import { audio } from '../../audio'

export interface TravelOptions {
  /** Upper bound for the flight (ms). */
  maxMs?: number
  minMs?: number
  reducedMotion?: boolean
  /** Play the soft travel swoosh. */
  sound?: boolean
}

let reducedMotionPref = false
/** App-wide motion preference for every travel (set from settings). */
export function setTravelReducedMotion(reduced: boolean): void {
  reducedMotionPref = reduced
}

/**
 * The single camera-transition controller for gameplay: duration scales with how far
 * around the globe we travel (≈1.5–2.8 s), new travels cancel the previous one
 * (flyTo cancels in-flight animations), and the promise always settles.
 */
export function travelTo(globe: GlobeNavigationApi | null, target: CameraTarget, opts: TravelOptions = {}): Promise<void> {
  if (!globe) return Promise.resolve()
  const view = globe.getView()
  const from = latLngToVector3(view.lat, view.lng, 1)
  const to = latLngToVector3(target.lat, target.lng, 1)
  const angle = from.angleTo(to) // 0..π
  const altChange = Math.abs((target.altitude ?? view.altitude) - view.altitude)
  const reduced = opts.reducedMotion ?? reducedMotionPref
  const minMs = opts.minMs ?? 1300
  const maxMs = opts.maxMs ?? 2800
  const ms = reduced ? 450 : Math.min(maxMs, Math.max(minMs, 1200 + (angle / Math.PI) * 1600 + altChange * 400))
  if ((opts.sound ?? true) && !reduced && (angle > 0.05 || altChange > 0.2)) audio.play('travel')
  return globe.flyTo(target, ms)
}

