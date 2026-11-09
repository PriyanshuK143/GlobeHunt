import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { EARTH_RADIUS, latLngToVector3, vector3ToLatLng } from '../navigation/geo'
import type { MarkerStore } from './markerStore'
import { raySurfacePoint } from './surfaceRay'

const MARKER_RADIUS = EARTH_RADIUS * 1.0022
/** On-screen ring radius in CSS pixels (kept constant at every zoom). */
const RING_PX = 13
const PLACE_SECONDS = 0.28
const PULSE_SECONDS = 0.9
const RED = '#ff3d2e'

const glowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float glow = smoothstep(1.0, 0.3, d) * 0.5;
    gl_FragColor = vec4(uColor, glow * uAlpha);
  }
`
const glowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

function overlayMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -12,
    polygonOffsetUnits: -48,
    side: THREE.DoubleSide,
  })
}

interface LocationMarkerProps {
  store: MarkerStore
  /** When false the reticle is display-only (e.g. showing a guess after the round). */
  interactive: boolean
}

const _ndc = new THREE.Vector2()
const _raycaster = new THREE.Raycaster()
const _point = new THREE.Vector3()
const _outward = new THREE.Vector3()

/**
 * Red targeting reticle on the Earth's surface. Click-placed via the pick layer,
 * draggable with mouse or touch. Dragging raycasts the exact Earth sphere each move,
 * so the reticle never leaves the surface; past the limb it clamps to the horizon.
 * Orbit controls are suspended for the duration of a drag.
 */
export function LocationMarker({ store, interactive }: LocationMarkerProps) {
  const { camera, gl, size, controls } = useThree()
  const group = useRef<THREE.Group>(null)
  const pulse = useRef<THREE.Mesh>(null)
  const anim = useRef({ place: 1, pulse: 1, placements: store.get().placements, visible: 0 })
  const dragging = useRef(false)

  const parts = useMemo(() => {
    const materials = {
      shadow: overlayMaterial('#05080f', 0.5),
      ring: overlayMaterial(RED, 1),
      dot: overlayMaterial('#fff1ec', 1),
      dotRim: overlayMaterial(RED, 1),
      ticks: overlayMaterial(RED, 0.9),
      pulse: overlayMaterial(RED, 0),
      hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      glow: new THREE.ShaderMaterial({
        vertexShader: glowVertex,
        fragmentShader: glowFragment,
        uniforms: { uColor: { value: new THREE.Color(RED) }, uAlpha: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -12,
        polygonOffsetUnits: -48,
      }),
    }
    const tick = new THREE.PlaneGeometry(0.1, 0.42)
    const geometries = {
      shadow: new THREE.RingGeometry(0.78, 1.12, 64),
      ring: new THREE.RingGeometry(0.86, 1.0, 64),
      dotRim: new THREE.CircleGeometry(0.2, 24),
      dot: new THREE.CircleGeometry(0.11, 24),
      pulse: new THREE.RingGeometry(0.9, 1.0, 64),
      glow: new THREE.PlaneGeometry(4.4, 4.4),
      hit: new THREE.CircleGeometry(2.3, 24),
      tick,
    }
    return { materials, geometries }
  }, [])

  useEffect(
    () => () => {
      Object.values(parts.materials).forEach((m) => m.dispose())
      Object.values(parts.geometries).forEach((g) => g.dispose())
    },
    [parts],
  )

  const setControlsEnabled = (enabled: boolean) => {
    const c = controls as unknown as { enabled: boolean } | null
    if (c) c.enabled = enabled
  }

  const pointerToSurface = (clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect()
    _ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    _raycaster.setFromCamera(_ndc, camera)
    raySurfacePoint(_raycaster.ray, _point)
    return vector3ToLatLng(_point)
  }

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (!interactive || !store.get().position) return
    event.stopPropagation()
    const pointerId = event.pointerId
    dragging.current = true
    // Runs before OrbitControls' own pointerdown listener, so it never starts rotating.
    setControlsEnabled(false)
    store.setDragging(true)
    document.body.style.cursor = 'grabbing'

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      e.preventDefault()
      store.drag(pointerToSurface(e.clientX, e.clientY))
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      dragging.current = false
      setControlsEnabled(true)
      store.setDragging(false)
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  // Safety: never leave the controls disabled if we unmount mid-drag.
  useEffect(
    () => () => {
      if (dragging.current) {
        setControlsEnabled(true)
        document.body.style.cursor = ''
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(delta, 0.1)
    const { position, placements } = store.get()
    const a = anim.current

    if (placements !== a.placements) {
      a.placements = placements
      a.place = 0
      a.pulse = 0
    }
    a.visible = position ? 1 : 0
    g.visible = a.visible > 0
    if (!position) return

    latLngToVector3(position.lat, position.lng, MARKER_RADIUS).toArray().forEach((v, i) => g.position.setComponent(i, v))
    _outward.copy(g.position).multiplyScalar(2)
    g.lookAt(_outward)

    // Constant screen size: world units per pixel at the marker's distance.
    const cam = camera as THREE.PerspectiveCamera
    const dist = camera.position.distanceTo(g.position)
    const worldPerPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / size.height
    const base = worldPerPx * RING_PX

    a.place = Math.min(1, a.place + dt / PLACE_SECONDS)
    const ease = 1 - Math.pow(1 - a.place, 3)
    const lift = dragging.current ? 1.12 : 1
    g.scale.setScalar(base * (1.7 - 0.7 * ease) * lift)
    const alpha = ease
    parts.materials.ring.opacity = alpha
    parts.materials.shadow.opacity = 0.5 * alpha
    parts.materials.dot.opacity = alpha
    parts.materials.dotRim.opacity = alpha
    parts.materials.ticks.opacity = 0.9 * alpha
    parts.materials.glow.uniforms.uAlpha.value = alpha * (dragging.current ? 1.25 : 0.85)

    a.pulse = Math.min(1, a.pulse + dt / PULSE_SECONDS)
    if (pulse.current) {
      const p = a.pulse
      pulse.current.scale.setScalar(1 + p * 1.8)
      parts.materials.pulse.opacity = p < 1 ? (1 - p) * 0.85 : 0
    }
  })

  const { geometries: geo, materials: mat } = parts
  const ticks = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]

  return (
    <group ref={group} visible={false} renderOrder={20}>
      <mesh geometry={geo.glow} material={mat.glow} renderOrder={20} raycast={() => null} />
      <mesh geometry={geo.shadow} material={mat.shadow} renderOrder={21} raycast={() => null} />
      <mesh geometry={geo.ring} material={mat.ring} renderOrder={22} raycast={() => null} />
      {ticks.map((angle) => (
        <mesh
          key={angle}
          geometry={geo.tick}
          material={mat.ticks}
          rotation={[0, 0, angle]}
          position={[Math.sin(-angle) * 1.36, Math.cos(angle) * 1.36, 0]}
          renderOrder={22}
          raycast={() => null}
        />
      ))}
      <mesh geometry={geo.dotRim} material={mat.dotRim} renderOrder={23} raycast={() => null} />
      <mesh geometry={geo.dot} material={mat.dot} renderOrder={24} raycast={() => null} />
      <mesh ref={pulse} geometry={geo.pulse} material={mat.pulse} renderOrder={22} raycast={() => null} />
      <mesh
        geometry={geo.hit}
        material={mat.hit}
        onPointerDown={handlePointerDown}
        onPointerOver={() => {
          if (interactive && !dragging.current) document.body.style.cursor = 'grab'
        }}
        onPointerOut={() => {
          if (!dragging.current) document.body.style.cursor = ''
        }}
      />
    </group>
  )
}
