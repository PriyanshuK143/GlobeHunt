import { useEffect, useRef, useState, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EARTH_RADIUS, latLngToVector3, vector3ToLatLng } from '../navigation/geo'
import { atlasStore } from '../atlas/atlasStore'
import { ATLAS_LABELS } from './atlasData'
import { loadCountryLabels } from './countryLabels'
import { labelNorm } from './normalize'
import { STYLES, drawSymbol, type LabelStyle } from './styles'
import type { AtlasLabel, LabelFilter, LabelFilterFactory } from './types'

const FADE_RATE = 9
const CELL_DEG = 10
const GRID_PX = 8
/** Breathing room around each label (px), so text never packs edge to edge. */
const PAD_X = 10
const PAD_Y = 6
/**
 * Screen area per label (px²), by zoom: generous when zoomed out (only the big names),
 * tighter close in where there is more to read. Keeps the map readable, Google-Maps-like.
 */
const AREA_PER_LABEL_NEAR = 9000
const AREA_PER_LABEL_FAR = 17000
const NEAR_DISTANCE = 1.3
const FAR_DISTANCE = 3.2
const MIN_LABELS = 18

/**
 * Limb margin: a label is shown only where the globe surface faces the camera enough
 * (cosine between the surface normal and the direction to the camera). Text near the
 * curved silhouette is squashed and crowded, so it is dropped well before the horizon.
 * Major names (countries, oceans) may sit a little closer to the edge than minor ones,
 * and every label fades out across FACING_FADE before it disappears.
 */
const LABEL_LIMB_MARGIN = { major: 0.3, minor: 0.45 }
const MAJOR_PRIORITY = 80
const FACING_FADE = 0.12
/** Labels stay this far (px) inside the viewport edges. */
const EDGE_PAD = 10
/** On-screen UI the labels must keep clear of (HUD, answer bar, cards, corner readouts). */
const LABEL_AVOID_SELECTOR =
  '.game-hud__top, .game-hud__challenge, .marker-confirm, .discovery-card, .space-corner, .hud-menu-btn, .overlay-panel, [data-label-avoid]'
/** How often the UI rectangles are re-measured (s); also on resize. */
const AVOID_REFRESH = 0.4
/** Minor kinds appear later than their data tier suggests (less clutter). */
const KIND_ZOOM: Partial<Record<string, number>> = { village: 0.985, port: 0.88, airport: 0.92, landmark: 0.92, admin1: 0.95 }
const REQUEST_INTERVAL = 0.25

interface Prepared extends AtlasLabel {
  dir: THREE.Vector3
  /** Surface-facing factor for this frame (see LABEL_LIMB_MARGIN). */
  facing: number
  display: string
  style: LabelStyle
  width: number
  height: number
  axisDir?: THREE.Vector3
  lineDirs?: THREE.Vector3[]
}

export interface AtlasLabelsProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  enabled: boolean
  extra?: AtlasLabel[]
  filter?: LabelFilterFactory
}

const _w = new THREE.Vector3()
const _camDir = new THREE.Vector3()

function dedupeKey(l: AtlasLabel): string {
  const family = l.kind === 'capital' || l.kind === 'admincap' || l.kind === 'city' || l.kind === 'town' || l.kind === 'village' ? 'place' : l.kind
  return `${family}:${labelNorm(l.name)}:${Math.round(l.lat * 4)}:${Math.round(l.lng * 4)}`
}

/** Registry of every label known to the renderer, bucketed spatially. */
class LabelRegistry {
  all: Prepared[] = []
  buckets = new Map<number, Prepared[]>()
  unsorted = new Set<number>()
  keys = new Map<string, Prepared>()
  ids = new Set<string>()
  version = 0

  add(list: readonly AtlasLabel[]) {
    let added = 0
    for (const l of list) {
      if (this.ids.has(l.id)) continue
      // Pinned labels ("pin:" ids) never merge with a real label, so removing one later
      // can't take the real label with it.
      const key = l.id.startsWith('pin:') ? l.id : dedupeKey(l)
      const existing = this.keys.get(key)
      if (existing && existing.priority >= l.priority) continue
      this.ids.add(l.id)
      const style = STYLES[l.kind] ?? STYLES.region
      const base = l.text ?? l.name
      const p: Prepared = {
        ...l,
        dir: latLngToVector3(l.lat, l.lng, EARTH_RADIUS * 1.002),
        facing: 0,
        display: style.upper ? base.toUpperCase() : base,
        style,
        width: -1,
        height: Math.round(style.size * (l.size ?? 1)) + 4,
        axisDir: l.axis ? latLngToVector3(l.axis.lat, l.axis.lng, EARTH_RADIUS * 1.002) : undefined,
        lineDirs: l.line ? lineDirs(l.line) : undefined,
      }
      if (existing) {
        // Same place from a richer source (e.g. a capital vs. a plain game city): upgrade in place.
        Object.assign(existing, p)
        this.unsorted.add(cellOf(existing.lat, existing.lng))
        added++
        continue
      }
      this.keys.set(key, p)
      this.all.push(p)
      const cell = cellOf(l.lat, l.lng)
      let bucket = this.buckets.get(cell)
      if (!bucket) this.buckets.set(cell, (bucket = []))
      bucket.push(p)
      this.unsorted.add(cell)
      added++
    }
    if (added) this.version++
  }

  /** Drop labels by id (used for per-round extras such as the Practice target name). */
  remove(drop: ReadonlySet<string>) {
    if (!drop.size) return
    const gone = (p: Prepared) => drop.has(p.id)
    this.all = this.all.filter((p) => !gone(p))
    for (const [cell, list] of this.buckets) this.buckets.set(cell, list.filter((p) => !gone(p)))
    for (const [key, p] of this.keys) if (gone(p)) this.keys.delete(key)
    for (const id of drop) this.ids.delete(id)
    this.version++
  }

  bucket(cell: number): Prepared[] | undefined {
    const b = this.buckets.get(cell)
    if (b && this.unsorted.has(cell)) {
      b.sort((a, c) => c.priority - a.priority)
      this.unsorted.delete(cell)
    }
    return b
  }
}

function lineDirs(flat: number[]): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  for (let i = 0; i < flat.length; i += 2) out.push(latLngToVector3(flat[i + 1], flat[i], EARTH_RADIUS * 1.002))
  return out
}

const CELLS_X = 360 / CELL_DEG
function cellOf(lat: number, lng: number): number {
  const cy = Math.min(180 / CELL_DEG - 1, Math.floor((lat + 90) / CELL_DEG))
  const cx = Math.min(CELLS_X - 1, Math.floor((lng + 180) / CELL_DEG))
  return cy * CELLS_X + cx
}
const CELL_CENTERS: THREE.Vector3[] = []
for (let cy = 0; cy < 180 / CELL_DEG; cy++)
  for (let cx = 0; cx < CELLS_X; cx++) CELL_CENTERS.push(latLngToVector3(-90 + (cy + 0.5) * CELL_DEG, -180 + (cx + 0.5) * CELL_DEG, 1))

/** Screen-space occupancy grid for collision tests. */
class Occupancy {
  private cols = 0
  private rows = 0
  private grid = new Uint8Array(0)
  reset(w: number, h: number) {
    this.cols = Math.ceil(w / GRID_PX)
    this.rows = Math.ceil(h / GRID_PX)
    if (this.grid.length < this.cols * this.rows) this.grid = new Uint8Array(this.cols * this.rows)
    else this.grid.fill(0, 0, this.cols * this.rows)
  }
  private span(x0: number, y0: number, x1: number, y1: number) {
    return [
      Math.max(0, Math.floor(x0 / GRID_PX)),
      Math.max(0, Math.floor(y0 / GRID_PX)),
      Math.min(this.cols - 1, Math.floor(x1 / GRID_PX)),
      Math.min(this.rows - 1, Math.floor(y1 / GRID_PX)),
    ]
  }
  free(x0: number, y0: number, x1: number, y1: number): boolean {
    const [a, b, c, d] = this.span(x0, y0, x1, y1)
    for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) if (this.grid[y * this.cols + x]) return false
    return true
  }
  mark(x0: number, y0: number, x1: number, y1: number) {
    const [a, b, c, d] = this.span(x0, y0, x1, y1)
    for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) this.grid[y * this.cols + x] = 1
  }
}

interface Placement {
  label: Prepared
  x: number
  y: number
  angle: number
  /** Per-character positions for curved river labels. */
  glyphs?: Array<{ ch: string; x: number; y: number; a: number }>
  /** Extra fade as the label nears the limb margin. */
  edge: number
}

const LABEL_RADIUS = EARTH_RADIUS * 1.002

/** Cosine between the surface normal at `p` and the direction from `p` to the camera. */
function facingOf(p: THREE.Vector3, cam: THREE.Vector3, camLen2: number): number {
  const pc = p.dot(cam)
  return (pc / LABEL_RADIUS - LABEL_RADIUS) / Math.sqrt(Math.max(1e-9, camLen2 + LABEL_RADIUS * LABEL_RADIUS - 2 * pc))
}

function minFacing(l: AtlasLabel): number {
  return l.priority >= MAJOR_PRIORITY ? LABEL_LIMB_MARGIN.major : LABEL_LIMB_MARGIN.minor
}

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/**
 * Atlas labels for the whole planet, from the packaged Natural Earth + GeoNames data.
 * Zoom tiers decide what may appear, tiles stream in near the camera, and a
 * priority-ordered pass over a screen-space occupancy grid keeps text readable —
 * density adapts to the available space instead of a fixed label cap.
 */
export function AtlasLabels({ canvasRef, enabled, extra, filter }: AtlasLabelsProps) {
  const { camera, size, gl } = useThree()
  const registry = useRef(new LabelRegistry())
  const [regVersion, setRegVersion] = useState(0)
  const filterFn = useRef<LabelFilter | undefined>(undefined)
  const filterKey = useRef('')
  const regionReady = useRef(false)
  const [regionTick, setRegionTick] = useState(0)
  const alpha = useRef(new Map<string, number>())
  const lastMatrix = useRef(new THREE.Matrix4())
  const settled = useRef(false)
  const master = useRef(0)
  const sinceRequest = useRef(REQUEST_INTERVAL)
  const occupancy = useRef(new Occupancy())
  const measureCtx = useRef<CanvasRenderingContext2D | null>(null)
  const glyphWidth = useRef(new Map<string, number>())
  const avoid = useRef<Array<[number, number, number, number]>>([])
  const sinceAvoid = useRef(AVOID_REFRESH)

  // Sources: country names, packaged atlas tiles (progressive), game extras.
  useEffect(() => {
    let cancelled = false
    const sync = () => {
      if (cancelled) return
      registry.current.add(atlasStore.failed ? ATLAS_LABELS : atlasStore.labels())
      setRegVersion(registry.current.version)
    }
    loadCountryLabels()
      .then((l) => {
        if (cancelled) return
        registry.current.add(l.map((c) => ({ ...c, tier: 'static' })))
        setRegVersion(registry.current.version)
      })
      .catch((err) => console.warn('[GLOBEHUNT] Country labels unavailable', err))
    void atlasStore.ready.then(sync)
    const off = atlasStore.subscribe(sync)
    return () => {
      cancelled = true
      off()
    }
  }, [])

  // Extras belong to the current round: the previous set is removed when they change.
  const extraIds = useRef(new Set<string>())
  useEffect(() => {
    registry.current.remove(extraIds.current)
    extraIds.current = new Set(extra?.map((e) => e.id) ?? [])
    if (extra?.length) registry.current.add(extra.map((e) => ({ ...e, tier: 'static' })))
    setRegVersion(registry.current.version)
  }, [extra])

  // Deterministic decoys need the canonical tiles around the target loaded first.
  useEffect(() => {
    regionReady.current = false
    const p = filter?.prefetch
    if (!p) return
    let alive = true
    void atlasStore.ensureRegion(p.lat, p.lng, p.km).then(() => {
      if (!alive) return
      regionReady.current = true
      setRegionTick((n) => n + 1)
    })
    return () => {
      alive = false
    }
  }, [filter])

  // Rebuild the filter whenever the label set, the target or region readiness change —
  // in the same render as the new labels, so a new tile can never flash a hidden name.
  const key = `${regVersion}|${regionTick}`
  if (filterKey.current !== key || (filter && !filterFn.current) || (!filter && filterFn.current)) {
    filterKey.current = key
    filterFn.current = filter ? filter(registry.current.all, regionReady.current) : undefined
    settled.current = false
  }
  const lastFilter = useRef(filter)
  if (lastFilter.current !== filter) {
    lastFilter.current = filter
    filterFn.current = filter ? filter(registry.current.all, regionReady.current) : undefined
    settled.current = false
  }

  useEffect(() => {
    settled.current = false
  }, [enabled, regVersion])

  const measure = (l: Prepared): number => {
    if (l.width >= 0) return l.width
    const ctx = (measureCtx.current ??= document.createElement('canvas').getContext('2d')!)
    ctx.font = l.style.font(l.size ?? 1)
    ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${l.style.spacing}px`
    l.width = ctx.measureText(l.display).width + (l.style.symbol ? 9 : 0)
    return l.width
  }

  const charWidth = (font: string, ch: string): number => {
    const k = font + ch
    let w = glyphWidth.current.get(k)
    if (w === undefined) {
      const ctx = (measureCtx.current ??= document.createElement('canvas').getContext('2d')!)
      ctx.font = font
      ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px'
      w = ctx.measureText(ch).width
      glyphWidth.current.set(k, w)
    }
    return w
  }

  const project = (v: THREE.Vector3) => {
    _w.copy(v).project(camera)
    return { x: (_w.x * 0.5 + 0.5) * size.width, y: (-_w.y * 0.5 + 0.5) * size.height, z: _w.z }
  }

  useFrame((_, delta) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dt = Math.min(delta, 0.1)
    const dist = camera.position.length()

    // Progressive tile requests around what the camera can see.
    sinceRequest.current += dt
    const cam = camera as THREE.PerspectiveCamera
    const halfDiag = Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * Math.hypot(1, cam.aspect))
    const horizon = Math.acos(Math.min(1, EARTH_RADIUS / dist))
    const s = dist * Math.sin(halfDiag)
    const ground = s >= 1 ? horizon : Math.min(horizon, Math.asin(s) - halfDiag)
    const radiusDeg = THREE.MathUtils.radToDeg(ground) + 2
    if (enabled && sinceRequest.current >= REQUEST_INTERVAL) {
      sinceRequest.current = 0
      const c = vector3ToLatLng(camera.position)
      atlasStore.request(c.lat, c.lng, radiusDeg, dist)
    }

    const dpr = gl.getPixelRatio()
    const w = Math.round(size.width * dpr)
    const h = Math.round(size.height * dpr)
    let resized = false
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
      resized = true
    }

    const targetMaster = enabled ? 1 : 0
    master.current += (targetMaster - master.current) * (1 - Math.exp(-FADE_RATE * dt))
    if (Math.abs(master.current - targetMaster) < 0.005) master.current = targetMaster

    // Re-measure the UI the labels must avoid (cheap: a handful of elements, a few times a second).
    sinceAvoid.current += dt
    let avoidChanged = false
    if (enabled && (resized || sinceAvoid.current >= AVOID_REFRESH)) {
      sinceAvoid.current = 0
      const origin = canvas.getBoundingClientRect()
      const next: Array<[number, number, number, number]> = []
      document.querySelectorAll(LABEL_AVOID_SELECTOR).forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) next.push([r.left - origin.left, r.top - origin.top, r.right - origin.left, r.bottom - origin.top])
      })
      const prev = avoid.current
      avoidChanged = next.length !== prev.length || next.some((r, i) => r.some((v, j) => Math.abs(v - prev[i][j]) > 1))
      avoid.current = next
    }

    const moved = !lastMatrix.current.equals(camera.matrixWorld)
    if (moved) lastMatrix.current.copy(camera.matrixWorld)
    if (!moved && !resized && !avoidChanged && settled.current && master.current === targetMaster) return

    const frameStart = performance.now()
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w, h)
    if (master.current <= 0.001) {
      settled.current = true
      return
    }
    ctx.scale(dpr, dpr)

    _camDir.copy(camera.position).normalize()
    const camPos = camera.position
    const camLen2 = camPos.lengthSq()
    // Inside the camera's view cone (diagonal half-angle plus a little slack).
    const coneCos = Math.cos(Math.min(Math.PI / 2, halfDiag * 1.04))
    const cellReach = Math.cos(Math.min(Math.PI, ground + THREE.MathUtils.degToRad(CELL_DEG * 0.75 + 2)))
    const hidden = filterFn.current

    // 1. Candidates: nearby cells only (the region in view), in zoom tier, and genuinely
    //    facing the camera — far side and the crowded limb are filtered out here, before
    //    any measuring, projecting or drawing.
    const candidates: Prepared[] = []
    for (let cell = 0; cell < CELL_CENTERS.length; cell++) {
      if (CELL_CENTERS[cell].dot(_camDir) < cellReach) continue
      const bucket = registry.current.bucket(cell)
      if (!bucket) continue
      for (const l of bucket) {
        if (l.maxDistance * (KIND_ZOOM[l.kind] ?? 1) < dist * 0.97) continue
        const f = facingOf(l.dir, camPos, camLen2)
        if (f < minFacing(l)) continue
        if (!l.lineDirs && (dist - l.dir.dot(_camDir)) / l.dir.distanceTo(camPos) < coneCos) continue
        if (hidden && !hidden(l)) continue
        l.facing = f
        candidates.push(l)
      }
    }
    candidates.sort((a, b) => b.priority - a.priority)

    // 2. Priority-ordered placement on the occupancy grid. UI panels are reserved first
    //    so no label is drawn under the HUD, the answer bar or a card.
    const occ = occupancy.current
    occ.reset(size.width, size.height)
    for (const [x0, y0, x1, y1] of avoid.current) occ.mark(x0 - 4, y0 - 4, x1 + 4, y1 + 4)
    const zoomT = smooth((dist - NEAR_DISTANCE) / (FAR_DISTANCE - NEAR_DISTANCE))
    const areaPerLabel = AREA_PER_LABEL_NEAR + (AREA_PER_LABEL_FAR - AREA_PER_LABEL_NEAR) * zoomT
    const maxPlaced = Math.max(MIN_LABELS, Math.round((size.width * size.height) / areaPerLabel))
    const placed: Placement[] = []
    const placedIds = new Set<string>()
    for (const l of candidates) {
      if (placed.length >= maxPlaced) break
      const p = project(l.dir)
      if (p.z > 1 || p.x < -EDGE_PAD || p.x > size.width + EDGE_PAD || p.y < -EDGE_PAD || p.y > size.height + EDGE_PAD) continue
      const placement = l.lineDirs ? placeAlongLine(l, ctx) : placePoint(l, p)
      if (!placement) continue
      placed.push(placement)
      placedIds.add(l.id)
    }

    function placePoint(l: Prepared, p: { x: number; y: number }): Placement | null {
      const width = measure(l)
      let angle = 0
      if (l.axisDir) {
        const q = project(l.axisDir)
        angle = Math.atan2(q.y - p.y, q.x - p.x)
        if (angle > Math.PI / 2) angle -= Math.PI
        if (angle < -Math.PI / 2) angle += Math.PI
      }
      const hw = (Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * l.height) / 2
      const hh = (Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * l.height) / 2
      const cx = l.style.symbol ? p.x - 4 + width / 2 : p.x
      const x0 = cx - hw
      const x1 = cx + hw
      const y0 = p.y - hh
      const y1 = p.y + hh
      // Fully inside the viewport: no text overflowing the screen edges.
      if (x0 < EDGE_PAD || x1 > size.width - EDGE_PAD || y0 < EDGE_PAD || y1 > size.height - EDGE_PAD) return null
      if (!occ.free(x0 - PAD_X, y0 - PAD_Y, x1 + PAD_X, y1 + PAD_Y)) return null
      occ.mark(x0, y0, x1, y1)
      return { label: l, x: p.x, y: p.y, angle, edge: smooth((l.facing - minFacing(l)) / FACING_FADE) }
    }

    function placeAlongLine(l: Prepared, c: CanvasRenderingContext2D): Placement | null {
      // Visible, front-facing run of the river's polyline in screen space.
      const pts: Array<{ x: number; y: number }> = []
      let best: Array<{ x: number; y: number }> = []
      let bestLen = 0
      let run: Array<{ x: number; y: number }> = []
      let runLen = 0
      const flush = () => {
        if (runLen > bestLen) {
          best = run
          bestLen = runLen
        }
        run = []
        runLen = 0
      }
      const need = minFacing(l)
      for (const d of l.lineDirs!) {
        const facing = facingOf(d, camPos, camLen2) > need
        const q = facing ? project(d) : null
        const onScreen = q && q.x > EDGE_PAD && q.x < size.width - EDGE_PAD && q.y > EDGE_PAD && q.y < size.height - EDGE_PAD
        if (!onScreen) {
          flush()
          continue
        }
        if (run.length) runLen += Math.hypot(q!.x - run[run.length - 1].x, q!.y - run[run.length - 1].y)
        run.push(q!)
        pts.push(q!)
      }
      flush()
      const font = l.style.font(1)
      const widths = [...l.display].map((ch) => charWidth(font, ch) + l.style.spacing)
      const textLen = widths.reduce((a, b) => a + b, 0)
      if (best.length < 2 || bestLen < textLen * 1.15) return null
      // Read left → right.
      if (best[best.length - 1].x < best[0].x) best = [...best].reverse()
      const cum = [0]
      for (let i = 1; i < best.length; i++) cum.push(cum[i - 1] + Math.hypot(best[i].x - best[i - 1].x, best[i].y - best[i - 1].y))
      let s0 = (bestLen - textLen) / 2
      const glyphs: Array<{ ch: string; x: number; y: number; a: number }> = []
      let seg = 0
      for (let i = 0; i < widths.length; i++) {
        const mid = s0 + widths[i] / 2
        while (seg < cum.length - 2 && cum[seg + 1] < mid) seg++
        const a = best[seg]
        const b = best[seg + 1]
        const t = (mid - cum[seg]) / Math.max(1e-6, cum[seg + 1] - cum[seg])
        const ang = Math.atan2(b.y - a.y, b.x - a.x)
        glyphs.push({ ch: [...l.display][i], x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, a: ang })
        s0 += widths[i]
      }
      // Reject sharp kinks (unreadable) and collisions.
      for (let i = 1; i < glyphs.length; i++) {
        let da = Math.abs(glyphs[i].a - glyphs[i - 1].a)
        if (da > Math.PI) da = 2 * Math.PI - da
        if (da > 0.9) return null
      }
      const r = l.height / 2
      for (const g of glyphs) if (!occ.free(g.x - r, g.y - r, g.x + r, g.y + r)) return null
      for (const g of glyphs) occ.mark(g.x - r, g.y - r, g.x + r, g.y + r)
      void c
      return { label: l, x: glyphs[0].x, y: glyphs[0].y, angle: 0, glyphs, edge: 1 }
    }

    // 3. Draw: placed labels fade in; recently dropped ones fade out in place.
    let animating = false
    const k = 1 - Math.exp(-FADE_RATE * dt)
    for (const pl of placed) {
      const prev = alpha.current.get(pl.label.id) ?? 0
      const a = prev + (1 - prev) * k
      const done = a > 0.99 ? 1 : a
      if (done !== 1) animating = true
      alpha.current.set(pl.label.id, done)
      draw(ctx, pl, done * master.current * pl.edge)
    }
    for (const [id, prev] of alpha.current) {
      if (placedIds.has(id)) continue
      const a = prev * (1 - k)
      if (a < 0.02) {
        alpha.current.delete(id)
        continue
      }
      animating = true
      alpha.current.set(id, a)
    }
    settled.current = !animating
    // Dev-only counters for checking label density and cost.
    if (import.meta.env.DEV) {
      ;(window as Window & { __GLOBEHUNT_LABELS__?: unknown }).__GLOBEHUNT_LABELS__ = {
        candidates: candidates.length,
        placed: placed.length,
        ms: performance.now() - frameStart,
      }
    }
  })

  return null
}

function draw(ctx: CanvasRenderingContext2D, pl: Placement, a: number) {
  const l = pl.label
  const s = l.style
  ctx.globalAlpha = a
  ctx.font = s.font(l.size ?? 1)
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(3, 8, 20, 0.85)'
  ctx.lineWidth = 3.2
  ctx.textBaseline = 'middle'
  const spacing = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if (pl.glyphs) {
    spacing.letterSpacing = '0px'
    ctx.textAlign = 'center'
    for (const g of pl.glyphs) {
      ctx.save()
      ctx.translate(g.x, g.y)
      ctx.rotate(g.a)
      ctx.strokeText(g.ch, 0, 0)
      ctx.fillStyle = s.color
      ctx.fillText(g.ch, 0, 0)
      ctx.restore()
    }
    ctx.globalAlpha = 1
    return
  }
  spacing.letterSpacing = `${s.spacing}px`
  if (s.symbol) {
    drawSymbol(ctx, s.symbol, pl.x, pl.y)
    ctx.textAlign = 'left'
    ctx.strokeText(l.display, pl.x + 7, pl.y)
    ctx.fillStyle = s.color
    ctx.fillText(l.display, pl.x + 7, pl.y)
  } else {
    ctx.textAlign = 'center'
    if (pl.angle) {
      ctx.save()
      ctx.translate(pl.x, pl.y)
      ctx.rotate(pl.angle)
      ctx.strokeText(l.display, 0, 0)
      ctx.fillStyle = s.color
      ctx.fillText(l.display, 0, 0)
      ctx.restore()
    } else {
      ctx.strokeText(l.display, pl.x, pl.y)
      ctx.fillStyle = s.color
      ctx.fillText(l.display, pl.x, pl.y)
    }
  }
  ctx.globalAlpha = 1
}
