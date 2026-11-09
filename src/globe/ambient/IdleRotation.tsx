import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { approach } from './motion'

interface IdleRotationProps {
  controlsRef: RefObject<OrbitControlsImpl | null>
  /** Target auto-rotate speed (OrbitControls units). 0 disables idle motion. */
  speed: number
  /** Seconds after the user lets go before ambient motion resumes. */
  resumeDelay?: number
}

/**
 * Idle "living Earth" spin, implemented as a slow camera orbit so geographic picking,
 * borders and lat/lng math stay untouched. Positive speed moves the camera westward,
 * so the surface appears to turn eastward like the real Earth.
 *
 * - Stops instantly when the user grabs the globe.
 * - Eases back in after a short pause once they let go.
 * - Stays off during flyTo animations (controls disabled) and gameplay (speed 0).
 */
export function IdleRotation({ controlsRef, speed, resumeDelay = 2.5 }: IdleRotationProps) {
  const interacting = useRef(false)
  const releasedAt = useRef(-Infinity)
  const current = useRef(0)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const onStart = () => {
      interacting.current = true
      current.current = 0
      controls.autoRotateSpeed = 0
    }
    const onEnd = () => {
      interacting.current = false
      releasedAt.current = performance.now()
    }
    controls.addEventListener('start', onStart)
    controls.addEventListener('end', onEnd)
    return () => {
      controls.removeEventListener('start', onStart)
      controls.removeEventListener('end', onEnd)
    }
  }, [controlsRef])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls) return
    const sinceRelease = (performance.now() - releasedAt.current) / 1000
    const allowed =
      speed > 0 && controls.enabled && !interacting.current && sinceRelease > resumeDelay
    const target = allowed ? speed : 0
    // Ramp up gently; drop out quickly.
    const dt = Math.min(delta, 0.1)
    current.current = approach(current.current, target, target > current.current ? 0.6 : 6, dt)
    if (current.current < 0.002 && target === 0) current.current = 0
    controls.autoRotate = current.current > 0
    // OrbitControls applies auto-rotation per frame assuming 60 fps; normalise for
    // high-refresh displays so the spin speed is the same everywhere.
    controls.autoRotateSpeed = current.current * dt * 60
  })

  return null
}
