import { useMemo } from 'react'
import * as THREE from 'three'
import { EARTH_RADIUS } from './navigation/geo'
import { useSunDirection } from './ambient/useSunDirection'

const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const atmosphereFragment = /* glsl */ `
  uniform vec3 glowColor;
  uniform vec3 twilightColor;
  uniform vec3 sunDirection;
  uniform float coefficient;
  uniform float power;
  uniform float nightFloor;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float intensity = pow(coefficient + dot(vNormal, viewDir), power);
    intensity = clamp(intensity, 0.0, 1.0);

    // Day side scatters more light; night side keeps a faint rim.
    float sunDot = dot(normalize(vWorldNormal), sunDirection);
    float day = smoothstep(-0.35, 0.55, sunDot);
    float twilight = 1.0 - smoothstep(0.0, 0.32, abs(sunDot + 0.05));

    vec3 color = mix(glowColor, twilightColor, twilight * 0.55);
    float lit = mix(nightFloor, 0.7, day) + twilight * 0.12;
    gl_FragColor = vec4(color, 1.0) * intensity * lit;
  }
`

/** Thin, natural Fresnel atmosphere limb (slightly brighter on the sunlit side). */
export function Atmosphere() {
  const uniforms = useMemo(
    () => ({
      glowColor: { value: new THREE.Color('#4db2ff') },
      twilightColor: { value: new THREE.Color('#ff9a5c') },
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
      coefficient: { value: 0.2 },
      power: { value: 6 },
      nightFloor: { value: 0.35 },
    }),
    [],
  )

  useSunDirection((dir) => {
    uniforms.sunDirection.value.copy(dir)
  })

  return (
    <mesh scale={1.022} raycast={() => null}>
      <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
      <shaderMaterial
        vertexShader={atmosphereVertex}
        fragmentShader={atmosphereFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}
