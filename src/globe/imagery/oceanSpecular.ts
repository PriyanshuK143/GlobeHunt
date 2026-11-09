import type * as THREE from 'three'

export const SURFACE_GAIN = 1.3

/**
 * Shared colour grade for every Earth surface material (base map + detail tiles):
 * brightness, saturation and a gentle green lift, animated per mode by GlobeLights.
 */
export const surfaceGrade = {
  uGain: { value: 1.45 },
  uSat: { value: 1.15 },
  uGreen: { value: 1.0 },
}

/**
 * Grade + glossier water on a MeshStandardMaterial: Blue Marble albedo is true-to-life
 * dark, so it is lifted and saturated to read like a bright, Google-Maps-style globe;
 * blue-dominant pixels get lower roughness so oceans catch a soft glint.
 */
export function applyOceanSpecular(material: THREE.MeshStandardMaterial): void {
  material.color.setScalar(1)
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, surfaceGrade)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uGain;
        uniform float uSat;
        uniform float uGreen;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 graded = mix(vec3(luma), diffuseColor.rgb, uSat) * uGain;
          // Lift vegetation (green-dominant land) a touch for a map-like palette.
          float veg = smoothstep(0.0, 0.08, diffuseColor.g - max(diffuseColor.r, diffuseColor.b) + 0.03);
          graded.g *= mix(1.0, uGreen, veg);
          diffuseColor.rgb = min(graded, vec3(1.0));
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        float oceanMask = smoothstep(0.06, 0.22, diffuseColor.b - max(diffuseColor.r, diffuseColor.g));
        roughnessFactor = mix(roughnessFactor, 0.42, oceanMask);
      `,
      )
  }
  material.customProgramCacheKey = () => 'ocean-specular-graded'
}
