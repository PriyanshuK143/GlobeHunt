import { useMemo } from 'react'
import * as THREE from 'three'
import { EARTH_RADIUS } from './navigation/geo'
import { useSunDirection } from './ambient/useSunDirection'

/** Outer edge of the halo shell (camera never comes closer than 1.08). */
const HALO_RADIUS = EARTH_RADIUS * 1.065

const vertex = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

/** Shared day / night / twilight tint for a direction from Earth's centre. */
const tint = /* glsl */ `
  uniform vec3 dayColor;
  uniform vec3 nightColor;
  uniform vec3 twilightColor;
  uniform vec3 sunDirection;
  uniform float nightFloor;
  vec3 limbTint(vec3 dir, out float lit) {
    float sunDot = dot(dir, sunDirection);
    float day = smoothstep(-0.3, 0.45, sunDot);
    float twilight = 1.0 - smoothstep(0.0, 0.3, abs(sunDot + 0.04));
    vec3 color = mix(nightColor, dayColor, day);
    color = mix(color, twilightColor, twilight * 0.45);
    // The night side keeps a clearly visible rim so the globe never melts into space.
    lit = mix(nightFloor, 1.0, day) + twilight * 0.15;
    return color;
  }
`

/**
 * Halo outside the disk. Per pixel, find how close the view ray passes to Earth's
 * centre: brightest where it grazes the surface, fading out by the shell edge — an even
 * band around the whole limb at any zoom. (Rays that hit Earth are hidden by depth.)
 */
const haloFragment = /* glsl */ `
  uniform float radius;
  uniform float shell;
  uniform float strength;
  varying vec3 vWorldPosition;
  ${tint}
  void main() {
    vec3 rd = normalize(vWorldPosition - cameraPosition);
    vec3 closest = cameraPosition + rd * max(0.0, -dot(cameraPosition, rd));
    float h = length(closest);
    float t = clamp((h - radius) / (shell - radius), 0.0, 1.0);
    float glow = exp(-t * 4.2) * (1.0 - t * t);
    float lit;
    vec3 color = limbTint(normalize(closest), lit);
    gl_FragColor = vec4(color * glow * lit * strength, 1.0);
  }
`

/** Thin haze on the disk edge itself, so the silhouette stays crisp over dark ground. */
const rimFragment = /* glsl */ `
  uniform float strength;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  ${tint}
  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float f = 1.0 - max(dot(n, viewDir), 0.0);
    float rim = pow(f, 3.2);
    float lit;
    vec3 color = limbTint(n, lit);
    gl_FragColor = vec4(color * rim * lit * strength, 1.0);
  }
`

/** Atmosphere: a halo around the limb plus edge haze, brighter on the sunlit side. */
export function Atmosphere() {
  const uniforms = useMemo(() => {
    const shared = {
      dayColor: { value: new THREE.Color('#5cbcff') },
      nightColor: { value: new THREE.Color('#2d6ad8') },
      twilightColor: { value: new THREE.Color('#ff9a5c') },
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
      nightFloor: { value: 0.5 },
    }
    return {
      halo: { ...shared, radius: { value: EARTH_RADIUS }, shell: { value: HALO_RADIUS }, strength: { value: 0.82 } },
      rim: { ...shared, strength: { value: 0.4 } },
    }
  }, [])

  useSunDirection((dir) => {
    // Shared uniform objects: one copy updates both layers.
    uniforms.halo.sunDirection.value.copy(dir)
  })

  return (
    <>
      <mesh scale={HALO_RADIUS / EARTH_RADIUS} raycast={() => null}>
        <sphereGeometry args={[EARTH_RADIUS, 96, 64]} />
        <shaderMaterial
          vertexShader={vertex}
          fragmentShader={haloFragment}
          uniforms={uniforms.halo}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh scale={1.004} raycast={() => null}>
        <sphereGeometry args={[EARTH_RADIUS, 96, 64]} />
        <shaderMaterial
          vertexShader={vertex}
          fragmentShader={rimFragment}
          uniforms={uniforms.rim}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  )
}
