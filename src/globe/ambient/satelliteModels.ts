import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { SatelliteKind } from './orbits'

/**
 * Procedural spacecraft modelled on the real ones (ISS, Hubble, GPS III, Landsat-class
 * Earth observers), built from primitives with generated textures — no downloads.
 *
 * Local frame: +Z faces Earth (via lookAt), +Y follows the orbit normal, X ≈ along-track.
 * Solar arrays sit in `wings` pivots that the orbit system turns about Y to face the Sun,
 * exactly how real arrays (and the ISS alpha joints) track it.
 *
 * Parts are merged per material, so each satellite is a handful of draw calls.
 */

type MatKey =
  | 'goldFoil'
  | 'silverFoil'
  | 'cellsBlue'
  | 'cellsAmber'
  | 'cellsHubble'
  | 'module'
  | 'radiator'
  | 'aluminium'
  | 'dark'
  | 'dish'
  | 'truss'

type Vec3 = [number, number, number]

/* ───────── Generated textures ───────── */

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return [c, c.getContext('2d')!]
}

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Photovoltaic blanket: cells with a faint sheen, thin metal gaps and busbars. */
function solarCells(cols: number, rows: number, cell: [number, number, number], gap: string, seed: number): HTMLCanvasElement {
  const size = 256
  const [c, ctx] = canvas(size)
  const r = rng(seed)
  ctx.fillStyle = gap
  ctx.fillRect(0, 0, size, size)
  const cw = size / cols
  const ch = size / rows
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const k = 0.86 + r() * 0.22
      const [h, s, l] = cell
      const px = x * cw + 1.5
      const py = y * ch + 1.5
      const g = ctx.createLinearGradient(px, py, px + cw, py + ch)
      g.addColorStop(0, `hsl(${h}, ${s}%, ${l * k * 1.18}%)`)
      g.addColorStop(0.55, `hsl(${h}, ${s}%, ${l * k}%)`)
      g.addColorStop(1, `hsl(${h}, ${s}%, ${l * k * 0.82}%)`)
      ctx.fillStyle = g
      ctx.fillRect(px, py, cw - 3, ch - 3)
      // fine contact fingers across each cell
      ctx.strokeStyle = 'rgba(210, 220, 235, 0.10)'
      ctx.lineWidth = 0.6
      for (let i = 1; i < 6; i++) {
        ctx.beginPath()
        ctx.moveTo(px, py + ((ch - 3) * i) / 6)
        ctx.lineTo(px + cw - 3, py + ((ch - 3) * i) / 6)
        ctx.stroke()
      }
    }
  }
  // busbars between cell strings
  ctx.fillStyle = 'rgba(220, 226, 236, 0.55)'
  for (let x = 1; x < cols; x += 2) ctx.fillRect(x * cw - 1, 0, 2, size)
  // panel frame
  ctx.strokeStyle = 'rgba(200, 206, 216, 0.9)'
  ctx.lineWidth = 5
  ctx.strokeRect(2.5, 2.5, size - 5, size - 5)
  return c
}

/** Crinkled multi-layer insulation: colour map + matching bump map. */
function foil(base: [number, number, number], seed: number): { map: HTMLCanvasElement; bump: HTMLCanvasElement } {
  const size = 256
  const [map, m] = canvas(size)
  const [bump, b] = canvas(size)
  const r = rng(seed)
  const [h, s, l] = base
  m.fillStyle = `hsl(${h}, ${s}%, ${l}%)`
  m.fillRect(0, 0, size, size)
  b.fillStyle = '#808080'
  b.fillRect(0, 0, size, size)
  for (let i = 0; i < 420; i++) {
    const x = r() * size
    const y = r() * size
    const w = 10 + r() * 40
    const hgt = 6 + r() * 26
    const a = r() * Math.PI
    const shade = r()
    const pts: Array<[number, number]> = []
    for (let k = 0; k < 4; k++) {
      const ang = a + (k * Math.PI) / 2 + (r() - 0.5) * 0.7
      pts.push([x + Math.cos(ang) * w * (0.5 + r() * 0.5), y + Math.sin(ang) * hgt * (0.5 + r() * 0.5)])
    }
    const draw = (ctx: CanvasRenderingContext2D, fill: string) => {
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1])
      ctx.closePath()
      ctx.fillStyle = fill
      ctx.fill()
    }
    draw(m, `hsla(${h + (shade - 0.5) * 6}, ${s}%, ${l * (0.8 + shade * 0.4)}%, 0.16)`)
    draw(b, `rgba(${Math.round(shade * 255)}, ${Math.round(shade * 255)}, ${Math.round(shade * 255)}, 0.22)`)
  }
  // creases
  for (let i = 0; i < 26; i++) {
    const x = r() * size
    const y = r() * size
    const len = 10 + r() * 50
    const a = r() * Math.PI * 2
    for (const [ctx, col] of [
      [m, `hsla(${h}, ${s}%, ${l * 1.3}%, 0.18)`],
      [b, 'rgba(255,255,255,0.4)'],
    ] as const) {
      ctx.strokeStyle = col
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
      ctx.stroke()
    }
  }
  return { map, bump }
}

/** Off-white pressurised-module skin: blanket seams and a few darker patches. */
function moduleSkin(): HTMLCanvasElement {
  const [c, ctx] = canvas(128)
  const r = rng(11)
  ctx.fillStyle = '#e9e5dc'
  ctx.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = `rgba(150, 140, 120, ${0.05 + r() * 0.1})`
    ctx.fillRect(r() * 128, r() * 128, 8 + r() * 26, 6 + r() * 18)
  }
  ctx.strokeStyle = 'rgba(120, 112, 98, 0.45)'
  ctx.lineWidth = 1
  for (let x = 0; x <= 128; x += 32) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 128)
    ctx.stroke()
  }
  for (let y = 0; y <= 128; y += 21) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(128, y)
    ctx.stroke()
  }
  return c
}

/** Radiator panel: white with fine fluid-loop ribs. */
function radiatorSkin(): HTMLCanvasElement {
  const [c, ctx] = canvas(128)
  ctx.fillStyle = '#f1f1ec'
  ctx.fillRect(0, 0, 128, 128)
  ctx.fillStyle = 'rgba(150, 156, 165, 0.35)'
  for (let x = 4; x < 128; x += 8) ctx.fillRect(x, 0, 1.4, 128)
  ctx.strokeStyle = 'rgba(120, 126, 135, 0.6)'
  ctx.lineWidth = 3
  ctx.strokeRect(1.5, 1.5, 125, 125)
  return c
}

/* ───────── Part assembly ───────── */

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

class Assembly {
  private parts = new Map<MatKey, THREE.BufferGeometry[]>()

  add(key: MatKey, geo: THREE.BufferGeometry, pos: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]): void {
    const g = geo.clone()
    _m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scale))
    g.applyMatrix4(_m)
    const list = this.parts.get(key) ?? []
    list.push(g)
    this.parts.set(key, list)
  }

  /** One mesh per material; created geometries are registered for disposal. */
  build(materials: Record<MatKey, THREE.Material>, owned: THREE.BufferGeometry[]): THREE.Group {
    const group = new THREE.Group()
    for (const [key, list] of this.parts) {
      const merged = mergeGeometries(list, false)
      list.forEach((g) => g.dispose())
      if (!merged) continue
      owned.push(merged)
      const mesh = new THREE.Mesh(merged, materials[key])
      mesh.raycast = () => {}
      group.add(mesh)
    }
    return group
  }
}

/* ───────── Kit ───────── */

export class SatelliteKit {
  private readonly owned: THREE.BufferGeometry[] = []
  private readonly textures: THREE.Texture[] = []
  private readonly env: THREE.WebGLRenderTarget

  private readonly geo = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
    strut: new THREE.CylinderGeometry(1, 1, 1, 6),
    cone: new THREE.CylinderGeometry(0.45, 1, 1, 14, 1, true),
    disk: new THREE.CylinderGeometry(1, 1, 1, 24),
    // Parabolic reflector, opening toward +Y.
    dish: new THREE.LatheGeometry(
      Array.from({ length: 9 }, (_, i) => new THREE.Vector2(i / 8, (i / 8) ** 2 * 0.42)),
      24,
    ),
  }

  readonly materials: Record<MatKey, THREE.MeshStandardMaterial>

  constructor(gl: THREE.WebGLRenderer) {
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy())
    const tex = (c: HTMLCanvasElement, srgb = true) => {
      const t = new THREE.CanvasTexture(c)
      if (srgb) t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = aniso
      this.textures.push(t)
      return t
    }

    // Neutral studio reflections so metal reads as metal (scene lights still dominate).
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    this.env = pmrem.fromScene(room, 0.04)
    room.dispose()
    pmrem.dispose()
    const envMap = this.env.texture

    const gold = foil([39, 82, 56], 3)
    const silver = foil([212, 10, 78], 5)

    const std = (p: THREE.MeshStandardMaterialParameters, envMapIntensity = 0.55) =>
      new THREE.MeshStandardMaterial({ envMap, envMapIntensity, ...p })

    this.materials = {
      goldFoil: std({ map: tex(gold.map), bumpMap: tex(gold.bump, false), bumpScale: 1, metalness: 1, roughness: 0.26 }, 1.35),
      silverFoil: std({ map: tex(silver.map), bumpMap: tex(silver.bump, false), bumpScale: 0.8, metalness: 1, roughness: 0.24 }, 1.1),
      cellsBlue: std({ map: tex(solarCells(8, 4, [224, 62, 19], '#9aa3b2', 21)), metalness: 0.55, roughness: 0.26 }, 0.7),
      cellsAmber: std({ map: tex(solarCells(6, 5, [30, 58, 30], '#b9a27a', 23)), metalness: 0.5, roughness: 0.3 }, 0.65),
      cellsHubble: std({ map: tex(solarCells(6, 8, [250, 40, 22], '#a99a6a', 29)), metalness: 0.55, roughness: 0.26 }, 0.7),
      module: std({ map: tex(moduleSkin()), metalness: 0.12, roughness: 0.62 }, 0.35),
      radiator: std({ map: tex(radiatorSkin()), metalness: 0.05, roughness: 0.45 }, 0.35),
      aluminium: std({ color: '#b9c0c9', metalness: 0.9, roughness: 0.32 }, 0.8),
      dark: std({ color: '#1d2129', metalness: 0.35, roughness: 0.6 }, 0.3),
      dish: std({ color: '#eceff3', metalness: 0.2, roughness: 0.38, side: THREE.DoubleSide }, 0.5),
      truss: std({ color: '#cdd2d8', metalness: 0.65, roughness: 0.42 }, 0.6),
    }
  }

  /* ── reusable sub-assemblies ── */

  /** Solar wing along ±Y made of segments (each `segY` × `segX`) with small gaps. */
  private wing(a: Assembly, mat: MatKey, dir: 1 | -1, start: number, count: number, segY: number, segX: number, x = 0): void {
    const gap = segY * 0.08
    for (let i = 0; i < count; i++) {
      const y = dir * (start + segY / 2 + i * (segY + gap))
      a.add(mat, this.geo.box, [x, y, 0], [0, 0, 0], [segX, segY, 0.0005])
    }
    // stiffening yoke rails along the wing edges
    const len = count * segY + (count - 1) * gap
    const mid = dir * (start + len / 2)
    for (const side of [-1, 1]) a.add('aluminium', this.geo.strut, [x + (side * segX) / 2, mid, 0], [0, 0, 0], [0.00028, len, 0.00028])
  }

  /** Small parabolic antenna facing `rot` (dish axis = local +Y before rotation). */
  private dish(a: Assembly, pos: Vec3, rot: Vec3, radius: number): void {
    a.add('dish', this.geo.dish, pos, rot, [radius, radius, radius])
    // feed on three struts
    const axis = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...rot))
    const feed: Vec3 = [pos[0] + axis.x * radius * 0.75, pos[1] + axis.y * radius * 0.75, pos[2] + axis.z * radius * 0.75]
    a.add('aluminium', this.geo.cyl, feed, rot, [radius * 0.12, radius * 0.18, radius * 0.12])
    const mid: Vec3 = [(pos[0] + feed[0]) / 2, (pos[1] + feed[1]) / 2, (pos[2] + feed[2]) / 2]
    a.add('aluminium', this.geo.strut, mid, rot, [radius * 0.03, radius * 0.75, radius * 0.03])
  }

  /** Square lattice truss along Y. */
  private truss(a: Assembly, length: number, width: number, bay: number): void {
    const h = width / 2
    const t = width * 0.07
    for (const [x, z] of [[h, h], [-h, h], [h, -h], [-h, -h]] as const) {
      a.add('truss', this.geo.box, [x, 0, z], [0, 0, 0], [t, length, t])
    }
    const bays = Math.round(length / bay)
    const diag = Math.hypot(bay, width)
    const ang = Math.atan2(width, bay)
    for (let i = 0; i < bays; i++) {
      const y = -length / 2 + bay * (i + 0.5)
      const flip = i % 2 ? 1 : -1
      // faces at ±x (span Y–Z) and ±z (span Y–X), zig-zag bracing
      a.add('truss', this.geo.box, [h, y, 0], [ang * flip, 0, 0], [t * 0.7, diag, t * 0.7])
      a.add('truss', this.geo.box, [-h, y, 0], [-ang * flip, 0, 0], [t * 0.7, diag, t * 0.7])
      a.add('truss', this.geo.box, [0, y, h], [0, 0, ang * flip], [t * 0.7, diag, t * 0.7])
      a.add('truss', this.geo.box, [0, y, -h], [0, 0, -ang * flip], [t * 0.7, diag, t * 0.7])
      // bay frame
      a.add('truss', this.geo.box, [0, y - bay / 2, h], [0, 0, 0], [width, t * 0.7, t * 0.7])
      a.add('truss', this.geo.box, [0, y - bay / 2, -h], [0, 0, 0], [width, t * 0.7, t * 0.7])
    }
  }

  private finish(body: Assembly, wings: Assembly[]): { model: THREE.Group; wings: THREE.Group[] } {
    const model = body.build(this.materials, this.owned)
    const pivots = wings.map((w) => {
      const pivot = new THREE.Group()
      pivot.add(w.build(this.materials, this.owned))
      model.add(pivot)
      return pivot
    })
    return { model, wings: pivots }
  }

  /* ── spacecraft ── */

  /** GPS III / Galileo-style navigation satellite. */
  private navigation() {
    const g = this.geo
    const body = new Assembly()
    body.add('goldFoil', g.box, [0, 0, 0], [0, 0, 0], [0.016, 0.016, 0.022])
    // radiators on the ±X faces
    for (const s of [-1, 1]) body.add('radiator', g.box, [s * 0.0082, 0, -0.001], [0, 0, 0], [0.0005, 0.0135, 0.017])
    // Earth deck with the L-band helix array
    body.add('dark', g.box, [0, 0, 0.0114], [0, 0, 0], [0.0145, 0.0145, 0.0008])
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      body.add('aluminium', g.cyl, [Math.cos(a) * 0.0048, Math.sin(a) * 0.0048, 0.0131], [Math.PI / 2, 0, 0], [0.00045, 0.003, 0.00045])
    }
    body.add('aluminium', g.cyl, [0, 0, 0.0138], [Math.PI / 2, 0, 0], [0.0009, 0.0045, 0.0009])
    this.dish(body, [0.0058, 0.0058, 0.0122], [Math.PI / 2, 0, 0], 0.0024)
    // apogee thruster and attitude jets at the back
    body.add('aluminium', g.cone, [0, 0, -0.0125], [Math.PI / 2, 0, 0], [0.0022, 0.003, 0.0022])
    // array booms through the bus
    body.add('aluminium', g.cyl, [0, 0, 0], [0, 0, 0], [0.0006, 0.04, 0.0006])
    const wings = ([1, -1] as const).map((dir) => {
      const w = new Assembly()
      w.add('aluminium', g.box, [0, dir * 0.0205, 0], [0, 0, 0], [0.004, 0.001, 0.001])
      this.wing(w, 'cellsBlue', dir, 0.021, 3, 0.0115, 0.022)
      return w
    })
    return this.finish(body, wings)
  }

  /** Landsat / Sentinel-2-style Earth observer: one long wing, imagers on the Earth face. */
  private earthObserver() {
    const g = this.geo
    const body = new Assembly()
    body.add('silverFoil', g.box, [0, 0, 0], [0, 0, 0], [0.018, 0.014, 0.019])
    body.add('dark', g.box, [0, 0, -0.0099], [0, 0, 0], [0.018, 0.014, 0.0008])
    // main imager (gold-wrapped) with its dark aperture, plus a thermal imager
    body.add('goldFoil', g.box, [0.003, 0.001, 0.0138], [0, 0, 0], [0.011, 0.009, 0.0095])
    body.add('dark', g.cyl, [0.0058, 0.001, 0.0187], [Math.PI / 2, 0, 0], [0.0021, 0.0012, 0.0021])
    body.add('radiator', g.box, [-0.0055, -0.002, 0.0126], [0, 0, 0], [0.0055, 0.0075, 0.0068])
    body.add('dark', g.cyl, [-0.0055, -0.002, 0.0163], [Math.PI / 2, 0, 0], [0.0012, 0.0008, 0.0012])
    // star trackers
    for (const s of [-1, 1]) body.add('aluminium', g.cyl, [-0.0075, s * 0.004, -0.0108], [0.5 * s, 0, 0.4], [0.0011, 0.0035, 0.0011])
    // X-band downlink dish on a short boom
    body.add('aluminium', g.strut, [-0.0085, 0.006, 0.0115], [Math.PI / 2, 0, 0], [0.0004, 0.006, 0.0004])
    this.dish(body, [-0.0085, 0.006, 0.0145], [Math.PI / 2, 0, 0], 0.0026)
    const wing = new Assembly()
    wing.add('aluminium', g.cyl, [0, -0.0125, 0], [0, 0, 0], [0.0006, 0.011, 0.0006])
    this.wing(wing, 'cellsBlue', -1, 0.018, 4, 0.0105, 0.021)
    return this.finish(body, [wing])
  }

  /** Hubble: silver tube with aperture door, aft shroud, twin arrays, high-gain antennas. */
  private telescope() {
    const g = this.geo
    const body = new Assembly()
    const along: Vec3 = [0, 0, Math.PI / 2] // cylinder axis → X (pointing direction)
    body.add('silverFoil', g.cyl, [0.004, 0, 0], along, [0.0086, 0.03, 0.0086])
    body.add('silverFoil', g.cyl, [-0.0175, 0, 0], along, [0.0096, 0.014, 0.0096])
    body.add('aluminium', g.disk, [-0.0247, 0, 0], along, [0.0092, 0.0006, 0.0092])
    // equipment-bay bands
    for (const x of [-0.0112, -0.0236]) body.add('aluminium', g.disk, [x, 0, 0], along, [0.0098, 0.0005, 0.0098])
    // open aperture (dark inside) and the hinged door swung open
    body.add('dark', g.disk, [0.0187, 0, 0], along, [0.0079, 0.0004, 0.0079])
    body.add('aluminium', g.disk, [0.0268, 0, -0.0113], [0, -1.2, Math.PI / 2], [0.0088, 0.0006, 0.0088])
    // high-gain antennas on masts above and below
    for (const s of [-1, 1]) {
      body.add('aluminium', g.strut, [-0.004, 0, s * 0.0142], [Math.PI / 2, 0, 0], [0.0004, 0.0115, 0.0004])
      this.dish(body, [-0.004, 0, s * 0.0198], [s > 0 ? Math.PI / 2 : -Math.PI / 2, 0, 0], 0.0034)
    }
    const wings = ([1, -1] as const).map((dir) => {
      const w = new Assembly()
      w.add('aluminium', g.cyl, [-0.007, dir * 0.0128, 0], [0, 0, 0], [0.0007, 0.0075, 0.0007])
      this.wing(w, 'cellsHubble', dir, 0.016, 2, 0.0125, 0.0105, -0.007)
      return w
    })
    return this.finish(body, wings)
  }

  /** International Space Station: integrated truss, eight amber array wings on alpha
   *  joints, radiators, and the pressurised module stack (US + Russian segments). */
  private station() {
    const g = this.geo
    const body = new Assembly()
    this.truss(body, 0.084, 0.0045, 0.006)
    // alpha joints at the truss ends
    for (const s of [-1, 1]) body.add('aluminium', g.cyl, [0, s * 0.0435, 0], [0, 0, 0], [0.0032, 0.003, 0.0032])
    // main heat-rejection radiators, hanging Earth-side from the inboard truss
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        body.add('radiator', g.box, [0, s * (0.012 + i * 0.0045), 0.016], [0, 0, 0], [0.0004, 0.004, 0.022])
      }
    }
    // modules along X, Earth-side of the truss
    const mod = (x: number, len: number, r: number) => body.add('module', g.cyl, [x, 0, 0.0062], [0, 0, Math.PI / 2], [r, len, r])
    mod(0.0005, 0.0085, 0.0034) // Destiny
    mod(0.0095, 0.0072, 0.0034) // Harmony
    mod(-0.0075, 0.0055, 0.0036) // Unity
    mod(-0.0165, 0.0125, 0.0031) // Zarya
    mod(-0.0298, 0.0135, 0.0033) // Zvezda
    body.add('aluminium', g.cyl, [-0.0385, 0, 0.0062], [0, 0, Math.PI / 2], [0.0018, 0.004, 0.0018]) // Soyuz/Progress
    // Kibo and Columbus branch sideways off Harmony
    body.add('module', g.cyl, [0.0095, 0.0098, 0.0062], [0, 0, 0], [0.0034, 0.012, 0.0034])
    body.add('module', g.cyl, [0.0095, -0.0082, 0.0062], [0, 0, 0], [0.0032, 0.0085, 0.0032])
    body.add('module', g.box, [0.0095, 0.018, 0.0062], [0, 0, 0], [0.0045, 0.004, 0.0045]) // exposed facility
    // Zvezda's own small arrays
    for (const s of [-1, 1]) this.wing(body, 'cellsBlue', s as 1 | -1, 0.0036, 2, 0.006, 0.0055, -0.0298)
    // outboard arrays: two masts per side, each with two blankets extending fore and aft
    const wings = ([1, -1] as const).map((dir) => {
      const w = new Assembly()
      w.add('truss', g.box, [0, dir * 0.051, 0], [0, 0, 0], [0.004, 0.014, 0.004])
      for (const y of [0.0465, 0.0565]) {
        const yy = dir * y
        w.add('aluminium', g.box, [0, yy, 0], [0, 0, 0], [0.006, 0.0016, 0.0016]) // beta gimbal
        for (const xs of [-1, 1]) {
          // a blanket = 5 segments outward along X, centred mast between the two halves
          for (let i = 0; i < 5; i++) {
            const x = xs * (0.004 + 0.0047 + i * 0.0095)
            w.add('cellsAmber', g.box, [x, yy - 0.0024, 0], [0, 0, 0], [0.009, 0.0042, 0.0004])
            w.add('cellsAmber', g.box, [x, yy + 0.0024, 0], [0, 0, 0], [0.009, 0.0042, 0.0004])
          }
          w.add('aluminium', g.strut, [xs * 0.028, yy, 0], [0, 0, Math.PI / 2], [0.00035, 0.048, 0.00035])
          w.add('dark', g.box, [xs * 0.052, yy, 0], [0, 0, 0], [0.0012, 0.0094, 0.0009]) // tip box
        }
      }
      return w
    })
    return this.finish(body, wings)
  }

  /** The model plus its sun-tracking array pivots (rotate them about local Y). */
  build(kind: SatelliteKind): { model: THREE.Group; wings: THREE.Group[] } {
    switch (kind) {
      case 'station':
        return this.station()
      case 'telescope':
        return this.telescope()
      case 'observer':
        return this.earthObserver()
      default:
        return this.navigation()
    }
  }

  dispose(): void {
    Object.values(this.geo).forEach((g) => g.dispose())
    this.owned.forEach((g) => g.dispose())
    Object.values(this.materials).forEach((m) => m.dispose())
    this.textures.forEach((t) => t.dispose())
    this.env.dispose()
  }
}
