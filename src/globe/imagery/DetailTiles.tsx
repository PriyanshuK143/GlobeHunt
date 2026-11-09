import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EARTH_RADIUS, latLngToVector3, vector3ToLatLng } from '../navigation/geo'
import {
  GIBS_MAX_LEVEL,
  loadImage,
  tileBounds,
  tileGrid,
  tileKey,
  tileUrl,
  type TileId,
} from './gibs'
import { applyOceanSpecular } from './oceanSpecular'

const UPDATE_INTERVAL = 0.2 // seconds between visibility passes
const MAX_VISIBLE = 64
const MAX_CACHED = 140
const MAX_CONCURRENT = 8
const FADE_SECONDS = 0.35
const LINGER_SECONDS = 2
const deg2rad = THREE.MathUtils.degToRad

/** Pick the imagery level for a camera distance (Earth radius = 1). */
function levelForDistance(distance: number, maxLevel = GIBS_MAX_LEVEL): number {
  const altitude = distance - EARTH_RADIUS
  let level = 0
  if (altitude < 1.3) level = 4
  if (altitude < 0.8) level = 5
  if (altitude < 0.5) level = 6
  if (altitude < 0.32) level = 7
  return Math.min(level, maxLevel)
}

interface TileEntry {
  id: TileId
  key: string
  mesh: THREE.Mesh
  material: THREE.MeshStandardMaterial
  texture: THREE.Texture | null
  state: 'queued' | 'loading' | 'ready' | 'error'
  fade: number
  lastUsed: number
  priority: number
}

function buildTileMesh(id: TileId): { mesh: THREE.Mesh; material: THREE.MeshStandardMaterial } {
  const { west, north, deg } = tileBounds(id)
  const segments = Math.max(4, Math.ceil(deg / 1.5))
  // SphereGeometry phi = lng + 180°, theta = 90° − lat (matches latLngToVector3 and UVs).
  // A hair above the base sphere (finer levels slightly higher) instead of a large
  // depth offset, so atlas line overlays a few km up are never occluded at close zoom.
  const geometry = new THREE.SphereGeometry(
    EARTH_RADIUS * (1 + 0.00004 + id.level * 0.000006),
    segments,
    segments,
    deg2rad(west + 180),
    deg2rad(deg),
    deg2rad(90 - north),
    deg2rad(deg),
  )
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.88,
    metalness: 0,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
  applyOceanSpecular(material)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.raycast = () => {}
  mesh.visible = false
  mesh.renderOrder = 0
  return { mesh, material }
}

const _frustum = new THREE.Frustum()
const _projView = new THREE.Matrix4()
const _sphere = new THREE.Sphere()
const _camDir = new THREE.Vector3()

/**
 * Streams higher-resolution NASA imagery tiles over the base texture as the camera
 * zooms in. Tiles are sphere patches at the exact geographic bounds, so borders,
 * picking and lat/lng math are unaffected. Loads are prioritised by distance to the
 * view centre, capped in flight, and evicted LRU with full GPU disposal.
 */
export function DetailTiles({ maxLevel = GIBS_MAX_LEVEL }: { maxLevel?: number }) {
  const camera = useThree((s) => s.camera)
  const group = useMemo(() => new THREE.Group(), [])
  const cache = useRef(new Map<string, TileEntry>())
  const inFlight = useRef(0)
  const sinceUpdate = useRef(UPDATE_INTERVAL)
  const visibleKeys = useRef(new Set<string>())
  const clock = useRef(0)

  const dispose = (entry: TileEntry) => {
    group.remove(entry.mesh)
    entry.mesh.geometry.dispose()
    entry.material.dispose()
    entry.texture?.dispose()
  }

  useEffect(
    () => () => {
      for (const entry of cache.current.values()) dispose(entry)
      cache.current.clear()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const pump = () => {
    if (inFlight.current >= MAX_CONCURRENT) return
    const queued = [...cache.current.values()]
      .filter((e) => e.state === 'queued' && visibleKeys.current.has(e.key))
      .sort((a, b) => a.priority - b.priority)
    for (const entry of queued) {
      if (inFlight.current >= MAX_CONCURRENT) break
      entry.state = 'loading'
      inFlight.current++
      loadImage(tileUrl(entry.id))
        .then((img) => {
          if (!cache.current.has(entry.key)) return
          const tex = new THREE.Texture(img)
          tex.colorSpace = THREE.SRGBColorSpace
          tex.anisotropy = 4
          tex.wrapS = THREE.ClampToEdgeWrapping
          tex.wrapT = THREE.ClampToEdgeWrapping
          tex.needsUpdate = true
          entry.texture = tex
          entry.material.map = tex
          entry.material.needsUpdate = true
          entry.state = 'ready'
        })
        .catch(() => {
          entry.state = 'error'
        })
        .finally(() => {
          inFlight.current--
          pump()
        })
    }
  }

  const updateVisibility = () => {
    const distance = camera.position.length()
    const level = levelForDistance(distance, maxLevel)
    const next = new Set<string>()

    if (level >= 4) {
      _camDir.copy(camera.position).normalize()
      const horizon = Math.acos(Math.min(1, EARTH_RADIUS / distance))
      camera.updateMatrixWorld()
      _projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      _frustum.setFromProjectionMatrix(_projView)

      const { cols, rows, deg } = tileGrid(level)
      const center = vector3ToLatLng(camera.position)
      const reachDeg = THREE.MathUtils.radToDeg(horizon) + deg
      const rowMin = Math.max(0, Math.floor((90 - (center.lat + reachDeg)) / deg))
      const rowMax = Math.min(rows - 1, Math.floor((90 - (center.lat - reachDeg)) / deg))
      const halfDiag = deg2rad(deg) * 0.75
      const candidates: { id: TileId; score: number }[] = []

      for (let row = rowMin; row <= rowMax; row++) {
        const latMid = 90 - (row + 0.5) * deg
        const cosLat = Math.max(0.05, Math.cos(deg2rad(latMid)))
        const lngReach = Math.min(180, reachDeg / cosLat)
        const colSpan = Math.ceil(lngReach / deg) + 1
        const centerCol = Math.floor((center.lng + 180) / deg)
        const seen = new Set<number>()
        for (let dc = -colSpan; dc <= colSpan; dc++) {
          const col = (((centerCol + dc) % cols) + cols) % cols
          if (seen.has(col)) continue
          seen.add(col)
          const lngMid = -180 + (col + 0.5) * deg
          const mid = latLngToVector3(latMid, lngMid, EARTH_RADIUS)
          const dot = mid.dot(_camDir)
          if (dot < Math.cos(Math.min(Math.PI, horizon + halfDiag))) continue
          _sphere.set(mid, halfDiag)
          if (!_frustum.intersectsSphere(_sphere)) continue
          candidates.push({ id: { level, col, row }, score: -dot })
        }
      }

      candidates.sort((a, b) => a.score - b.score)
      for (const { id, score } of candidates.slice(0, MAX_VISIBLE)) {
        const key = tileKey(id)
        next.add(key)
        let entry = cache.current.get(key)
        if (!entry) {
          const { mesh, material } = buildTileMesh(id)
          entry = { id, key, mesh, material, texture: null, state: 'queued', fade: 0, lastUsed: 0, priority: score }
          cache.current.set(key, entry)
          group.add(mesh)
        }
        entry.priority = score
        entry.lastUsed = clock.current
        if (entry.state === 'error') entry.state = 'queued'
      }
    }

    visibleKeys.current = next

    // LRU eviction of tiles no longer needed.
    if (cache.current.size > MAX_CACHED) {
      const evictable = [...cache.current.values()]
        .filter((e) => !next.has(e.key) && e.state !== 'loading')
        .sort((a, b) => a.lastUsed - b.lastUsed)
      for (const entry of evictable.slice(0, cache.current.size - MAX_CACHED)) {
        dispose(entry)
        cache.current.delete(entry.key)
      }
    }
    pump()
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    clock.current += dt
    sinceUpdate.current += dt
    if (sinceUpdate.current >= UPDATE_INTERVAL) {
      sinceUpdate.current = 0
      updateVisibility()
    }
    for (const entry of cache.current.values()) {
      // Keep recently-used tiles for a moment so zooming across levels never flashes
      // back to the base texture while the next level streams in.
      const recent = clock.current - entry.lastUsed < LINGER_SECONDS
      const wanted = entry.state === 'ready' && (visibleKeys.current.has(entry.key) || recent)
      if (wanted) {
        entry.fade = Math.min(1, entry.fade + dt / FADE_SECONDS)
      } else {
        entry.fade = 0
      }
      entry.mesh.visible = entry.fade > 0
      if (entry.mesh.visible) {
        const opaque = entry.fade >= 1
        if (entry.material.transparent === opaque) {
          entry.material.transparent = !opaque
          entry.material.needsUpdate = true
        }
        entry.material.opacity = entry.fade
      }
    }
  })

  return <primitive object={group} />
}
