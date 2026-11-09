import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mulberry32 } from './ambient/motion'

const vertex = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uTwinkle;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    float tw = sin(uTime * (0.6 + fract(aPhase * 7.13) * 1.8) + aPhase * 6.2831);
    vAlpha = mix(0.85, 0.55 + 0.45 * tw, uTwinkle * step(0.55, fract(aPhase * 3.7)));
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio;
    gl_Position = projectionMatrix * mv;
  }
`

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * core * vAlpha, 1.0);
  }
`

const STAR_TINTS = ['#cfe7ff', '#ffffff', '#ffe9c7', '#bcd4ff', '#ffd2b0']

interface StarfieldProps {
  count?: number
  /** 0 disables twinkle (reduced motion). */
  twinkle?: number
}

/** Procedural starfield: per-star size, tint and gentle twinkle in a single draw call. */
export function Starfield({ count = 2200, twinkle = 1 }: StarfieldProps) {
  const gl = useThree((s) => s.gl)

  const geometry = useMemo(() => {
    const rand = mulberry32(1337)
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)
    const colors = new Float32Array(count * 3)
    const tint = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const r = 60 + rand() * 50
      const theta = rand() * Math.PI * 2
      const phi = Math.acos(2 * rand() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
      // Mostly faint distant stars, a few bright ones.
      const bright = rand()
      sizes[i] = bright > 0.985 ? 3.2 + rand() * 1.4 : bright > 0.9 ? 2.0 + rand() : 0.9 + rand() * 1.0
      phases[i] = rand()
      tint.set(STAR_TINTS[Math.floor(rand() * STAR_TINTS.length)])
      const dim = bright > 0.9 ? 1 : 0.45 + rand() * 0.4
      colors[i * 3] = tint.r * dim
      colors[i * 3 + 1] = tint.g * dim
      colors[i * 3 + 2] = tint.b * dim
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [count])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uTwinkle: { value: twinkle },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uPixelRatio.value = gl.getPixelRatio()
    material.uniforms.uTwinkle.value = twinkle
  })

  return <points geometry={geometry} material={material} raycast={() => null} renderOrder={-1} />
}
