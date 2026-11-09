import { useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { EARTH_RADIUS, vector3ToLatLng, type LatLng } from '../navigation/geo'

const DRAG_THRESHOLD_PX = 6

interface GlobePickLayerProps {
  enabled: boolean
  onPick: (coords: LatLng) => void
}

/**
 * Transparent Earth hit-mesh (must stay renderable so Three.js raycasting works).
 * Distinguishes clicks from orbit drags.
 */
export function GlobePickLayer({ enabled, onPick }: GlobePickLayerProps) {
  const pointerDown = useRef<{ x: number; y: number } | null>(null)

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (!enabled) return
    event.stopPropagation()
    pointerDown.current = { x: event.clientX, y: event.clientY }
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (!enabled || !pointerDown.current) return
    const dx = event.clientX - pointerDown.current.x
    const dy = event.clientY - pointerDown.current.y
    pointerDown.current = null
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) return
    if (!event.point) return
    event.stopPropagation()
    onPick(vector3ToLatLng(event.point))
  }

  return (
    <mesh onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
      <sphereGeometry args={[EARTH_RADIUS * 1.002, 48, 48]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
