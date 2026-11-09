import { useLayoutEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { EARTH_RADIUS } from './navigation/geo'
import { DetailTiles, applyOceanSpecular } from './imagery'

/**
 * NASA Blue Marble shaded relief + bathymetry (public domain), stitched from the
 * GIBS level-3 tiles into a bundled 4096×2048 equirectangular map — works offline.
 */
const DAY_MAP = '/textures/earth-bluemarble.jpg'

const SEGMENTS = 128

const DETAIL_LEVEL = { low: 5, medium: 6, high: 7 } as const

interface EarthProps {
  quality?: 'low' | 'medium' | 'high'
}

/**
 * Layered Earth:
 * 1. Bundled NASA Blue Marble satellite base (offline)
 * 2. Zoom-dependent high-resolution NASA tiles streamed when online
 * (Borders, coastlines, rivers and admin lines are drawn by atlas/LineLayers.)
 */
export function Earth({ quality = 'high' }: EarthProps) {
  const dayMap = useTexture(DAY_MAP)

  useLayoutEffect(() => {
    dayMap.colorSpace = THREE.SRGBColorSpace
    dayMap.anisotropy = 8
    dayMap.needsUpdate = true
  }, [dayMap])

  const surface = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0 })
    applyOceanSpecular(material)
    return material
  }, [])

  useLayoutEffect(() => {
    surface.map = dayMap
    surface.needsUpdate = true
  }, [surface, dayMap])

  useLayoutEffect(() => () => surface.dispose(), [surface])

  return (
    <group>
      <mesh material={surface}>
        <sphereGeometry args={[EARTH_RADIUS, SEGMENTS, SEGMENTS / 2]} />
      </mesh>

      <DetailTiles maxLevel={DETAIL_LEVEL[quality]} />

    </group>
  )
}

useTexture.preload(DAY_MAP)
