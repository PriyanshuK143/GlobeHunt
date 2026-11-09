import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CREDIT_BLOCKS } from './creditLines'
import { buildFlightPlan, positionAt, sampleIndex, type Box, type FlightPlan } from './flightPlan'
import { createSmokeMaterial } from './smokeMaterial'
import { Fighter } from './Fighter'
import { mulberry32 } from '../../globe/ambient/motion'
import { audio } from '../../audio'

const FOV = 38
const OVERVIEW_DELAY = 1.6

/* ───────── Environment ───────── */

function SkyGradient() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vec3 top = vec3(0.01, 0.025, 0.07);
            vec3 mid = vec3(0.03, 0.08, 0.18);
            vec3 low = vec3(0.09, 0.2, 0.38);
            vec3 c = mix(low, mid, smoothstep(0.0, 0.45, vUv.y));
            c = mix(c, top, smoothstep(0.45, 1.0, vUv.y));
            gl_FragColor = vec4(c, 1.0);
          }
        `,
        depthWrite: false,
        depthTest: false,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  return (
    <mesh material={material} frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}

function Stars() {
  const geometry = useMemo(() => {
    const n = 900
    const rand = mulberry32(7)
    const p = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      p[i * 3] = (rand() - 0.5) * 900
      p[i * 3 + 1] = -40 + rand() * 420
      p[i * 3 + 2] = -320 - rand() * 60
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <points geometry={geometry}>
      <pointsMaterial color="#cfe2ff" size={1.6} sizeAttenuation={false} transparent opacity={0.7} depthWrite={false} />
    </points>
  )
}

const rimVertex = /* glsl */ `
  varying vec3 vN; varying vec3 vW;
  void main() {
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const rimFragment = /* glsl */ `
  varying vec3 vN; varying vec3 vW;
  void main() {
    vec3 v = normalize(cameraPosition - vW);
    float f = pow(1.0 - abs(dot(normalize(vN), v)), 6.0);
    gl_FragColor = vec4(vec3(0.3, 0.6, 1.0) * f * 0.55, f);
  }
`

/** Distant Earth curvature along the bottom of the sky. */
function EarthHorizon({ center }: { center: Box }) {
  const rim = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: rimVertex,
        fragmentShader: rimFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      }),
    [],
  )
  useEffect(() => () => rim.dispose(), [rim])
  const R = 620
  const pos: [number, number, number] = [center.cx, center.cy - center.h / 2 - 60 - R, -280]
  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[R, 96, 48]} />
        <meshStandardMaterial color="#0e2a4c" roughness={0.95} metalness={0} />
      </mesh>
      <mesh material={rim} scale={1.012}>
        <sphereGeometry args={[R, 96, 48]} />
      </mesh>
    </group>
  )
}

/* ───────── Skywriter ───────── */

function frameFor(box: Box, aspect: number, margin: number): THREE.Vector3 {
  const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
  const zH = (box.h / 2 + margin) / t
  const zW = (box.w / 2 + margin * 1.2) / (t * aspect)
  return new THREE.Vector3(box.cx, box.cy, Math.max(zH, zW, 7))
}

interface SkywriterProps {
  plan: FlightPlan
  startAt: number
  skipToken: number
  onComplete: () => void
  onLine: (line: number) => void
}

const _pos = new THREE.Vector3()
const _ahead = new THREE.Vector3()
const _behind = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _fwdPrev = new THREE.Vector3()
const _fwdNext = new THREE.Vector3()
const _up = new THREE.Vector3()
const _look = new THREE.Vector3()
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const PLANE_NORMAL = new THREE.Vector3(0, 0, 1)

function Skywriter({ plan, startAt, skipToken, onComplete, onLine }: SkywriterProps) {
  const { camera, size } = useThree()
  const plane = useRef<THREE.Group>(null)
  const time = useRef(startAt)
  const completed = useRef(false)
  const lastLine = useRef(-1)
  const frame = useRef<THREE.Vector3 | null>(null)
  const bank = useRef(0)

  const smoke = useMemo(() => {
    const r = plan.ribbon
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(r.center, 3))
    g.setAttribute('aSide', new THREE.BufferAttribute(r.side, 3))
    g.setAttribute('aEdge', new THREE.BufferAttribute(r.edge, 1))
    g.setAttribute('aTime', new THREE.BufferAttribute(r.time, 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(r.seed, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(r.size, 1))
    g.setIndex(new THREE.BufferAttribute(r.index, 1))
    g.computeBoundingSphere()
    return { geometry: g, material: createSmokeMaterial() }
  }, [plan])
  useEffect(
    () => () => {
      smoke.geometry.dispose()
      smoke.material.dispose()
    },
    [smoke],
  )

  useEffect(() => {
    if (skipToken > 0) time.current = Math.max(time.current, plan.writeEnd + 0.01)
  }, [skipToken, plan])

  // Stylised aircraft air-rush, panned with the jet. Stops when it leaves or on unmount.
  const audioFrame = useRef(0)
  const lastPos = useRef(new THREE.Vector3())
  useEffect(() => {
    audio.startAircraft()
    return () => audio.stopAircraft()
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    time.current += dt
    const t = time.current
    smoke.material.uniforms.uTime.value = t

    // Aircraft pose: position on the route, heading along it, banking into turns.
    const g = plane.current
    if (g) {
      const flying = t < plan.totalTime
      g.visible = flying
      if (flying) {
        positionAt(plan, t, _pos)
        positionAt(plan, t + 0.06, _ahead)
        positionAt(plan, t - 0.06, _behind)
        _fwd.copy(_ahead).sub(_behind)
        if (_fwd.lengthSq() > 1e-10) _fwd.normalize()
        positionAt(plan, t - 0.18, _look)
        _fwdPrev.copy(_pos).sub(_look).normalize()
        positionAt(plan, t + 0.18, _look)
        _fwdNext.copy(_look).sub(_pos).normalize()
        // Signed turn rate in the writing plane → bank angle.
        const turn = _fwdPrev.clone().cross(_fwdNext).dot(PLANE_NORMAL)
        const targetBank = THREE.MathUtils.clamp(-turn * 2.6, -1.15, 1.15)
        bank.current += (targetBank - bank.current) * (1 - Math.exp(-dt * 8))

        // Top of the aircraft faces the viewer (planform visible), rolled by bank.
        _up.copy(PLANE_NORMAL).addScaledVector(_fwd, -PLANE_NORMAL.dot(_fwd)).normalize()
        if (_up.lengthSq() < 1e-6) _up.set(0, 1, 0)
        _up.applyAxisAngle(_fwd, bank.current)
        _look.copy(_pos).add(_fwd)
        // Same convention as Object3D.lookAt: local +Z (the nose) faces the heading.
        _m.lookAt(_look, _pos, _up)
        _q.setFromRotationMatrix(_m)
        g.position.copy(_pos)
        g.quaternion.slerp(_q, 1 - Math.exp(-dt * 20))

        if (++audioFrame.current % 3 === 0) {
          const speed = lastPos.current.distanceTo(_pos) / Math.max(1e-3, dt * 3)
          lastPos.current.copy(_pos)
          _look.copy(_pos).project(camera)
          const smoking = plan.smoke[sampleIndex(plan, t)] === 1
          audio.updateAircraft(_look.x, Math.min(1, speed / 14), smoking)
        }
      } else if (audioFrame.current >= 0) {
        audioFrame.current = -1
        audio.stopAircraft()
      }
    }

    // Camera: frame the block being written; finish on a full-sky overview.
    const aspect = size.width / Math.max(1, size.height)
    const overview = t >= plan.writeEnd + OVERVIEW_DELAY
    const idx = sampleIndex(plan, t)
    const target = overview
      ? frameFor(plan.overview, aspect, 2.2)
      : frameFor(plan.blocks[plan.block[idx]], aspect, 1.7)
    if (!frame.current) frame.current = target.clone()
    frame.current.lerp(target, 1 - Math.exp(-dt * (overview ? 0.9 : 1.25)))
    const f = frame.current
    camera.position.set(f.x, f.y - f.z * 0.12, f.z)
    camera.lookAt(f.x, f.y, 0)

    const line = plan.line[idx]
    if (line !== lastLine.current) {
      lastLine.current = line
      onLine(line)
    }
    if (!completed.current && t >= plan.writeEnd + 0.4) {
      completed.current = true
      onComplete()
    }
  })

  return (
    <>
      <mesh geometry={smoke.geometry} material={smoke.material} frustumCulled={false} renderOrder={5} />
      <Fighter ref={plane} scale={1.45} />
    </>
  )
}

interface SkywriteSceneProps {
  reducedMotion: boolean
  skipToken: number
  onComplete: () => void
  onLine: (line: number) => void
}

/** Cinematic skywriting: a fighter writes every credit line with its smoke trail. */
export function SkywriteScene({ reducedMotion, skipToken, onComplete, onLine }: SkywriteSceneProps) {
  const plan = useMemo(() => buildFlightPlan(CREDIT_BLOCKS), [])

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: FOV, near: 0.1, far: 2000, position: [0, 0, 30] }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => gl.setClearColor('#030a1a')}
    >
      <SkyGradient />
      <Stars />
      <ambientLight intensity={0.55} color="#9fc0ff" />
      <directionalLight position={[8, 10, 12]} intensity={1.6} color="#fff3e2" />
      <directionalLight position={[-6, -4, 6]} intensity={0.4} color="#5d8cff" />
      <EarthHorizon center={plan.overview} />
      <Skywriter
        plan={plan}
        startAt={reducedMotion ? plan.totalTime : 0}
        skipToken={skipToken}
        onComplete={onComplete}
        onLine={onLine}
      />
    </Canvas>
  )
}
