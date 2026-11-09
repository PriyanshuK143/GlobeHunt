import * as THREE from 'three'

const vertex = /* glsl */ `
  attribute vec3 aSide;
  attribute float aEdge;
  attribute float aTime;
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime;
  varying float vEdge;
  varying float vAlpha;
  varying float vAge;

  void main() {
    float age = uTime - aTime;
    float born = step(0.0, age);
    // Fresh smoke is tight; it billows a little, then holds so words stay legible.
    float spread = 0.055 + 0.04 * smoothstep(0.0, 2.5, age) + 0.025 * smoothstep(4.0, 45.0, age);
    float wobble = 0.86 + 0.14 * sin(aSeed * 3.1 + age * 0.4) + 0.08 * sin(aSeed * 7.3 - age * 0.25);
    float w = spread * wobble * aSize * born;
    vec3 p = position + aSide * aEdge * w;
    vEdge = aEdge;
    vAge = max(age, 0.0);
    vAlpha = born * (1.0 - 0.22 * smoothstep(6.0, 70.0, age)) * (0.9 + 0.1 * sin(aSeed * 5.3));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const fragment = /* glsl */ `
  varying float vEdge;
  varying float vAlpha;
  varying float vAge;
  void main() {
    float e = abs(vEdge);
    float soft = 1.0 - smoothstep(0.25, 1.0, e);
    float fresh = exp(-vAge * 1.6);
    vec3 col = mix(vec3(0.74, 0.84, 1.0), vec3(1.0), soft) * (1.0 + 0.5 * fresh);
    gl_FragColor = vec4(col, soft * 0.95 * vAlpha);
  }
`

/** Persistent, luminous skywriting smoke revealed by the aircraft's timeline. */
export function createSmokeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
}
