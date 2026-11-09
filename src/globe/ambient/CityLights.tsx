import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EARTH_RADIUS, latLngToVector3 } from '../navigation/geo'
import { METRO_LIGHTS } from './cityLightsData'
import { getSunDirection } from './useSunDirection'
import { approach, mulberry32 } from './motion'

const vertex = /* glsl */ `
  attribute float aSize;
  uniform vec3 uSun;
  uniform float uPixelRatio;
  varying float vNight;
  void main() {
    vec3 n = normalize(position);
    // Only on the night side, fading through civil twilight.
    vNight = 1.0 - smoothstep(-0.12, 0.04, dot(n, uSun));
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Hide lights on the far hemisphere (depth test handles most, this avoids limb popping).
    vec3 viewN = normalize(normalMatrix * n);
    vNight *= smoothstep(0.0, 0.25, dot(viewN, normalize(-mv.xyz)));
    // Cap growth and fade out at close zoom so lights never balloon into blobs.
    gl_PointSize = aSize * uPixelRatio * min(2.6 / -mv.z, 1.6);
    vNight *= smoothstep(0.45, 1.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

const fragment = /* glsl */ `
  uniform float uOpacity;
  varying float vNight;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float glow = smoothstep(0.5, 0.0, d);
    vec3 col = mix(vec3(1.0, 0.62, 0.25), vec3(1.0, 0.88, 0.6), glow);
    gl_FragColor = vec4(col * glow * vNight * uOpacity, 1.0);
  }
`

/**
 * Night-side city glow built from real metro coordinates (no night texture is bundled).
 * Shown only in showcase mode so it never hints at gameplay answers.
 */
export function CityLights({ opacity }: { opacity: number }) {
  const gl = useThree((s) => s.gl)
  const pointsRef = useRef<THREE.Points>(null)

  const geometry = useMemo(() => {
    const rand = mulberry32(42)
    const perCity = 14
    const total = METRO_LIGHTS.length * perCity
    const positions = new Float32Array(total * 3)
    const sizes = new Float32Array(total)
    let k = 0
    for (const [lat, lng, weight] of METRO_LIGHTS) {
      for (let j = 0; j < perCity; j++) {
        // Gaussian-ish sprawl around the core.
        const spread = 0.35 + weight * 0.9
        const r = Math.abs(rand() + rand() - 1) * spread
        const a = rand() * Math.PI * 2
        const p = latLngToVector3(
          lat + Math.sin(a) * r,
          lng + (Math.cos(a) * r) / Math.max(0.3, Math.cos((lat * Math.PI) / 180)),
          EARTH_RADIUS * 1.003,
        )
        positions[k * 3] = p.x
        positions[k * 3 + 1] = p.y
        positions[k * 3 + 2] = p.z
        sizes[k] = (j === 0 ? 6 : 2 + rand() * 3) * (0.6 + weight * 0.5)
        k++
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    return geo
  }, [])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uSun: { value: new THREE.Vector3(1, 0, 0) },
          uOpacity: { value: 0 },
          uPixelRatio: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame((_, delta) => {
    const u = material.uniforms
    u.uSun.value.copy(getSunDirection())
    u.uPixelRatio.value = gl.getPixelRatio()
    u.uOpacity.value = approach(u.uOpacity.value, opacity, 1.8, Math.min(delta, 0.1))
    if (pointsRef.current) pointsRef.current.visible = u.uOpacity.value > 0.004
  })

  return <points ref={pointsRef} geometry={geometry} material={material} raycast={() => null} renderOrder={1} />
}
