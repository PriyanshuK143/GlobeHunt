import {
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
  type RefObject,
} from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  DEFAULT_FLY_ALTITUDE,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
  latLngToVector3,
  vector3ToLatLng,
  type CameraTarget,
  type LatLng,
} from './geo'
import type { GlobeNavigationApi } from './types'

interface Controllable {
  enabled: boolean
  update: () => void
  target: THREE.Vector3
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function clampAltitude(altitude: number): number {
  return THREE.MathUtils.clamp(altitude, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE)
}

function targetPosition(target: CameraTarget): THREE.Vector3 {
  const altitude = clampAltitude(target.altitude ?? DEFAULT_FLY_ALTITUDE)
  return latLngToVector3(target.lat, target.lng, altitude)
}

/**
 * Imperative navigation bridge for the globe camera.
 * flyTo uses its own rAF loop so the Promise always settles,
 * even if R3F frame subscriptions are interrupted.
 */
export function useGlobeNavigation(
  apiRef: Ref<GlobeNavigationApi | null>,
  controlsRef: RefObject<Controllable | null>,
): void {
  const { camera } = useThree()
  const rafRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const resolveRef = useRef<(() => void) | null>(null)

  const finishFlight = (settle: boolean, snapTo?: THREE.Vector3) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (snapTo) {
      camera.position.copy(snapTo)
      camera.lookAt(0, 0, 0)
    }
    if (controlsRef.current) {
      controlsRef.current.enabled = true
      controlsRef.current.target.set(0, 0, 0)
      controlsRef.current.update()
    }
    if (settle) {
      const resolve = resolveRef.current
      resolveRef.current = null
      resolve?.()
    }
  }

  const cancelFlight = () => {
    finishFlight(true)
  }

  const setView = (target: CameraTarget) => {
    cancelFlight()
    camera.position.copy(targetPosition(target))
    camera.lookAt(0, 0, 0)
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0)
      controlsRef.current.update()
    }
  }

  const getView = (): LatLng & { altitude: number } => {
    const { lat, lng } = vector3ToLatLng(camera.position)
    return { lat, lng, altitude: camera.position.length() }
  }

  const flyTo = (target: CameraTarget, durationMs = 1400): Promise<void> => {
    cancelFlight()
    const fromPos = camera.position.clone()
    const toPos = targetPosition(target)
    const duration = Math.max(200, durationMs)
    const start = performance.now()

    // Great-circle travel: slerp the view direction around the globe (never through
    // it), ease altitude between endpoints and lift mid-flight for long hops.
    const fromDir = fromPos.clone().normalize()
    const toDir = toPos.clone().normalize()
    const fromAlt = fromPos.length()
    const toAlt = toPos.length()
    const angle = fromDir.angleTo(toDir)
    const peak = Math.max(fromAlt, toAlt)
    const lift = Math.max(0, Math.min(MAX_CAMERA_DISTANCE - peak, (angle / Math.PI) * 1.25))
    let axis = new THREE.Vector3().crossVectors(fromDir, toDir)
    if (axis.lengthSq() < 1e-10) {
      // Same or antipodal direction: rotate about any perpendicular axis.
      axis = new THREE.Vector3(0, 1, 0).cross(fromDir)
      if (axis.lengthSq() < 1e-10) axis.set(1, 0, 0)
    }
    axis.normalize()
    const dir = new THREE.Vector3()

    if (controlsRef.current) controlsRef.current.enabled = false

    return new Promise((resolve) => {
      resolveRef.current = resolve

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const k = easeInOutCubic(t)
        dir.copy(fromDir).applyAxisAngle(axis, angle * k)
        const alt = fromAlt + (toAlt - fromAlt) * k + lift * Math.sin(Math.PI * k)
        camera.position.copy(dir).multiplyScalar(alt)
        camera.lookAt(0, 0, 0)

        if (t >= 1) {
          rafRef.current = null
          finishFlight(true, toPos)
          return
        }
        rafRef.current = requestAnimationFrame(step)
      }

      rafRef.current = requestAnimationFrame(step)
      // Safety: always settle even if rAF is throttled/paused.
      timeoutRef.current = window.setTimeout(() => {
        finishFlight(true, toPos)
      }, duration + 250)
    })
  }

  useImperativeHandle(
    apiRef,
    () => ({
      flyTo,
      setView,
      getView,
      cancelFlight,
    }),
    // Methods close over latest camera/controls via refs + render scope.
    // Re-bind each render so camera identity stays current.
  )

  useEffect(() => () => finishFlight(true), [])
}
