import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const POOL_SIZE = 3

const vertex = /* glsl */ `
  attribute vec2 aUv;
  varying vec2 vUv;
  void main() {
    vUv = aUv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// x: 0 = head, 1 = tail end. y: -1..1 across the streak.
const fragment = /* glsl */ `
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    float along = pow(1.0 - vUv.x, 2.2);
    float across = 1.0 - smoothstep(0.0, 1.0, abs(vUv.y));
    vec3 col = mix(vec3(0.55, 0.75, 1.0), vec3(1.0, 0.97, 0.9), along);
    gl_FragColor = vec4(col * along * across * uAlpha, 1.0);
  }
`

interface Meteor {
  mesh: THREE.Mesh
  material: THREE.ShaderMaterial
  positions: Float32Array
  active: boolean
  age: number
  life: number
  start: THREE.Vector3
  velocity: THREE.Vector3
  length: number
  width: number
}

interface MeteorsProps {
  /** Seconds between appearances [min, max]. null disables meteors. */
  interval: [number, number] | null
}

const _head = new THREE.Vector3()
const _tail = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _side = new THREE.Vector3()
const _view = new THREE.Vector3()

/**
 * Rare shooting stars with fading tails. Spawned in the camera's background so they
 * are visible, depth-tested so Earth occludes them, and pooled (no allocations).
 */
export function Meteors({ interval }: MeteorsProps) {
  const pool = useMemo<Meteor[]>(
    () =>
      Array.from({ length: POOL_SIZE }, () => {
        const positions = new Float32Array(12)
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geo.setAttribute(
          'aUv',
          new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), 2),
        )
        geo.setIndex([0, 2, 1, 2, 3, 1])
        const material = new THREE.ShaderMaterial({
          vertexShader: vertex,
          fragmentShader: fragment,
          uniforms: { uAlpha: { value: 0 } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        })
        const mesh = new THREE.Mesh(geo, material)
        mesh.frustumCulled = false
        mesh.visible = false
        mesh.raycast = () => {}
        return {
          mesh,
          material,
          positions,
          active: false,
          age: 0,
          life: 1,
          start: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          length: 3,
          width: 0.06,
        }
      }),
    [],
  )

  useEffect(
    () => () => {
      for (const m of pool) {
        m.mesh.geometry.dispose()
        m.material.dispose()
      }
    },
    [pool],
  )

  const nextSpawn = useRef(6)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    const camera = state.camera

    if (interval) {
      nextSpawn.current -= dt
      if (nextSpawn.current <= 0) {
        nextSpawn.current = interval[0] + Math.random() * (interval[1] - interval[0])
        const m = pool.find((p) => !p.active)
        if (m) {
          // Pick a point in the camera's view, far behind the globe.
          const depth = 35 + Math.random() * 20
          const cam = camera as THREE.PerspectiveCamera
          const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * depth
          const halfW = halfH * cam.aspect
          const local = new THREE.Vector3(
            (Math.random() * 1.6 - 0.8) * halfW,
            (0.15 + Math.random() * 0.75) * halfH,
            -depth,
          )
          m.start.copy(local.applyMatrix4(camera.matrixWorld))
          // Mostly diagonal, downward travel in screen space.
          const angle = THREE.MathUtils.degToRad(200 + Math.random() * 50) * (Math.random() < 0.5 ? 1 : -1)
          const screenDir = new THREE.Vector3(Math.cos(angle), -Math.abs(Math.sin(angle)), 0)
            .normalize()
            .transformDirection(camera.matrixWorld)
          const speed = 18 + Math.random() * 14
          m.velocity.copy(screenDir).multiplyScalar(speed)
          m.length = 3 + Math.random() * 3
          m.width = 0.05 + Math.random() * 0.04
          m.life = 0.7 + Math.random() * 0.6
          m.age = 0
          m.active = true
          m.mesh.visible = true
        }
      }
    }

    camera.getWorldDirection(_view)
    for (const m of pool) {
      if (!m.active) continue
      m.age += dt
      const k = m.age / m.life
      if (k >= 1) {
        m.active = false
        m.mesh.visible = false
        continue
      }
      _head.copy(m.velocity).multiplyScalar(m.age).add(m.start)
      _dir.copy(m.velocity).normalize()
      const len = m.length * Math.min(1, k * 4)
      _tail.copy(_dir).multiplyScalar(-len).add(_head)
      _side.crossVectors(_dir, _view).normalize().multiplyScalar(m.width)

      const p = m.positions
      p[0] = _head.x - _side.x; p[1] = _head.y - _side.y; p[2] = _head.z - _side.z
      p[3] = _head.x + _side.x; p[4] = _head.y + _side.y; p[5] = _head.z + _side.z
      p[6] = _tail.x - _side.x * 0.2; p[7] = _tail.y - _side.y * 0.2; p[8] = _tail.z - _side.z * 0.2
      p[9] = _tail.x + _side.x * 0.2; p[10] = _tail.y + _side.y * 0.2; p[11] = _tail.z + _side.z * 0.2
      ;(m.mesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true

      // Quick ignition, long fade.
      m.material.uniforms.uAlpha.value = Math.min(1, k * 8) * Math.pow(1 - k, 1.4)
    }
  })

  return (
    <group>
      {pool.map((m, i) => (
        <primitive key={i} object={m.mesh} />
      ))}
    </group>
  )
}
