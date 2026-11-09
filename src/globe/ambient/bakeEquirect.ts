import * as THREE from 'three'

/**
 * GLSL noise shared by baked layers. Evaluated once at bake time, never per frame.
 */
export const NOISE_GLSL = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 6; i++) { v += a * noise(p); p *= 2.07; a *= 0.5; }
    return v;
  }
`

const bakeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

/**
 * Renders a procedural function of sphere direction into an equirectangular texture
 * (matching THREE.SphereGeometry UVs) exactly once on the GPU.
 * `body` must define `vec4 shade(vec3 dir)`; NOISE_GLSL is prepended.
 */
export function bakeEquirect(
  gl: THREE.WebGLRenderer,
  body: string,
  width: number,
  height: number,
): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    colorSpace: THREE.NoColorSpace,
  })
  const material = new THREE.ShaderMaterial({
    vertexShader: bakeVertex,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      ${NOISE_GLSL}
      ${body}
      void main() {
        float phi = vUv.x * 6.28318530718;
        float theta = (1.0 - vUv.y) * 3.14159265359;
        vec3 dir = vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
        gl_FragColor = shade(dir);
      }
    `,
    depthTest: false,
    depthWrite: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  const scene = new THREE.Scene()
  scene.add(quad)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  const previous = gl.getRenderTarget()
  const prevAutoClear = gl.autoClear
  gl.autoClear = true
  gl.setRenderTarget(target)
  gl.render(scene, camera)
  gl.setRenderTarget(previous)
  gl.autoClear = prevAutoClear

  quad.geometry.dispose()
  material.dispose()
  return target
}
