import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ORBITS, SATELLITES, orbitPosition, orbitQuaternion, type OrbitSpec, type SatelliteSpec } from './orbits'
import { SatelliteKit } from './satelliteModels'
import { approach } from './motion'
import type { AmbientMode } from './types'

const RING_SEGMENTS = 256

const ringVertex = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Faint base line plus a luminous trail fading behind the lead satellite.
const ringFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uHead;
  uniform float uHasHead;
  varying float vT;
  void main() {
    float behind = fract(uHead - vT);
    float trail = exp(-behind * 9.0) * uHasHead;
    float a = uOpacity * (0.45 + trail * 1.9);
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`

function buildRingGeometry(spec: OrbitSpec, quat: THREE.Quaternion): THREE.BufferGeometry {
  const positions = new Float32Array(RING_SEGMENTS * 3)
  const ts = new Float32Array(RING_SEGMENTS)
  const v = new THREE.Vector3()
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const t = i / RING_SEGMENTS
    orbitPosition(spec.radius, quat, t, v)
    positions.set([v.x, v.y, v.z], i * 3)
    ts[i] = t
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aT', new THREE.BufferAttribute(ts, 1))
  return geo
}

interface OrbitalSystemProps {
  mode: AmbientMode
  /** Showcase only: a satellite was clicked. */
  onSelect?: (spec: SatelliteSpec) => void
  /** Show only the essential subset of orbits and satellites. */
  reduced: boolean
  /** Freeze orbital motion and beacon blinking. */
  frozen: boolean
}

const _camDir = new THREE.Vector3()
const _satDir = new THREE.Vector3()

/**
 * Orbit rings + low-poly satellites and a space station travelling along them.
 * All motion runs in one useFrame — no React state per frame.
 */
export function OrbitalSystem({ mode, reduced, frozen, onSelect }: OrbitalSystemProps) {
  const kit = useMemo(() => new SatelliteKit(), [])

  const orbits = useMemo(
    () =>
      ORBITS.filter((o) => !reduced || o.essential).map((spec) => {
        const quat = orbitQuaternion(spec)
        const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(quat)
        const geometry = buildRingGeometry(spec, quat)
        const material = new THREE.ShaderMaterial({
          vertexShader: ringVertex,
          fragmentShader: ringFragment,
          uniforms: {
            uColor: { value: new THREE.Color(spec.color) },
            uOpacity: { value: 0 },
            uHead: { value: 0 },
            uHasHead: { value: 0 },
          },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const line = new THREE.LineLoop(geometry, material)
        line.raycast = () => {}
        return { spec, quat, normal, line, material, geometry }
      }),
    [reduced],
  )

  const satellites = useMemo(() => {
    const orbitById = new Map(orbits.map((o) => [o.spec.id, o]))
    return SATELLITES.filter((s) => (!reduced || s.essential) && orbitById.has(s.orbit)).map(
      (spec, index) => {
        const orbit = orbitById.get(spec.orbit)!
        const { model, beacon } = kit.build(spec.kind)
        const group = new THREE.Group()
        group.add(model)
        group.up.copy(orbit.normal)
        group.scale.setScalar(0)
        return { spec, orbit, group, beacon, visibility: 0, blinkOffset: (index * 0.73) % 2.2 }
      },
    )
  }, [orbits, kit, reduced])

  // Lead satellite per orbit drives its ring trail.
  const leads = useMemo(() => {
    const map = new Map<string, (typeof satellites)[number]>()
    for (const sat of satellites) if (!map.has(sat.spec.orbit)) map.set(sat.spec.orbit, sat)
    return map
  }, [satellites])

  useEffect(
    () => () => {
      for (const o of orbits) {
        o.geometry.dispose()
        o.material.dispose()
      }
    },
    [orbits],
  )
  useEffect(() => () => kit.dispose(), [kit])

  const simTime = useRef(0)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    // Satellites keep drifting during play, just a little slower.
    if (!frozen) simTime.current += dt * (mode === 'gameplay' ? 0.6 : 1)
    const t = simTime.current
    const camera = state.camera
    _camDir.copy(camera.position).normalize()
    const elapsed = state.clock.elapsedTime

    for (const o of orbits) {
      const target = mode === 'gameplay' ? o.spec.gameplayOpacity : o.spec.showcaseOpacity
      const u = o.material.uniforms
      u.uOpacity.value = approach(u.uOpacity.value, target, 2, dt)
      o.line.visible = u.uOpacity.value > 0.003
      const lead = leads.get(o.spec.id)
      if (lead) {
        u.uHasHead.value = 1
        u.uHead.value = (lead.spec.phase + t / lead.spec.period) % 1
      } else {
        u.uHasHead.value = 0
      }
    }

    for (const sat of satellites) {
      const phase = (sat.spec.phase + t / sat.spec.period) % 1
      orbitPosition(sat.orbit.spec.radius, sat.orbit.quat, phase, sat.group.position)
      sat.group.lookAt(0, 0, 0)

      // Never let an orbital object sit over the area the player is searching,
      // and never let one clip through the camera.
      const camDist = sat.group.position.distanceTo(camera.position)
      _satDir.copy(sat.group.position).normalize()
      let target = 1
      if (camDist < 0.4) target = 0
      if (mode === 'gameplay') {
        if (sat.orbit.spec.gameplayOpacity === 0) target = 0
        else if (_satDir.dot(_camDir) > 0.45) target = 0
        else if (camDist < 0.9) target = 0
      }
      sat.visibility = approach(sat.visibility, target, 3.5, dt)
      sat.group.visible = sat.visibility > 0.01
      sat.group.scale.setScalar(sat.spec.scale * sat.visibility)

      const blink = frozen ? 1 : (elapsed + sat.blinkOffset) % 2.2 < 0.18 ? 1.6 : 0.55
      sat.beacon.scale.setScalar(blink * (sat.spec.kind === 'station' ? 0.0028 : 0.0022))
    }
  })

  return (
    <group>
      {orbits.map((o) => (
        <primitive key={o.spec.id} object={o.line} />
      ))}
      {satellites.map((s) => (
        <primitive key={s.spec.id} object={s.group}>
          {/* Generous invisible hit area — satellites are tiny on screen. */}
          {onSelect && mode === 'showcase' ? (
            <mesh
              onClick={(e) => {
                e.stopPropagation()
                onSelect(s.spec)
              }}
              onPointerOver={(e) => {
                e.stopPropagation()
                document.body.style.cursor = 'pointer'
              }}
              onPointerOut={() => {
                document.body.style.cursor = ''
              }}
            >
              <sphereGeometry args={[0.075, 10, 8]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          ) : null}
        </primitive>
      ))}
    </group>
  )
}
