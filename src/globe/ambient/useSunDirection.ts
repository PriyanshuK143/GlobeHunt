import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sunDirection } from './solar'

const RECOMPUTE_MS = 5_000

/**
 * Shared, mutable sun direction (Earth-fixed). Recomputed from UTC every few
 * seconds inside the render loop — no React state updates.
 */
const sharedSun = new THREE.Vector3(1, 0, 0)
let lastComputed = -Infinity

const displaySun = new THREE.Vector3(1, 0, 0)
let useDisplay = false

/**
 * Direction the scene is actually lit from (set each frame by GlobeLights). Atmosphere,
 * clouds and city lights read this so they always agree with the visible lighting.
 */
export function setDisplaySun(dir: THREE.Vector3 | null): void {
  if (dir) {
    displaySun.copy(dir)
    useDisplay = true
  } else useDisplay = false
}

/** Real UTC sub-solar direction (for the HUD / astronomy). */
export function getRealSunDirection(): THREE.Vector3 {
  const now = Date.now()
  if (now - lastComputed > RECOMPUTE_MS) {
    sunDirection(new Date(now), sharedSun)
    lastComputed = now
  }
  return sharedSun
}

export function getSunDirection(): THREE.Vector3 {
  if (useDisplay) return displaySun
  const now = Date.now()
  if (now - lastComputed > RECOMPUTE_MS) {
    sunDirection(new Date(now), sharedSun)
    lastComputed = now
  }
  return sharedSun
}

/** Calls `apply` every frame with the current sun direction. */
export function useSunDirection(apply: (dir: THREE.Vector3) => void): void {
  const applyRef = useRef(apply)
  applyRef.current = apply
  useFrame(() => applyRef.current(getSunDirection()))
}
