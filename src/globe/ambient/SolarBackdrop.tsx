import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { solarSun } from './solarSun'
import { mulberry32 } from './motion'
import { CELESTIAL, type CelestialSpec } from './planets'

/**
 * Planets in order from the Sun. `k` = orbit radius as a multiple of Earth's orbit
 * (order is real; spacing is compressed so the outer planets stay in frame). Earth
 * itself is the globe in the middle of the scene, sitting on its own orbit (k = 1).
 */
const PLANETS = [
  { name: 'Mercury', radius: 0.32, k: 0.42, period: 22, color: '#a9a29a' },
  { name: 'Venus', radius: 0.55, k: 0.7, period: 40, color: '#e8cf98' },
  { name: 'Mars', radius: 0.42, k: 1.32, period: 75, color: '#c1532f' },
  { name: 'Jupiter', radius: 1.35, k: 1.75, period: 170, color: '#d8b48a', bands: ['#c99a6b', '#efdcbf', '#b98059', '#e6cba4'] },
  { name: 'Saturn', radius: 1.1, k: 2.15, period: 280, color: '#e5d09c', bands: ['#d9bf86', '#f0e1b8', '#cdb07a'], ring: true },
  { name: 'Uranus', radius: 0.75, k: 2.5, period: 420, color: '#9fdce6' },
  { name: 'Neptune', radius: 0.72, k: 2.85, period: 540, color: '#4f78d6' },
]

/** How far beyond the globe (along the view) the Sun sits. */
const SUN_DEPTH = 22


function glowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, inner)
  g.addColorStop(0.18, inner)
  g.addColorStop(0.42, outer)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function bandTexture(colors: string[]): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 64
  const ctx = c.getContext('2d')!
  const rand = mulberry32(colors.length * 31)
  let y = 0
  while (y < 64) {
    const h = 2 + Math.floor(rand() * 6)
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)]
    ctx.fillRect(0, y, 4, h)
    y += h
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function moonTexture(): THREE.CanvasTexture {
  const w = 512
  const h = 256
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#9b9a97'
  ctx.fillRect(0, 0, w, h)
  const rand = mulberry32(7)
  // Darker "maria" patches, then craters.
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(70, 70, 72, ${0.25 + rand() * 0.25})`
    ctx.beginPath()
    ctx.ellipse(rand() * w, h * (0.25 + rand() * 0.5), 20 + rand() * 60, 14 + rand() * 30, rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 220; i++) {
    const x = rand() * w
    const y = rand() * h
    const r = 1 + Math.pow(rand(), 3) * 12
    ctx.fillStyle = 'rgba(60, 60, 62, 0.35)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(205, 204, 200, 0.35)'
    ctx.lineWidth = Math.max(0.6, r * 0.25)
    ctx.beginPath()
    ctx.arc(x - r * 0.15, y - r * 0.15, r, Math.PI * 0.9, Math.PI * 1.9)
    ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

interface SolarBackdropProps {
  visible: boolean
  frozen: boolean
  /** Showcase only: the Sun, a planet or the Moon was clicked. */
  onSelect?: (spec: CelestialSpec) => void
}

/** Invisible, generous click target (bodies are only a few pixels across). */
function HitArea({ radius, spec, onSelect, position }: { radius: number; spec?: CelestialSpec; onSelect?: (spec: CelestialSpec) => void; position?: [number, number, number] }) {
  if (!onSelect || !spec) return null
  return (
    <mesh
      position={position}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(spec)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = ''
      }}
    >
      <sphereGeometry args={[radius, 10, 8]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

/**
 * Background solar system with Earth as part of it: the Sun sits upper-left beyond the
 * globe and every orbit is centred on it, in a plane that also contains the globe — so
 * the globe lies exactly on Earth's orbit, third from the Sun. The layout rides with the
 * camera (always in frame) and the Moon orbits the globe in world space.
 */
const _sun = new THREE.Vector3()
const _earth = new THREE.Vector3()
const _e1 = new THREE.Vector3()
const _e2 = new THREE.Vector3()
const _n = new THREE.Vector3()
const _basis = new THREE.Matrix4()


export function SolarBackdrop({ visible, frozen, onSelect }: SolarBackdropProps) {
  // The system is anchored in world space (like the starfield) from the view it first
  // appears in, so dragging the globe swings the Sun and planets past naturally.
  const anchor = useRef<{ quat: THREE.Quaternion; dist: number; fov: number; aspect: number } | null>(null)
  const shownFor = useRef(0)
  const rig = useRef<THREE.Group>(null)
  const sunGroup = useRef<THREE.Group>(null)
  const plane = useRef<THREE.Group>(null)
  const orbitRefs = useRef<Array<THREE.LineLoop | null>>([])
  const earthOrbit = useRef<THREE.LineLoop>(null)
  const sunBody = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const orbitDist = useRef(64)
  const planetRefs = useRef<Array<THREE.Group | null>>([])
  const moonPivot = useRef<THREE.Group>(null)
  const moonMesh = useRef<THREE.Mesh>(null)
  const corona = useRef<THREE.Sprite>(null)
  const time = useRef(0)
  const fade = useRef(visible ? 1 : 0)

  const assets = useMemo(() => {
    const core = glowTexture('rgba(255,250,225,1)', 'rgba(255,196,60,0.55)')
    const halo = glowTexture('rgba(255,214,110,0.55)', 'rgba(255,150,40,0.12)')
    const moon = moonTexture()
    const bands = Object.fromEntries(PLANETS.filter((p) => p.bands).map((p) => [p.name, bandTexture(p.bands!)]))
    // One unit circle, scaled per orbit each frame.
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 256; i++) {
      const a = (i / 256) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)))
    }
    const circle = new THREE.BufferGeometry().setFromPoints(pts)
    return { core, halo, moon, bands, circle }
  }, [])
  useEffect(
    () => () => {
      assets.core.dispose()
      assets.halo.dispose()
      assets.moon.dispose()
      Object.values(assets.bands).forEach((t) => t.dispose())
      assets.circle.dispose()
    },
    [assets],
  )

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.1)
    if (!frozen) time.current += dt
    fade.current += ((visible ? 1 : 0) - fade.current) * (1 - Math.exp(-dt * 3))
    const on = fade.current > 0.02
    const cam = camera as THREE.PerspectiveCamera
    // Anchoring: while hidden and during the first moments on screen (the home camera is
    // still being placed) the layout frames itself to the view. After that it stays put in
    // world space; zooming only rescales it, so a drag is never undone by a scroll.
    shownFor.current = on ? shownFor.current + dt : 0
    const dist = camera.position.length()
    if (!on || !anchor.current || shownFor.current < 1.2) {
      anchor.current = { quat: camera.quaternion.clone(), dist, fov: cam.fov, aspect: cam.aspect }
    } else {
      anchor.current.dist = dist
      anchor.current.aspect = cam.aspect
    }
    const A = anchor.current
    if (rig.current) {
      rig.current.visible = on
      rig.current.position.set(0, 0, 0)
      rig.current.quaternion.copy(A.quat)
    }
    // Layout in the anchor frame (globe at the origin, anchor camera on +z): the Sun sits
    // upper-left beyond the globe; the orbital plane contains both, so Earth is on its orbit.
    const camDist = A.dist
    const vHalf = THREE.MathUtils.degToRad(A.fov / 2)
    const hHalf = Math.atan(Math.tan(vHalf) * A.aspect)
    const zs = camDist + SUN_DEPTH
    _sun.set(-Math.tan(hHalf * 0.62) * zs, Math.tan(vHalf * 0.58) * zs, camDist - zs)
    _earth.set(0, 0, 0)
    solarSun.position.copy(_sun).applyQuaternion(A.quat)
    solarSun.weight = fade.current
    _e1.copy(_earth).sub(_sun)
    const D = _e1.length()
    orbitDist.current = D
    _e1.normalize()
    // Open the plane toward the viewer as far as possible (orbits read as ellipses).
    _n.set(0, 0.38, 0.92).normalize()
    _n.addScaledVector(_e1, -_n.dot(_e1)).normalize()
    _e2.crossVectors(_e1, _n)
    if (sunGroup.current) sunGroup.current.position.copy(_sun)
    if (plane.current) plane.current.quaternion.setFromRotationMatrix(_basis.makeBasis(_e1, _n, _e2))
    if (sunBody.current) sunBody.current.scale.setScalar(D / 46)
    if (light.current) light.current.distance = D * 4
    if (earthOrbit.current) earthOrbit.current.scale.setScalar(D)
    PLANETS.forEach((p, i) => {
      const r = p.k * D
      const o = orbitRefs.current[i]
      if (o) o.scale.setScalar(r)
      const g = planetRefs.current[i]
      if (!g) return
      const a = (time.current / p.period) * Math.PI * 2 + i * 1.7 + 0.9
      g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r)
      g.scale.setScalar(D / 48)
      g.rotation.y += dt * 0.3
    })
    if (corona.current) corona.current.material.rotation += dt * 0.02
    if (moonPivot.current) {
      moonPivot.current.visible = on
      moonPivot.current.rotation.y = (time.current / 110) * Math.PI * 2
    }
    if (moonMesh.current) moonMesh.current.rotation.y = -(time.current / 110) * Math.PI * 2 // tidally locked
  })

  return (
    <>
      <group ref={rig}>
        <group ref={sunGroup}>
          <pointLight ref={light} color="#fff1cf" intensity={0.9} distance={256} decay={0} />
          <group ref={sunBody}>
            <sprite ref={corona} scale={[34, 34, 1]} renderOrder={-1}>
              <spriteMaterial map={assets.halo} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} toneMapped={false} />
            </sprite>
            <sprite scale={[12, 12, 1]} renderOrder={-1}>
              <spriteMaterial map={assets.core} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} toneMapped={false} />
            </sprite>
            <mesh renderOrder={-1} raycast={() => null}>
              <sphereGeometry args={[3, 32, 24]} />
              <meshBasicMaterial color="#ffd54a" fog={false} toneMapped={false} />
            </mesh>
            <HitArea radius={5} spec={CELESTIAL.sun} onSelect={onSelect} />
          </group>
          {/* Orbital plane through the Sun and the globe (x axis points at Earth). */}
          <group ref={plane}>
            <lineLoop ref={earthOrbit} geometry={assets.circle} raycast={() => null}>
              <lineBasicMaterial color="#9fe3ff" transparent opacity={0.32} depthWrite={false} fog={false} />
            </lineLoop>
            {PLANETS.map((p, i) => (
              <group key={p.name}>
                <lineLoop ref={(o) => (orbitRefs.current[i] = o)} geometry={assets.circle} raycast={() => null}>
                  <lineBasicMaterial color="#8fb4e8" transparent opacity={0.16} depthWrite={false} fog={false} />
                </lineLoop>
                <group ref={(g) => (planetRefs.current[i] = g)}>
                  <mesh raycast={() => null}>
                    <sphereGeometry args={[p.radius, 24, 16]} />
                    <meshStandardMaterial
                      color={p.bands ? '#ffffff' : p.color}
                      map={assets.bands[p.name] ?? null}
                      roughness={0.85}
                      metalness={0}
                      fog={false}
                    />
                  </mesh>
                  <HitArea radius={Math.max(p.radius * 2.4, 1.1)} spec={CELESTIAL[p.name.toLowerCase()]} onSelect={onSelect} />
                  {p.ring ? (
                    <mesh rotation={[Math.PI / 2.4, 0, 0]} raycast={() => null}>
                      <ringGeometry args={[p.radius * 1.35, p.radius * 2.3, 48]} />
                      <meshBasicMaterial color="#e6d3a2" transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} fog={false} />
                    </mesh>
                  ) : null}
                </group>
              </group>
            ))}
          </group>
        </group>
      </group>

      {/* The Moon: real size ratio to Earth (0.27 R⊕), artistic distance, 5–15° tilt. */}
      <group rotation={[0.26, 0, 0.12]}>
        <group ref={moonPivot}>
          <mesh ref={moonMesh} position={[6.2, 0, 0]} raycast={() => null}>
            <sphereGeometry args={[0.27, 48, 32]} />
            <meshStandardMaterial map={assets.moon} roughness={1} metalness={0} />
          </mesh>
          <HitArea radius={0.55} position={[6.2, 0, 0]} spec={CELESTIAL.moon} onSelect={onSelect} />
        </group>
      </group>
    </>
  )
}
