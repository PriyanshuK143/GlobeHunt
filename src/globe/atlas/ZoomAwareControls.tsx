import type { RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { PerspectiveCamera } from 'three'
import { EARTH_RADIUS } from '../navigation/geo'

/**
 * Scale drag rotation with altitude so the ground moves under the cursor at a similar
 * speed whether you're viewing the whole planet or a single region — and pull the near
 * clipping plane in at low altitude so the surface is never clipped at close zoom.
 */
export function ZoomAwareControls({
  controlsRef,
  baseRotateSpeed,
}: {
  controlsRef: RefObject<OrbitControlsImpl | null>
  baseRotateSpeed: number
}) {
  useFrame(({ camera }) => {
    const c = controlsRef.current
    if (!c) return
    const altitude = camera.position.length() - EARTH_RADIUS
    c.rotateSpeed = baseRotateSpeed * Math.min(1.15, Math.max(0.06, altitude / 1.5))
    const cam = camera as PerspectiveCamera
    const near = Math.min(0.1, Math.max(0.002, altitude * 0.25))
    if (Math.abs(cam.near - near) > near * 0.05) {
      cam.near = near
      cam.updateProjectionMatrix()
    }
  })
  return null
}
