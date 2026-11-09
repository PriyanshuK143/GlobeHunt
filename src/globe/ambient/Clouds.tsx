import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EARTH_RADIUS } from '../navigation/geo'
import { getSunDirection } from './useSunDirection'
import { approach } from './motion'
import { bakeEquirect } from './bakeEquirect'

const vertex = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vObj = normalize(position);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragment = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform vec3 uSun;

  void main() {
    float cloud = texture2D(uMap, vUv).r;
    float sunDot = dot(normalize(vWorldNormal), uSun);
    float day = smoothstep(-0.15, 0.35, sunDot);
    vec3 col = mix(vec3(0.06, 0.09, 0.16), vec3(1.0), day);
    gl_FragColor = vec4(col, cloud * uOpacity * (0.25 + 0.75 * day));
  }
`

// Weather-band cloud cover, baked once (was evaluated per pixel per frame).
const CLOUD_SHADE = /* glsl */ `
  vec4 shade(vec3 d) {
    vec3 p = d * 3.2;
    p.y *= 1.6;
    float n = fbm(p + fbm(p * 0.7) * 0.9);
    float c = smoothstep(0.52, 0.78, n);
    return vec4(c, c, c, 1.0);
  }
`

interface CloudsProps {
  /** Target opacity; animated toward smoothly. 0 hides the layer entirely. */
  opacity: number
  animate: boolean
}

/**
 * Procedural cloud shell (no texture asset). Decorative only: it fades out
 * completely during gameplay so it never hides geography.
 */
export function Clouds({ opacity, animate }: CloudsProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const gl = useThree((s) => s.gl)
  const target = useMemo(() => bakeEquirect(gl, CLOUD_SHADE, 2048, 1024), [gl])
  useEffect(() => () => target.dispose(), [target])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uMap: { value: target.texture },
          uOpacity: { value: 0 },
          uSun: { value: new THREE.Vector3(1, 0, 0) },
        },
        transparent: true,
        depthWrite: false,
      }),
    [target],
  )
  useEffect(() => () => material.dispose(), [material])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const u = material.uniforms
    // Slow eastward drift by rotating the shell (cheap; no per-pixel noise).
    if (animate && meshRef.current) meshRef.current.rotation.y += dt * 0.004
    u.uOpacity.value = approach(u.uOpacity.value, opacity, 1.8, dt)
    u.uSun.value.copy(getSunDirection())
    if (meshRef.current) meshRef.current.visible = u.uOpacity.value > 0.004
  })

  return (
    <mesh ref={meshRef} material={material} raycast={() => null} renderOrder={2}>
      <sphereGeometry args={[EARTH_RADIUS * 1.012, 64, 48]} />
    </mesh>
  )
}
