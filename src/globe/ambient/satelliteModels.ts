import * as THREE from 'three'
import type { SatelliteKind } from './orbits'

/**
 * Low-poly satellite kit. Geometries and materials are created once per scene,
 * shared by every satellite instance, and disposed together.
 * Local frame: +Z faces Earth (via lookAt), +Y follows the orbit normal.
 */
export class SatelliteKit {
  readonly geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
    cone: new THREE.ConeGeometry(1, 1, 12, 1, true),
    beacon: new THREE.SphereGeometry(1, 8, 6),
  }

  readonly materials = {
    gold: new THREE.MeshStandardMaterial({ color: '#c9a050', metalness: 0.75, roughness: 0.35 }),
    panel: new THREE.MeshStandardMaterial({
      color: '#1d3f86',
      emissive: '#0c2a66',
      emissiveIntensity: 0.55,
      metalness: 0.35,
      roughness: 0.35,
    }),
    white: new THREE.MeshStandardMaterial({ color: '#dfe6ee', metalness: 0.2, roughness: 0.55 }),
    dark: new THREE.MeshStandardMaterial({ color: '#283142', metalness: 0.4, roughness: 0.5 }),
    dish: new THREE.MeshStandardMaterial({
      color: '#eef3f8',
      metalness: 0.1,
      roughness: 0.4,
      side: THREE.DoubleSide,
    }),
    beaconRed: new THREE.MeshBasicMaterial({ color: '#ff5d5d', toneMapped: false }),
    beaconCyan: new THREE.MeshBasicMaterial({ color: '#7ff3ff', toneMapped: false }),
  }

  private part(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    scale: [number, number, number],
    position: [number, number, number] = [0, 0, 0],
    rotation: [number, number, number] = [0, 0, 0],
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, mat)
    mesh.scale.set(...scale)
    mesh.position.set(...position)
    mesh.rotation.set(...rotation)
    mesh.raycast = () => {}
    return mesh
  }

  /** Returns the model and its blinking beacon mesh. */
  build(kind: SatelliteKind): { model: THREE.Group; beacon: THREE.Mesh } {
    const g = this.geometries
    const m = this.materials
    const model = new THREE.Group()
    let beacon: THREE.Mesh

    if (kind === 'comm') {
      model.add(this.part(g.box, m.gold, [0.014, 0.014, 0.02]))
      model.add(this.part(g.box, m.panel, [0.036, 0.012, 0.0012], [0.027, 0, 0]))
      model.add(this.part(g.box, m.panel, [0.036, 0.012, 0.0012], [-0.027, 0, 0]))
      model.add(this.part(g.box, m.white, [0.006, 0.002, 0.002], [0.009, 0, 0]))
      model.add(this.part(g.box, m.white, [0.006, 0.002, 0.002], [-0.009, 0, 0]))
      model.add(this.part(g.cone, m.dish, [0.008, 0.005, 0.008], [0, 0, 0.0125], [-Math.PI / 2, 0, 0]))
      beacon = this.part(g.beacon, m.beaconRed, [0.0022, 0.0022, 0.0022], [0, 0.0085, -0.006])
    } else if (kind === 'observer') {
      model.add(this.part(g.cylinder, m.white, [0.0075, 0.026, 0.0075], [0, 0, 0], [Math.PI / 2, 0, 0]))
      model.add(this.part(g.cylinder, m.dark, [0.005, 0.004, 0.005], [0, 0, 0.015], [Math.PI / 2, 0, 0]))
      model.add(this.part(g.box, m.gold, [0.012, 0.01, 0.008], [0, 0, -0.014]))
      model.add(this.part(g.box, m.panel, [0.044, 0.014, 0.0012], [0.03, 0, -0.006]))
      beacon = this.part(g.beacon, m.beaconCyan, [0.002, 0.002, 0.002], [0, 0.008, -0.01])
    } else {
      // Space station: truss along Y with four solar-array wings and a module stack.
      model.add(this.part(g.box, m.white, [0.005, 0.12, 0.005]))
      for (const y of [-0.052, -0.036, 0.036, 0.052]) {
        model.add(this.part(g.box, m.panel, [0.05, 0.012, 0.001], [0.03, y, 0]))
        model.add(this.part(g.box, m.panel, [0.05, 0.012, 0.001], [-0.03, y, 0]))
      }
      model.add(this.part(g.cylinder, m.white, [0.0065, 0.046, 0.0065], [0, 0, 0], [0, 0, Math.PI / 2]))
      model.add(this.part(g.cylinder, m.gold, [0.0055, 0.02, 0.0055], [0, 0, 0.012], [Math.PI / 2, 0, 0]))
      model.add(this.part(g.box, m.white, [0.014, 0.002, 0.018], [0, 0.016, -0.004]))
      model.add(this.part(g.box, m.white, [0.014, 0.002, 0.018], [0, -0.016, -0.004]))
      beacon = this.part(g.beacon, m.beaconRed, [0.0028, 0.0028, 0.0028], [0, 0.062, 0])
    }

    model.add(beacon)
    return { model, beacon }
  }

  dispose(): void {
    Object.values(this.geometries).forEach((geo) => geo.dispose())
    Object.values(this.materials).forEach((mat) => mat.dispose())
  }
}
