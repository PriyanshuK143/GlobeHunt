import type { CameraTarget, LatLng } from './geo'

export interface GlobeNavigationApi {
  /** Smoothly rotate/zoom the camera toward a geographic coordinate. */
  flyTo: (target: CameraTarget, durationMs?: number) => Promise<void>
  /** Instantly place the camera above a coordinate (no animation). */
  setView: (target: CameraTarget) => void
  /** Current geographic focus under the camera (approx). */
  getView: () => LatLng & { altitude: number }
  /** Cancel an in-flight flyTo animation. */
  cancelFlight: () => void
}
