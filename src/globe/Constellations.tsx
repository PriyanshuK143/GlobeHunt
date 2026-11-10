import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { latLngToVector3 } from './navigation/geo'
import { approach } from './ambient/motion'
import { CONSTELLATIONS } from './constellationsData'

/** Celestial sphere radius: beyond the procedural stars' inner shell, inside the nebula. */
const SKY_RADIUS = 95

/** Greenwich mean sidereal time in degrees (accurate to well under a degree). */
function gmstDegrees(ms: number): number {
  const jd = ms / 86_400_000 + 2_440_587.5
  return (((280.46061837 + 360.98564736629 * (jd - 2_451_545)) % 360) + 360) % 360
}

const starVertex = /* glsl */ `
  attribute float aSize;
  uniform float uPixelRatio;
  void main() {
    gl_PointSize = aSize * uPixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const starFragment = /* glsl */ `
  uniform float uOpacity;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, d);
    float glow = smoothstep(0.5, 0.15, d) * 0.35;
    gl_FragColor = vec4(vec3(0.86, 0.92, 1.0) * (core + glow) * uOpacity, 1.0);
  }
`

function labelTexture(text: string): { texture: THREE.CanvasTexture; aspect: number; redraw: () => void } {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  const font = "600 40px 'Orbitron', 'Segoe UI', sans-serif"
  const label = text.toUpperCase()
  ctx.font = font
  c.width = Math.ceil(ctx.measureText(label).width + label.length * 9 + 24)
  c.height = 64
  const texture = new THREE.CanvasTexture(c)
  texture.colorSpace = THREE.SRGBColorSpace
  const redraw = () => {
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.font = font
    ctx.letterSpacing = '9px'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(160, 200, 255, 1)'
    ctx.fillText(label, c.width / 2, c.height / 2)
    texture.needsUpdate = true
  }
  redraw()
  return { texture, aspect: c.width / c.height, redraw }
}

/**
 * Real constellations on the celestial sphere: faint stick figures, their named stars,
 * and quiet labels. The sky is turned by sidereal time, so each constellation sits
 * over the part of Earth it is really above right now.
 */
export function Constellations({ visible }: { visible: boolean }) {
  const gl = useThree((s) => s.gl)
  const group = useRef<THREE.Group>(null)
  const fade = useRef(visible ? 1 : 0)
  const lastSky = useRef(-Infinity)

  const built = useMemo(() => {
    const positions: number[] = []
    const sizes: number[] = []
    const segments: number[] = []
    const labels: Array<{ name: string; position: THREE.Vector3 }> = []
    for (const c of CONSTELLATIONS) {
      const at: Record<string, THREE.Vector3> = {}
      const centre = new THREE.Vector3()
      for (const [id, [ra, dec, mag]] of Object.entries(c.stars)) {
        const p = latLngToVector3(dec, ra * 15, SKY_RADIUS)
        at[id] = p
        centre.add(p)
        positions.push(p.x, p.y, p.z)
        sizes.push(THREE.MathUtils.clamp(5.6 - mag * 1.15, 2.2, 7.5))
      }
      for (const [a, b] of c.lines) segments.push(at[a].x, at[a].y, at[a].z, at[b].x, at[b].y, at[b].z)
      // Label just below the figure's centre.
      const n = centre.normalize()
      const down = new THREE.Vector3(0, -1, 0).addScaledVector(n, n.y).normalize()
      labels.push({ name: c.name, position: n.multiplyScalar(SKY_RADIUS).addScaledVector(down, 5.5) })
    }

    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    starGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
    const starMat = new THREE.ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      uniforms: { uPixelRatio: { value: 1 }, uOpacity: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3))
    const lineMat = new THREE.LineBasicMaterial({
      color: '#8fc2ff',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
    const sprites = labels.map(({ name, position }) => {
      const { texture, aspect, redraw } = labelTexture(name)
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, fog: false })
      const sprite = new THREE.Sprite(material)
      sprite.position.copy(position)
      sprite.scale.set(2.6 * aspect, 2.6, 1)
      sprite.raycast = () => {}
      return { sprite, texture, material, redraw }
    })
    return { starGeo, starMat, lineGeo, lineMat, sprites }
  }, [])

  // Labels are drawn before web fonts load; redraw once Orbitron is ready.
  useEffect(() => {
    let alive = true
    void document.fonts?.ready.then(() => {
      if (alive) built.sprites.forEach((s) => s.redraw())
    })
    return () => {
      alive = false
    }
  }, [built])

  useEffect(
    () => () => {
      built.starGeo.dispose()
      built.starMat.dispose()
      built.lineGeo.dispose()
      built.lineMat.dispose()
      built.sprites.forEach((s) => {
        s.texture.dispose()
        s.material.dispose()
      })
    },
    [built],
  )

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    fade.current = approach(fade.current, visible ? 1 : 0, 1.6, dt)
    const f = fade.current
    if (group.current) {
      group.current.visible = f > 0.01
      // The sky drifts ~0.25° per minute against Earth; refresh it every few seconds.
      const now = Date.now()
      if (now - lastSky.current > 5000) {
        lastSky.current = now
        group.current.rotation.y = THREE.MathUtils.degToRad(-gmstDegrees(now))
      }
    }
    built.starMat.uniforms.uOpacity.value = 0.95 * f
    built.starMat.uniforms.uPixelRatio.value = gl.getPixelRatio()
    built.lineMat.opacity = 0.22 * f
    for (const s of built.sprites) s.material.opacity = 0.42 * f
  })

  return (
    <group ref={group}>
      <lineSegments geometry={built.lineGeo} material={built.lineMat} raycast={() => null} renderOrder={-1} />
      <points geometry={built.starGeo} material={built.starMat} raycast={() => null} renderOrder={-1} />
      {built.sprites.map((s) => (
        <primitive key={s.sprite.uuid} object={s.sprite} />
      ))}
    </group>
  )
}
