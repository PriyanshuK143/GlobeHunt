import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EARTH_RADIUS, latLngToVector3 } from '../navigation/geo'

/** Toggleable geographic overlays (no rebuild needed to switch them). */
export interface GlobeLayers {
  borders: boolean
  coastlines: boolean
  disputed: boolean
  admin1: boolean
  rivers: boolean
  lakes: boolean
}

export const DEFAULT_LAYERS: GlobeLayers = {
  borders: true,
  coastlines: true,
  disputed: true,
  admin1: true,
  rivers: true,
  lakes: true,
}

const MAX_STEP_DEG = 0.6

/** Flat [lng,lat,…] polylines → LineSegments positions on a sphere shell. */
function toSegments(lines: number[][], radius: number): THREE.BufferGeometry {
  const pos: number[] = []
  const push = (lng: number, lat: number) => {
    const v = latLngToVector3(lat, lng, radius)
    pos.push(v.x, v.y, v.z)
  }
  for (const flat of lines) {
    for (let i = 2; i < flat.length; i += 2) {
      const lng0 = flat[i - 2]
      const lat0 = flat[i - 1]
      const lng1 = flat[i]
      const lat1 = flat[i + 1]
      if (Math.abs(lng1 - lng0) > 180) continue
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(lng1 - lng0), Math.abs(lat1 - lat0)) / MAX_STEP_DEG))
      for (let s = 0; s < steps; s++) {
        const a = s / steps
        const b = (s + 1) / steps
        push(lng0 + (lng1 - lng0) * a, lat0 + (lat1 - lat0) * a)
        push(lng0 + (lng1 - lng0) * b, lat0 + (lat1 - lat0) * b)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return g
}

interface LayerSpec {
  id: string
  file: string
  radius: number
  color: string
  opacity: number
  /** Fade in when the camera is closer than this distance. */
  showBelow: number
  dashed?: boolean
  /** Rivers: [rank, flat] rows split into rank buckets with their own thresholds. */
  ranked?: Array<{ maxRank: number; showBelow: number; opacity: number }>
  layer: keyof GlobeLayers
}

const SPECS: LayerSpec[] = [
  { id: 'coast', file: 'coast', radius: 1.0011, color: '#e6f1ff', opacity: 0.6, showBelow: 99, layer: 'coastlines' },
  { id: 'borders', file: 'borders', radius: 1.0012, color: '#fff6d8', opacity: 0.92, showBelow: 99, layer: 'borders' },
  { id: 'disputed', file: 'disputed', radius: 1.0012, color: '#f2e2c4', opacity: 0.55, showBelow: 3.2, dashed: true, layer: 'disputed' },
  { id: 'admin1', file: 'admin1', radius: 1.0010, color: '#f1e6c8', opacity: 0.5, showBelow: 2.35, dashed: true, layer: 'admin1' },
  { id: 'lakes', file: 'lakes', radius: 1.0009, color: '#8fd2ff', opacity: 0.75, showBelow: 3.0, layer: 'lakes' },
  {
    id: 'rivers',
    file: 'rivers',
    radius: 1.0009,
    color: '#6cc4ff',
    opacity: 0.6,
    showBelow: 99,
    layer: 'rivers',
    ranked: [
      { maxRank: 2, showBelow: 4.4, opacity: 0.85 },
      { maxRank: 4, showBelow: 3.0, opacity: 0.78 },
      { maxRank: 6, showBelow: 2.25, opacity: 0.7 },
      { maxRank: 8, showBelow: 1.7, opacity: 0.6 },
      { maxRank: 99, showBelow: 1.32, opacity: 0.5 },
    ],
  },
]

interface BuiltLayer {
  spec: LayerSpec
  parts: Array<{ object: THREE.LineSegments; material: THREE.LineBasicMaterial | THREE.LineDashedMaterial; showBelow: number; opacity: number }>
}

/**
 * Atlas line overlays from the packaged Natural Earth data. Each layer is fetched the
 * first time it could be visible, then just fades with distance. Purely visual: no
 * raycasting, no answer-specific styling.
 */
export function LineLayers({ layers = DEFAULT_LAYERS }: { layers?: GlobeLayers }) {
  const camera = useThree((s) => s.camera)
  const group = useMemo(() => new THREE.Group(), [])
  const [built, setBuilt] = useState<BuiltLayer[]>([])
  const requested = useRef(new Set<string>())
  const layersRef = useRef(layers)
  layersRef.current = layers

  const load = (spec: LayerSpec) => {
    if (requested.current.has(spec.id)) return
    requested.current.add(spec.id)
    fetch(`/atlas/lines/${spec.file}.json`)
      .then((r) => r.json())
      .then((data: unknown[]) => {
        const buckets = spec.ranked
          ? spec.ranked.map((b, i) => ({
              ...b,
              lines: (data as Array<[number, number[]]>)
                .filter(([rank]) => rank <= b.maxRank && (i === 0 || rank > spec.ranked![i - 1].maxRank))
                .map(([, flat]) => flat),
            }))
          : [{ showBelow: spec.showBelow, opacity: spec.opacity, lines: data as number[][] }]
        const parts = buckets.map((b) => {
          const geometry = toSegments(b.lines, EARTH_RADIUS * spec.radius)
          const material = spec.dashed
            ? new THREE.LineDashedMaterial({ color: spec.color, transparent: true, opacity: 0, dashSize: 0.004, gapSize: 0.003, depthWrite: false })
            : new THREE.LineBasicMaterial({ color: spec.color, transparent: true, opacity: 0, depthWrite: false })
          const object = new THREE.LineSegments(geometry, material)
          if (spec.dashed) object.computeLineDistances()
          object.raycast = () => {}
          object.renderOrder = 3
          group.add(object)
          return { object, material, showBelow: b.showBelow, opacity: b.opacity }
        })
        setBuilt((prev) => [...prev, { spec, parts }])
      })
      .catch((err) => console.warn('[GLOBEHUNT] Line layer unavailable:', spec.id, err))
  }

  useEffect(
    () => () => {
      for (const b of built) for (const p of b.parts) {
        p.object.geometry.dispose()
        p.material.dispose()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame((_, delta) => {
    const d = camera.position.length()
    for (const spec of SPECS) {
      const firstVisible = spec.ranked ? spec.ranked[0].showBelow : spec.showBelow
      if (layersRef.current[spec.layer] && d < firstVisible * 1.15) load(spec)
    }
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * 8)
    for (const b of built) {
      const on = layersRef.current[b.spec.layer]
      for (const p of b.parts) {
        // Fade over the last 12% before the threshold.
        const vis = on ? THREE.MathUtils.clamp((p.showBelow - d) / (p.showBelow * 0.12), 0, 1) : 0
        p.material.opacity += (vis * p.opacity - p.material.opacity) * k
        p.object.visible = p.material.opacity > 0.01
      }
    }
  })

  return <primitive object={group} />
}
