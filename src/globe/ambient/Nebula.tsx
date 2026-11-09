import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { bakeEquirect } from './bakeEquirect'

// Faint nebula gradients + a soft galactic band, baked once into a texture.
const NEBULA_SHADE = /* glsl */ `
  vec4 shade(vec3 d) {
    float n = fbm(d * 2.4 + vec3(3.1, 0.7, 5.2));
    float m = fbm(d * 4.1 - vec3(1.3, 4.2, 0.5));
    float band = exp(-pow(dot(d, normalize(vec3(0.35, 0.9, -0.25))) * 2.6, 2.0));
    vec3 deep = vec3(0.05, 0.08, 0.22);
    vec3 violet = vec3(0.16, 0.07, 0.24);
    vec3 teal = vec3(0.03, 0.16, 0.2);
    vec3 col = mix(deep, violet, smoothstep(0.45, 0.75, n));
    col = mix(col, teal, smoothstep(0.55, 0.8, m) * 0.6);
    float a = smoothstep(0.38, 0.85, n) * (0.35 + band * 0.9);
    return vec4(col * a, 1.0);
  }
`

/** Distant nebula on a back-faced sky sphere (one texture lookup per pixel). */
export function Nebula({ strength = 1 }: { strength?: number }) {
  const gl = useThree((s) => s.gl)
  const target = useMemo(() => bakeEquirect(gl, NEBULA_SHADE, 1024, 512), [gl])
  useEffect(() => () => target.dispose(), [target])

  return (
    <mesh raycast={() => null} renderOrder={-2}>
      <sphereGeometry args={[150, 48, 32]} />
      <meshBasicMaterial
        map={target.texture}
        color={new THREE.Color(strength, strength, strength)}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        fog={false}
        toneMapped={false}
      />
    </mesh>
  )
}
