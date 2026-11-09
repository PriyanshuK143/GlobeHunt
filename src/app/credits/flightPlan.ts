import * as THREE from 'three'
import type { CreditBlock } from './creditLines'
import { getGlyph, measureLine, LETTER_SPACING, SPACE_WIDTH, type Pt } from './glyphs'

/** Sample spacing along the flight path (world units). */
const DS = 0.035
/** Turn angle (degrees) above which a stroke corner is flown as a loop. */
const CORNER_DEG = 38
const LINE_GAP = 0.6
const COLUMN_GAP = 4.5
const ROW_GAP = 3.2
const WRITE_SPEED = 7.4
const CONNECT_SPEED = 11.5

export interface Box {
  cx: number
  cy: number
  w: number
  h: number
}

interface Segment {
  pts: THREE.Vector3[]
  smoke: boolean
  block: number
  line: number
  size: number
}

export interface FlightPlan {
  count: number
  positions: Float32Array
  smoke: Uint8Array
  times: Float32Array
  block: Int16Array
  line: Int16Array
  /** Time the last letter is finished. */
  writeEnd: number
  /** Time the aircraft has left the scene. */
  totalTime: number
  blocks: Box[]
  overview: Box
  ribbon: {
    center: Float32Array
    side: Float32Array
    edge: Float32Array
    time: Float32Array
    seed: Float32Array
    size: Float32Array
    index: Uint32Array
  }
}

function resample(points: THREE.Vector3[], ds: number): THREE.Vector3[] {
  if (points.length < 2) return points.slice()
  const out = [points[0].clone()]
  let carry = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const len = a.distanceTo(b)
    let d = ds - carry
    while (d <= len) {
      out.push(a.clone().lerp(b, d / len))
      d += ds
    }
    carry = len - (d - ds)
  }
  const last = points[points.length - 1]
  if (out[out.length - 1].distanceToSquared(last) > 1e-8) out.push(last.clone())
  return out
}

/** Split a polyline at sharp corners. */
function splitCorners(points: THREE.Vector3[]): THREE.Vector3[][] {
  const parts: THREE.Vector3[][] = []
  let current = [points[0]]
  const limit = Math.cos(THREE.MathUtils.degToRad(CORNER_DEG))
  for (let i = 1; i < points.length - 1; i++) {
    current.push(points[i])
    const d0 = points[i].clone().sub(points[i - 1]).normalize()
    const d1 = points[i + 1].clone().sub(points[i]).normalize()
    if (d0.dot(d1) < limit) {
      parts.push(current)
      current = [points[i]]
    }
  }
  current.push(points[points.length - 1])
  parts.push(current)
  return parts.filter((p) => p.length >= 2)
}

function endDir(pts: THREE.Vector3[], atStart: boolean): THREE.Vector3 {
  const n = pts.length
  const span = Math.min(4, n - 1)
  return atStart
    ? pts[span].clone().sub(pts[0]).normalize()
    : pts[n - 1].clone().sub(pts[n - 1 - span]).normalize()
}

/**
 * Smooth pen-up manoeuvre between two strokes: a cubic Bézier that leaves along the
 * previous stroke's heading and arrives along the next one's, lifted out of the
 * writing plane with a sin² bump (zero slope at both ends → no heading kinks).
 * For corners (same start/end point) this becomes the classic skywriter's loop.
 */
function connector(pA: THREE.Vector3, dA: THREE.Vector3, pB: THREE.Vector3, dB: THREE.Vector3, size: number): THREE.Vector3[] {
  const dist = pA.distanceTo(pB)
  const k = THREE.MathUtils.clamp(dist * 0.45, 0.42 * size, 5)
  const lift = Math.min(0.45 * size + dist * 0.12, 3.2)
  const c1 = pA.clone().addScaledVector(dA, k)
  const c2 = pB.clone().addScaledVector(dB, -k)
  const steps = Math.max(24, Math.ceil((dist + 2 * k) / (DS * 0.5)))
  const out: THREE.Vector3[] = []
  const p = new THREE.Vector3()
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    p.set(0, 0, 0)
      .addScaledVector(pA, u * u * u)
      .addScaledVector(c1, 3 * u * u * t)
      .addScaledVector(c2, 3 * u * t * t)
      .addScaledVector(pB, t * t * t)
    p.z += lift * Math.sin(Math.PI * t) ** 2
    out.push(p.clone())
  }
  return out
}

interface PlacedLine {
  text: string
  size: number
  left: number
  baseline: number
  block: number
  line: number
}

function layout(blocks: CreditBlock[]): { lines: PlacedLine[]; boxes: Box[]; overview: Box } {
  const dims = blocks.map((b) => {
    const widths = b.lines.map((l) => measureLine(l.text) * (l.size ?? 1))
    const heights = b.lines.map((l) => l.size ?? 1)
    const h = heights.reduce((a, c) => a + c, 0) + LINE_GAP * Math.max(0, b.lines.length - 1)
    return { w: Math.max(...widths), h, widths, heights }
  })

  // Rows: wide blocks alone, others paired side by side.
  const rows: number[][] = []
  let pending: number[] = []
  blocks.forEach((b, i) => {
    if (b.wide) {
      if (pending.length) rows.push(pending)
      pending = []
      rows.push([i])
    } else {
      pending.push(i)
      if (pending.length === 2) {
        rows.push(pending)
        pending = []
      }
    }
  })
  if (pending.length) rows.push(pending)

  const colW = Math.max(...dims.map((d, i) => (blocks[i].wide ? 0 : d.w)), 1)
  const boxes: Box[] = new Array(blocks.length)
  let y = 0
  for (const row of rows) {
    const rowH = Math.max(...row.map((i) => dims[i].h))
    const cy = y - rowH / 2
    if (row.length === 1) {
      boxes[row[0]] = { cx: 0, cy, w: dims[row[0]].w, h: dims[row[0]].h }
    } else {
      const offset = colW / 2 + COLUMN_GAP / 2
      boxes[row[0]] = { cx: -offset, cy, w: dims[row[0]].w, h: dims[row[0]].h }
      boxes[row[1]] = { cx: offset, cy, w: dims[row[1]].w, h: dims[row[1]].h }
    }
    y -= rowH + ROW_GAP
  }

  const lines: PlacedLine[] = []
  let lineIndex = 0
  blocks.forEach((b, bi) => {
    const box = boxes[bi]
    let top = box.cy + box.h / 2
    b.lines.forEach((l, li) => {
      const size = l.size ?? 1
      const baseline = top - dims[bi].heights[li]
      lines.push({ text: l.text, size, left: box.cx - dims[bi].widths[li] / 2, baseline, block: bi, line: lineIndex++ })
      top = baseline - LINE_GAP
    })
  })

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const b of boxes) {
    minX = Math.min(minX, b.cx - b.w / 2)
    maxX = Math.max(maxX, b.cx + b.w / 2)
    minY = Math.min(minY, b.cy - b.h / 2)
    maxY = Math.max(maxY, b.cy + b.h / 2)
  }
  const overview = { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
  return { lines, boxes, overview }
}

function strokeSegments(placed: PlacedLine): Segment[] {
  const out: Segment[] = []
  let pen = placed.left
  for (const ch of placed.text) {
    const glyph = getGlyph(ch)
    if (!glyph) {
      pen += SPACE_WIDTH * placed.size
      continue
    }
    for (const stroke of glyph.strokes) {
      const world = stroke.map(([gx, gy]: Pt) => new THREE.Vector3(pen + gx * placed.size, placed.baseline + gy * placed.size, 0))
      for (const part of splitCorners(world)) {
        out.push({ pts: resample(part, DS), smoke: true, block: placed.block, line: placed.line, size: placed.size })
      }
    }
    pen += (glyph.w + LETTER_SPACING) * placed.size
  }
  return out
}

/** Build the full aircraft route, its timeline and the persistent smoke ribbon. */
export function buildFlightPlan(blocks: CreditBlock[]): FlightPlan {
  const { lines, boxes, overview } = layout(blocks)
  const strokes = lines.flatMap(strokeSegments)

  // Interleave pen-up connectors, plus an approach and a fly-out.
  const route: Segment[] = []
  const first = strokes[0]
  const approachStart = first.pts[0].clone().add(new THREE.Vector3(-16, 5, 4))
  const approach = connector(approachStart, new THREE.Vector3(1, -0.2, 0).normalize(), first.pts[0], endDir(first.pts, true), 2)
  route.push({ pts: resample(approach, DS), smoke: false, block: first.block, line: first.line, size: 1 })

  strokes.forEach((s, i) => {
    if (i > 0) {
      const prev = strokes[i - 1]
      const c = connector(
        prev.pts[prev.pts.length - 1],
        endDir(prev.pts, false),
        s.pts[0],
        endDir(s.pts, true),
        Math.max(prev.size, s.size),
      )
      // Camera follows the aircraft to the next block as soon as it heads there.
      route.push({ pts: resample(c, DS), smoke: false, block: s.block, line: s.line, size: s.size })
    }
    route.push(s)
  })

  const last = strokes[strokes.length - 1]
  const lastEnd = last.pts[last.pts.length - 1]
  const exit = connector(lastEnd, endDir(last.pts, false), lastEnd.clone().add(new THREE.Vector3(18, 7, 5)), new THREE.Vector3(1, 0.35, 0.15).normalize(), 2)
  route.push({ pts: resample(exit, DS), smoke: false, block: last.block, line: last.line, size: 1 })

  // Flatten, dropping duplicate junction points.
  const pos: THREE.Vector3[] = []
  const smoke: number[] = []
  const block: number[] = []
  const line: number[] = []
  const targetSpeed: number[] = []
  const indexOf = new Map<THREE.Vector3, number>()
  for (const seg of route) {
    const start = pos.length && pos[pos.length - 1].distanceToSquared(seg.pts[0]) < 1e-10 ? 1 : 0
    if (start) indexOf.set(seg.pts[0], pos.length - 1)
    for (let i = start; i < seg.pts.length; i++) {
      indexOf.set(seg.pts[i], pos.length)
      pos.push(seg.pts[i])
      // A sample emits smoke on the way TO it; the first point of a stroke starts the trail.
      smoke.push(seg.smoke ? 1 : 0)
      block.push(seg.block)
      line.push(seg.line)
      targetSpeed.push(seg.smoke ? WRITE_SPEED * Math.sqrt(Math.max(0.8, seg.size)) : CONNECT_SPEED)
    }
  }

  // Smooth speed changes so the aircraft never jerks at pen up/down.
  const speed = targetSpeed.slice()
  const alpha = 0.04
  for (let i = 1; i < speed.length; i++) speed[i] = speed[i - 1] + (speed[i] - speed[i - 1]) * alpha
  for (let i = speed.length - 2; i >= 0; i--) speed[i] = speed[i + 1] + (speed[i] - speed[i + 1]) * alpha
  for (let i = 0; i < speed.length; i++) speed[i] = Math.min(speed[i], targetSpeed[i] * 1.4)

  const count = pos.length
  const positions = new Float32Array(count * 3)
  const times = new Float32Array(count)
  let t = 0
  let writeEnd = 0
  for (let i = 0; i < count; i++) {
    positions.set([pos[i].x, pos[i].y, pos[i].z], i * 3)
    if (i > 0) t += pos[i].distanceTo(pos[i - 1]) / Math.max(1, (speed[i] + speed[i - 1]) / 2)
    times[i] = t
    if (smoke[i]) writeEnd = t
  }

  return {
    count,
    positions,
    smoke: Uint8Array.from(smoke),
    times,
    block: Int16Array.from(block),
    line: Int16Array.from(line),
    writeEnd,
    totalTime: t,
    blocks: boxes,
    overview,
    ribbon: buildRibbon(strokes, indexOf, times),
  }
}

/**
 * Ribbon geometry along every smoke stroke. Each vertex stores the time it is emitted,
 * so the shader reveals exactly the trail the aircraft has flown — and keeps it.
 */
function buildRibbon(strokes: Segment[], indexOf: Map<THREE.Vector3, number>, times: Float32Array) {
  const timeOf = (p: THREE.Vector3) => {
    const i = indexOf.get(p)
    return i === undefined ? undefined : times[i]
  }

  const center: number[] = []
  const side: number[] = []
  const edge: number[] = []
  const time: number[] = []
  const seed: number[] = []
  const size: number[] = []
  const index: number[] = []
  const tangent = new THREE.Vector3()
  const normal = new THREE.Vector3(0, 0, 1)
  const s = new THREE.Vector3()

  for (const stroke of strokes) {
    const pts = stroke.pts
    if (pts.length < 2) continue
    const strokeSeed = Math.random() * 100
    const capLen = 0.07 * stroke.size
    // Round-ish caps: extend both ends slightly so corner joins overlap cleanly.
    const head = pts[0].clone().addScaledVector(endDir(pts, true), -capLen)
    const tail = pts[pts.length - 1].clone().addScaledVector(endDir(pts, false), capLen)
    const run = [head, ...pts, tail]
    const t0 = timeOf(pts[0]) ?? 0
    const t1 = timeOf(pts[pts.length - 1]) ?? t0
    const base = center.length / 3
    run.forEach((p, i) => {
      const prev = run[Math.max(0, i - 1)]
      const next = run[Math.min(run.length - 1, i + 1)]
      tangent.copy(next).sub(prev).normalize()
      s.crossVectors(normal, tangent).normalize()
      const tt = i === 0 ? t0 : i === run.length - 1 ? t1 : timeOf(p) ?? t0
      for (const e of [-1, 1]) {
        center.push(p.x, p.y, p.z)
        side.push(s.x, s.y, s.z)
        edge.push(e)
        time.push(tt)
        seed.push(strokeSeed + i * DS)
        size.push(stroke.size)
      }
      if (i > 0) {
        const a = base + (i - 1) * 2
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    })
  }

  return {
    center: Float32Array.from(center),
    side: Float32Array.from(side),
    edge: Float32Array.from(edge),
    time: Float32Array.from(time),
    seed: Float32Array.from(seed),
    size: Float32Array.from(size),
    index: Uint32Array.from(index),
  }
}

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()

/** Index of the last sample at or before time t (binary search). */
export function sampleIndex(plan: FlightPlan, t: number): number {
  let lo = 0
  let hi = plan.count - 1
  if (t <= plan.times[0]) return 0
  if (t >= plan.times[hi]) return hi
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (plan.times[mid] <= t) lo = mid
    else hi = mid
  }
  return lo
}

/** Interpolated aircraft position at time t. */
export function positionAt(plan: FlightPlan, t: number, out: THREE.Vector3): THREE.Vector3 {
  const i = sampleIndex(plan, t)
  const j = Math.min(plan.count - 1, i + 1)
  const span = plan.times[j] - plan.times[i]
  const f = span > 0 ? (t - plan.times[i]) / span : 0
  _a.fromArray(plan.positions, i * 3)
  _b.fromArray(plan.positions, j * 3)
  return out.copy(_a).lerp(_b, THREE.MathUtils.clamp(f, 0, 1))
}
