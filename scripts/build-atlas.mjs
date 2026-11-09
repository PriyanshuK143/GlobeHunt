/**
 * GLOBEHUNT atlas data pipeline.
 *
 * Downloads open geographic datasets (cached in .atlas-cache/), normalises and
 * deduplicates them, assigns every feature a zoom tier, and packages compact tiles +
 * simplified line layers into public/atlas/ for progressive loading at runtime.
 *
 * Sources (see public/atlas/manifest.json → attribution):
 *  - Natural Earth 1:10m / 1:50m (public domain): populated places, admin-1 labels and
 *    boundaries, physical regions, elevation points, marine areas, rivers, lakes,
 *    airports, ports, country boundaries, disputed lines, coastline.
 *  - GeoNames cities1000 (CC BY 4.0): ~170k populated places with population ≥ 1,000.
 *
 * Usage:  node scripts/build-atlas.mjs           (downloads missing sources)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, createWriteStream } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { Readable } from 'node:stream'
import { finished } from 'node:stream/promises'

const CACHE = '.atlas-cache'
const OUT = 'public/atlas'
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson'
const SOURCES = [
  'ne_10m_populated_places_simple',
  'ne_10m_admin_1_label_points',
  'ne_10m_admin_1_states_provinces_lines',
  'ne_10m_geography_regions_polys',
  'ne_10m_geography_regions_points',
  'ne_10m_geography_regions_elevation_points',
  'ne_10m_geography_marine_polys',
  'ne_10m_rivers_lake_centerlines',
  'ne_10m_lakes',
  'ne_50m_lakes',
  'ne_10m_airports',
  'ne_10m_ports',
  'ne_50m_admin_0_boundary_lines_land',
  'ne_10m_admin_0_boundary_lines_disputed_areas',
  'ne_50m_coastline',
  'ne_110m_admin_0_countries',
].map((n) => ({ file: `${n}.geojson`, url: `${NE}/${n}.geojson` }))
const GEONAMES = [
  { file: 'admin1CodesASCII.txt', url: 'https://download.geonames.org/export/dump/admin1CodesASCII.txt' },
  { file: 'cities1000.zip', url: 'https://download.geonames.org/export/dump/cities1000.zip' },
  { file: 'countryInfo.txt', url: 'https://download.geonames.org/export/dump/countryInfo.txt' },
]

async function download({ file, url }) {
  const path = `${CACHE}/${file}`
  if (existsSync(path)) return
  console.log('↓', url)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  await finished(Readable.fromWeb(res.body).pipe(createWriteStream(path)))
}

const geo = (file) => JSON.parse(readFileSync(`${CACHE}/${file}.geojson`, 'utf8')).features

// ───────── helpers ─────────
const q3 = (v) => Math.round(v * 1000) / 1000
const q2 = (v) => Math.round(v * 100) / 100
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
const R = 6371
const toRad = (d) => (d * Math.PI) / 180
function km(a, b) {
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}
const nameOf = (p) => p.name_en || p.NAME_EN || p.name || p.NAME || null
/** Natural Earth lakes: `name` holds the English label ("Lake Victoria"); name_en is unreliable. */
const lakeName = (p) => (/^(Lago|Lac|Lagoa|Lacul|Ozero|Jezioro)\b/.test(p.name ?? '') && p.name_en ? `Lake ${p.name_en}` : p.name || p.name_en)

/** Douglas–Peucker in lng/lat degrees. */
function simplify(pts, tol) {
  if (pts.length <= 2) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const [x1, y1] = pts[a]
    const [x2, y2] = pts[b]
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy) || 1e-12
    let max = 0
    let idx = -1
    // Closed rings start and end on the same point: measure from that point instead.
    const degenerate = Math.hypot(dx, dy) < 1e-9
    for (let i = a + 1; i < b; i++) {
      const d = degenerate
        ? Math.hypot(pts[i][0] - x1, pts[i][1] - y1)
        : Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / len
      if (d > max) {
        max = d
        idx = i
      }
    }
    if (max > tol && idx > 0) {
      keep[idx] = 1
      stack.push([a, idx], [idx, b])
    }
  }
  return pts.filter((_, i) => keep[i])
}

function lines(geom) {
  if (!geom) return []
  if (geom.type === 'LineString') return [geom.coordinates]
  if (geom.type === 'MultiLineString') return geom.coordinates
  if (geom.type === 'Polygon') return geom.coordinates
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat()
  return []
}

function outerRings(geom) {
  if (geom.type === 'Polygon') return [geom.coordinates[0]]
  if (geom.type === 'MultiPolygon') return geom.coordinates.map((p) => p[0])
  return []
}

function ringArea(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  return Math.abs(a / 2)
}

function inRing(pt, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Approximate "pole of inaccessibility" so labels sit inside concave shapes. */
function labelPoint(geom) {
  const rings = outerRings(geom).sort((a, b) => ringArea(b) - ringArea(a))
  const ring = rings[0]
  if (!ring) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of ring) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  if (maxX - minX > 180) {
    // antimeridian-crossing: fall back to the vertex average
    const n = ring.length
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n]
  }
  let best = [(minX + maxX) / 2, (minY + maxY) / 2]
  let bestD = -1
  const N = 14
  const step = ring.length > 400 ? Math.ceil(ring.length / 400) : 1
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const p = [minX + ((maxX - minX) * i) / N, minY + ((maxY - minY) * j) / N]
      if (!inRing(p, ring)) continue
      let d = Infinity
      for (let k = 0; k < ring.length; k += step) d = Math.min(d, Math.hypot(ring[k][0] - p[0], ring[k][1] - p[1]))
      if (d > bestD) {
        bestD = d
        best = p
      }
    }
  }
  return best
}

/** Principal axis of a polygon (for rotated mountain-range labels): second point. */
function axisPoint(geom, centre) {
  const ring = outerRings(geom).sort((a, b) => ringArea(b) - ringArea(a))[0]
  if (!ring || ring.length < 4) return null
  let sxx = 0, syy = 0, sxy = 0
  const cosLat = Math.cos(toRad(centre[1]))
  for (const [x, y] of ring) {
    const dx = (x - centre[0]) * cosLat
    const dy = y - centre[1]
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  const elong = Math.sqrt((sxx + syy + Math.hypot(sxx - syy, 2 * sxy)) / Math.max(1e-9, sxx + syy - Math.hypot(sxx - syy, 2 * sxy)))
  if (!(elong > 1.6)) return null
  const len = 0.5
  return [q3(centre[0] + (Math.cos(angle) * len) / cosLat), q3(centre[1] + Math.sin(angle) * len)]
}

// ───────── label records ─────────
// Row format written to tiles: [name, lat, lng, kind, priority, maxDistance, country?, axisLng?, axisLat?]
const labels = []
let settlementPlaces = []
function add(rec) {
  if (!rec.name || !Number.isFinite(rec.lat) || !Number.isFinite(rec.lng)) return
  labels.push(rec)
}

function settlementTier(pop, cls) {
  if (cls === 'capital') return { maxD: pop > 5e6 ? 3.6 : pop > 1e6 ? 3.0 : 2.5, pri: 74 + Math.min(10, Math.log10(1 + pop)) }
  if (cls === 'admincap')
    return { maxD: pop > 2e6 ? 2.6 : pop > 5e5 ? 2.15 : pop > 1e5 ? 1.8 : 1.5, pri: 52 + Math.min(10, Math.log10(1 + pop)) }
  const maxD =
    pop > 5e6 ? 3.0 : pop > 2e6 ? 2.6 : pop > 1e6 ? 2.3 : pop > 5e5 ? 2.0 : pop > 2e5 ? 1.75 : pop > 1e5 ? 1.55 : pop > 5e4 ? 1.38 : pop > 2e4 ? 1.24 : pop > 5e3 ? 1.16 : 1.11
  return { maxD, pri: 20 + Math.min(28, Math.log10(1 + pop) * 4) }
}

function buildSettlements() {
  const countries = new Map()
  for (const line of readFileSync(`${CACHE}/countryInfo.txt`, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue
    const c = line.split('\t')
    countries.set(c[0], c[4])
  }
  const admin1 = new Map()
  if (existsSync(`${CACHE}/admin1CodesASCII.txt`))
    for (const line of readFileSync(`${CACHE}/admin1CodesASCII.txt`, 'utf8').split('\n')) {
      const c = line.split('\t')
      if (c[0]) admin1.set(c[0], c[1])
    }
  // Grid index for dedupe (0.2° cells).
  const grid = new Map()
  const key = (lng, lat) => `${Math.floor(lng * 5)},${Math.floor(lat * 5)}`
  const near = (lng, lat) => {
    const out = []
    const cx = Math.floor(lng * 5)
    const cy = Math.floor(lat * 5)
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(...(grid.get(`${cx + dx},${cy + dy}`) ?? []))
    return out
  }
  const places = []
  const put = (p) => {
    places.push(p)
    const k = key(p.lng, p.lat)
    if (!grid.has(k)) grid.set(k, [])
    grid.get(k).push(p)
  }

  // Natural Earth: curated classes (capitals, admin capitals) and best English names.
  for (const f of geo('ne_10m_populated_places_simple')) {
    const p = f.properties
    const [lng, lat] = f.geometry.coordinates
    const fc = p.featurecla ?? ''
    const cls = fc.startsWith('Admin-0 capital') ? 'capital' : fc.startsWith('Admin-1') || fc === 'Admin-0 region capital' ? 'admincap' : 'place'
    const pop = Math.max(p.pop_max ?? 0, p.pop_min ?? 0)
    put({ name: p.name, alt: [p.nameascii, p.namealt].filter(Boolean), lng, lat, pop, cls, country: p.adm0name, iso: p.iso_a2, admin1: p.adm1name, src: 'ne', code: 'NE' })
  }

  // GeoNames: dense towns & villages. Skip sections, historical, abandoned, destroyed places.
  const skip = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH'])
  for (const line of readFileSync(`${CACHE}/cities1000.txt`, 'utf8').split('\n')) {
    if (!line) continue
    const c = line.split('\t')
    const code = c[7]
    if (c[6] !== 'P' || skip.has(code)) continue
    const lat = +c[4]
    const lng = +c[5]
    const pop = +c[14] || 0
    const name = c[1]
    const n = norm(name)
    const dup = near(lng, lat).find((o) => km([o.lng, o.lat], [lng, lat]) < 15 && (norm(o.name) === n || o.alt?.some((a) => norm(a) === n) || norm(c[2]) === norm(o.name)))
    if (dup) {
      dup.pop = Math.max(dup.pop, pop)
      continue
    }
    const cls = code === 'PPLC' ? 'capital' : code === 'PPLA' ? 'admincap' : 'place'
    put({ name, alt: [c[2]], lng, lat, pop, cls, country: countries.get(c[8]) ?? c[8], iso: c[8], admin1: admin1.get(`${c[8]}.${c[10]}`), src: 'gn', code })
  }

  for (const p of places) {
    const { maxD, pri } = settlementTier(p.pop, p.cls)
    const kind = p.cls === 'capital' ? 'capital' : p.cls === 'admincap' ? 'admincap' : p.pop >= 1e5 ? 'city' : p.pop >= 1e4 ? 'town' : 'village'
    add({ name: p.name, lat: p.lat, lng: p.lng, kind, pri, maxD, country: p.country })
  }
  settlementPlaces = places
  return places.length
}

function rankD(rank, table) {
  for (const [r, d] of table) if (rank <= r) return d
  return table[table.length - 1][1]
}

function buildPhysical() {
  // Marine areas.
  for (const f of geo('ne_10m_geography_marine_polys')) {
    const p = f.properties
    const fc = p.featurecla
    if (fc === 'river' || fc === 'reef' || fc === 'generic') continue
    const pt = labelPoint(f.geometry)
    if (!pt) continue
    const sr = p.scalerank ?? 6
    const kind = fc === 'ocean' ? 'ocean' : fc === 'sea' ? 'sea' : 'bay'
    const maxD = kind === 'ocean' ? 6 : rankD(sr, [[1, 3.8], [2, 3.2], [3, 2.7], [4, 2.25], [5, 1.85], [99, 1.5]])
    add({ name: nameOf(p), lat: pt[1], lng: pt[0], kind, pri: kind === 'ocean' ? 100 : 66 - sr * 3, maxD })
  }
  // Physical regions (ranges, deserts, plateaus, islands…).
  const REGION_KIND = {
    'Range/mtn': 'range', Desert: 'desert', Plateau: 'plateau', Plain: 'plateau', Basin: 'plateau', Lowland: 'plateau',
    Valley: 'region', Depression: 'region', Delta: 'region', Wetlands: 'region', Tundra: 'region', Foothills: 'region',
    Gorge: 'region', Geoarea: 'region', Peninsula: 'region', 'Pen/cape': 'region', Isthmus: 'region', Coast: 'region',
    Island: 'island', 'Island group': 'island',
  }
  for (const f of geo('ne_10m_geography_regions_polys')) {
    const p = f.properties
    const kind = REGION_KIND[p.FEATURECLA]
    if (!kind) continue
    const pt = labelPoint(f.geometry)
    if (!pt) continue
    const sr = p.SCALERANK ?? 6
    const maxD = rankD(sr, [[1, 3.6], [2, 3.0], [3, 2.6], [4, 2.2], [5, 1.85], [6, 1.6], [99, 1.38]])
    const axis = kind === 'range' ? axisPoint(f.geometry, pt) : null
    add({ name: p.NAME_EN || p.NAME, lat: pt[1], lng: pt[0], kind, pri: 58 - sr * 3, maxD, axis })
  }
  for (const f of geo('ne_10m_geography_regions_points')) {
    const p = f.properties
    const kind = p.featurecla === 'island' || p.featurecla === 'island group' ? 'island' : 'landmark'
    const [lng, lat] = f.geometry.coordinates
    add({ name: nameOf(p), lat, lng, kind, pri: 34 - (p.scalerank ?? 6), maxD: rankD(p.scalerank ?? 6, [[3, 2.2], [5, 1.7], [99, 1.35]]) })
  }
  // Peaks and elevation points.
  for (const f of geo('ne_10m_geography_regions_elevation_points')) {
    const p = f.properties
    if (p.featurecla === 'spot elevation' || p.featurecla === 'cape') continue
    const [lng, lat] = f.geometry.coordinates
    const sr = p.scalerank ?? 8
    const kind = p.featurecla === 'mountain' ? 'mountain' : 'region'
    const label = p.featurecla === 'mountain' && p.elevation ? `${nameOf(p)} ${Math.round(p.elevation).toLocaleString('en')} m` : nameOf(p)
    add({ name: nameOf(p), label, lat, lng, kind, pri: 40 - sr * 2 + Math.min(8, (p.elevation ?? 0) / 1000), maxD: rankD(sr, [[2, 2.6], [4, 2.0], [6, 1.6], [99, 1.3]]) })
  }
  // Lakes (10m: names and ranks).
  for (const f of geo('ne_10m_lakes')) {
    const p = f.properties
    const pt = labelPoint(f.geometry)
    if (!pt || !lakeName(p)) continue
    const sr = p.scalerank ?? 8
    add({ name: lakeName(p), lat: pt[1], lng: pt[0], kind: 'lake', pri: 46 - sr * 3, maxD: rankD(sr, [[1, 3.0], [2, 2.6], [4, 2.1], [6, 1.7], [99, 1.36]]) })
  }
  // Admin-1 names (states, provinces, regions).
  const seen = new Set()
  for (const f of geo('ne_10m_admin_1_label_points')) {
    const p = f.properties
    if (p.featurecla !== 'Admin-1 scale rank' || seen.has(p.adm1_code)) continue
    seen.add(p.adm1_code)
    const [lng, lat] = f.geometry.coordinates
    const sr = p.scalerank ?? 9
    add({ name: p.name, lat, lng, kind: 'admin1', pri: 50 - sr * 1.5, maxD: rankD(sr, [[2, 2.05], [4, 1.78], [6, 1.5], [99, 1.28]]), country: p.admin })
  }
  // Airports and ports.
  for (const f of geo('ne_10m_airports')) {
    const p = f.properties
    const [lng, lat] = f.geometry.coordinates
    const major = p.type === 'major'
    add({ name: p.name_en || `${p.name} Airport`, lat, lng, kind: 'airport', pri: major ? 30 : 18, maxD: major ? 1.5 : p.type === 'mid' ? 1.3 : 1.18 })
  }
  for (const f of geo('ne_10m_ports')) {
    const p = f.properties
    const [lng, lat] = f.geometry.coordinates
    add({ name: `Port of ${p.name}`, lat, lng, kind: 'port', pri: 16 - (p.scalerank ?? 8), maxD: (p.scalerank ?? 8) <= 5 ? 1.32 : 1.18 })
  }
}

// ───────── line layers ─────────
const flat = (pts) => pts.flatMap(([x, y]) => [q2(x), q2(y)])
function lineLayer(file, tol, opts = {}) {
  const out = []
  for (const f of geo(file)) {
    for (const l of lines(f.geometry)) {
      const s = simplify(l, tol)
      if (s.length < 2) continue
      out.push(opts.meta ? [...opts.meta(f.properties), flat(s)] : flat(s))
    }
  }
  return out
}

function buildRivers() {
  // Group river segments by name so each river gets one line label.
  const rivers = []
  const byName = new Map()
  for (const f of geo('ne_10m_rivers_lake_centerlines')) {
    const p = f.properties
    const sr = p.scalerank ?? 9
    const name = p.name_en || p.name || null
    for (const l of lines(f.geometry)) {
      const s = simplify(l, 0.012)
      if (s.length < 2) continue
      rivers.push([sr, flat(s)])
      if (name && p.featurecla === 'River') {
        if (!byName.has(name)) byName.set(name, { sr, parts: [] })
        const r = byName.get(name)
        r.sr = Math.min(r.sr, sr)
        r.parts.push(s)
        r.alt = p.name && p.name !== name ? p.name : r.alt
      }
    }
  }
  for (const [name, r] of byName) {
    // Label line: the longest part (in points), sampled sparsely for runtime placement.
    const longest = r.parts.sort((a, b) => b.length - a.length)[0]
    const sparse = simplify(longest, 0.08)
    const mid = longest[Math.floor(longest.length / 2)]
    add({
      name,
      alt: r.alt,
      lat: mid[1],
      lng: mid[0],
      kind: 'river',
      pri: 50 - r.sr * 3,
      maxD: rankD(r.sr, [[1, 3.2], [2, 2.8], [3, 2.4], [5, 2.0], [7, 1.65], [99, 1.36]]),
      line: flat(sparse),
    })
  }
  return rivers
}

// ───────── tiling ─────────
const TIERS = [
  { id: 'core', min: 2.6, cell: 360 },
  { id: 't1', min: 1.9, cell: 30 },
  { id: 't2', min: 1.4, cell: 15 },
  { id: 't3', min: 1.2, cell: 6 },
  { id: 't4', min: 0, cell: 3 },
]
const KINDS = ['capital', 'admincap', 'city', 'town', 'village', 'ocean', 'sea', 'bay', 'river', 'lake', 'mountain', 'range', 'desert', 'plateau', 'region', 'island', 'admin1', 'airport', 'port', 'landmark']

async function main() {
  mkdirSync(CACHE, { recursive: true })
  for (const s of [...SOURCES, ...GEONAMES]) await download(s)
  if (!existsSync(`${CACHE}/cities1000.txt`)) execFileSync('unzip', ['-o', '-q', `${CACHE}/cities1000.zip`, '-d', CACHE])

  const settlementCount = buildSettlements()
  buildPhysical()
  const rivers = buildRivers()

  // Overwrite in place (deleting the folder first confuses dev-server file watchers);
  // stale tiles from earlier builds are removed at the end.
  mkdirSync(`${OUT}/lines`, { recursive: true })
  const written = new Set()
  const tiles = {}
  const counts = {}
  for (const l of labels) {
    counts[l.kind] = (counts[l.kind] ?? 0) + 1
    const tier = TIERS.find((t) => l.maxD >= t.min)
    const cx = Math.floor((l.lng + 180) / tier.cell)
    const cy = Math.floor((l.lat + 90) / tier.cell)
    const k = tier.id === 'core' ? 'core' : `${tier.id}/${cy}_${cx}`
    const row = [l.label ? `${l.name}\u0000${l.label}` : l.name, q3(l.lat), q3(l.lng), KINDS.indexOf(l.kind), Math.round(l.pri * 10) / 10, l.maxD, l.country ?? 0]
    if (l.axis || l.line || l.alt) row.push(l.axis ?? 0, l.line ?? 0, Array.isArray(l.alt) ? l.alt.filter(Boolean).slice(0, 2).join('|') : l.alt ?? 0)
    ;(tiles[k] ??= []).push(row)
  }
  const index = {}
  for (const [k, rows] of Object.entries(tiles)) {
    rows.sort((a, b) => b[4] - a[4])
    const path = k === 'core' ? `${OUT}/core.json` : `${OUT}/${k}.json`
    mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true })
    writeFileSync(path, JSON.stringify(rows))
    written.add(path)
    if (k !== 'core') {
      const [tier, cell] = k.split('/')
      ;(index[tier] ??= []).push(cell)
    }
  }

  writeFileSync(`${OUT}/lines/borders.json`, JSON.stringify(lineLayer('ne_50m_admin_0_boundary_lines_land', 0.01)))
  writeFileSync(`${OUT}/lines/disputed.json`, JSON.stringify(lineLayer('ne_10m_admin_0_boundary_lines_disputed_areas', 0.01)))
  writeFileSync(`${OUT}/lines/coast.json`, JSON.stringify(lineLayer('ne_50m_coastline', 0.012)))
  writeFileSync(`${OUT}/lines/admin1.json`, JSON.stringify(lineLayer('ne_10m_admin_1_states_provinces_lines', 0.02)))
  writeFileSync(`${OUT}/lines/lakes.json`, JSON.stringify(lineLayer('ne_50m_lakes', 0.01)))
  writeFileSync(`${OUT}/lines/rivers.json`, JSON.stringify(rivers))

  const manifest = {
    version: 1,
    generated: new Date().toISOString().slice(0, 10),
    kinds: KINDS,
    tiers: TIERS,
    tiles: index,
    counts: { ...counts, total: labels.length, settlementsMerged: settlementCount },
    attribution: [
      'Natural Earth — naturalearthdata.com (public domain)',
      'GeoNames — geonames.org (CC BY 4.0)',
      'NASA Blue Marble via GIBS (public domain)',
    ],
  }
  writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1))
  buildGamePool()
  for (const tier of TIERS.slice(1)) {
    const dir = `${OUT}/${tier.id}`
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) if (!written.has(`${dir}/${f}`)) rmSync(`${dir}/${f}`)
  }
  console.log('labels', labels.length, counts)
  console.log('tiles', Object.keys(tiles).length)
}


// ───────── game location pools (one file shared by client and server) ─────────
/**
 * Difficulty pools built from the same datasets as the atlas:
 *  simple → every country/territory in the Natural Earth 1:110m layer used for answer
 *           validation (minus Antarctica and indeterminate/disputed areas);
 *  medium → major cities (≥ 1M) and national capitals (≥ 200k);
 *  hard   → secondary cities and towns (30k–1M), capped per country so dense datasets
 *           don't dominate;
 *  expert → rivers, lakes, peaks, ranges, islands, deserts, seas/gulfs/straits.
 * Each entry carries continent + subregion for region-balanced sampling, a reveal point,
 * and the geometry needed to validate answers (country polygon, radius, path, polygon).
 */
function buildGamePool() {
  const countryInfo = new Map()
  for (const line of readFileSync(`${CACHE}/countryInfo.txt`, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue
    const c = line.split('\t')
    countryInfo.set(c[0], { name: c[4], continent: c[8] })
  }
  const CONTINENT = { AF: 'Africa', AS: 'Asia', EU: 'Europe', NA: 'North America', SA: 'South America', OC: 'Oceania', AN: 'Antarctica' }
  const neCountries = geo('ne_110m_admin_0_countries')
  const subByIso = new Map()
  for (const f of neCountries) {
    const p = f.properties
    for (const iso of [p.ISO_A2, p.ISO_A2_EH]) if (iso && iso !== '-99') subByIso.set(iso, { sub: p.SUBREGION, cont: p.CONTINENT })
  }
  const regionOf = (iso) => {
    const s = subByIso.get(iso)
    const ci = countryInfo.get(iso)
    const cont = s?.cont ?? CONTINENT[ci?.continent] ?? 'Other'
    return { continent: cont === 'Seven seas (open ocean)' ? 'Oceania' : cont, region: s?.sub ?? cont }
  }
  const ll = (lat, lng) => [q3(lat), q3(lng)]
  const ringOut = (ring, tol) => simplify(ring, tol).map(([x, y]) => [q2(x), q2(y)])
  const polyOut = (geom, tol, max = 6) =>
    outerRings(geom)
      .sort((a, b) => ringArea(b) - ringArea(a))
      .slice(0, max)
      .map((r) => ringOut(r, tol))
      .filter((r) => r.length >= 4)

  const countryPts = neCountries.map((f) => ({ x: f.properties.LABEL_X, y: f.properties.LABEL_Y, iso: f.properties.ISO_A2_EH }))
  const regionAt = (lng, lat) => {
    let best = null
    let bd = Infinity
    for (const c of countryPts) {
      const d = km([lng, lat], [c.x, c.y])
      if (d < bd) {
        bd = d
        best = c
      }
    }
    return regionOf(best?.iso)
  }

  // ── simple: countries & territories (names must match the validation polygons)
  const TOPO_ALIAS = { 'North Macedonia': 'Macedonia' }
  const EXCLUDE = new Set(['Antarctica', 'Fr. S. Antarctic Lands', 'N. Cyprus', 'Somaliland', 'W. Sahara'])
  const simple = []
  for (const f of neCountries) {
    const p = f.properties
    if (EXCLUDE.has(p.NAME)) continue
    const atlas = TOPO_ALIAS[p.NAME] ?? p.NAME
    const iso = p.ISO_A2_EH
    const { continent } = regionOf(iso)
    simple.push({
      id: `country:${iso}:${norm(p.NAME)}`,
      kind: 'country',
      // Short common names ("China", "Czechia"), unless the short form is abbreviated.
      name: /\./.test(p.NAME) ? p.NAME_EN || p.NAME_LONG : p.NAME,
      country: p.NAME_EN || p.NAME,
      continent,
      region: p.SUBREGION || continent,
      // Reveal point must lie on the validation polygon (a few label points sit offshore).
      point: (() => {
        const lp = [p.LABEL_X, p.LABEL_Y]
        const inside = outerRings(f.geometry).some((r) => inRing(lp, r))
        const q = inside ? lp : labelPoint(f.geometry)
        return ll(q[1], q[0])
      })(),
      v: { m: 'country', atlas },
    })
  }

  // ── settlements
  const BAD_NAME = /[,/()]|\d/
  const settlements = settlementPlaces.filter((p) => p.name && !BAD_NAME.test(p.name) && p.iso && p.iso !== '-99')
  const nameCount = new Map()
  const nameInCountry = new Map()
  for (const p of settlements)
    if (p.pop >= 30000) {
      nameCount.set(norm(p.name), (nameCount.get(norm(p.name)) ?? 0) + 1)
      const k = `${p.iso}:${norm(p.name)}`
      nameInCountry.set(k, (nameInCountry.get(k) ?? 0) + 1)
    }
  const cityEntry = (p, radius) => {
    const { continent, region } = regionOf(p.iso)
    const countryName = countryInfo.get(p.iso)?.name ?? p.country
    // Disambiguate shared names: same country → add the state/province, else the country.
    const sameCountry = (nameInCountry.get(`${p.iso}:${norm(p.name)}`) ?? 0) > 1
    const dup = (nameCount.get(norm(p.name)) ?? 0) > 1
    const label = sameCountry && p.admin1 ? `${p.name}, ${p.admin1}` : dup ? `${p.name}, ${countryName}` : p.name
    return {
      id: `city:${p.iso}:${norm(p.name)}:${Math.round(p.lat)}:${Math.round(p.lng)}`,
      kind: 'city',
      name: label,
      country: countryName,
      continent,
      region,
      pop: p.pop,
      point: ll(p.lat, p.lng),
      v: { m: 'point', r: radius },
    }
  }
  const medium = settlements
    .filter((p) => p.pop >= 1e6 || (p.cls === 'capital' && p.pop >= 2e5))
    .map((p) => cityEntry(p, Math.round(Math.min(110, Math.max(60, 60 + 30 * Math.log10(p.pop / 1e6 + 1))))))

  const mediumIds = new Set(medium.map((m) => m.id))
  const hardCandidates = settlements.filter(
    (p) => p.pop >= 30000 && p.pop < 1e6 && p.cls !== 'capital' && (p.src === 'ne' || ['PPL', 'PPLA', 'PPLA2', 'PPLA3'].includes(p.code)),
  )
  const byIso = new Map()
  for (const p of hardCandidates) {
    if (!byIso.has(p.iso)) byIso.set(p.iso, [])
    byIso.get(p.iso).push(p)
  }
  const hash = (str) => {
    let h = 2166136261
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
  }
  const hard = []
  for (const [iso, list] of byIso) {
    // Per-country cap grows slowly with dataset size: dense datasets can't dominate.
    const cap = Math.max(6, Math.round(Math.sqrt(list.length) * 3))
    list
      .sort((a, b) => hash(a.name + iso) - hash(b.name + iso))
      .slice(0, cap)
      .forEach((p) => {
        const e = cityEntry(p, Math.round(Math.min(45, Math.max(25, 25 + 10 * Math.log10(p.pop / 3e4)))))
        if (!mediumIds.has(e.id)) hard.push(e)
      })
  }

  // ── expert: physical geography
  const expert = []
  const seenNames = new Set()
  const pushFeature = (e) => {
    e.name = String(e.name ?? '').replace(/\s+/g, ' ').trim()
    const key = `${e.featureKind}:${norm(e.name)}`
    if (!e.name || seenNames.has(key)) return
    // Quality gate: the reveal point must satisfy the feature's own geometry.
    if (e.v.m === 'poly') {
      if (!e.v.rings.length) return
      const pt = [e.point[1], e.point[0]]
      const near = e.v.rings.some((r) => inRing(pt, r) || r.some((q) => km(q, pt) <= e.v.t))
      if (!near) return
    }
    seenNames.add(key)
    expert.push(e)
  }
  const rivers = new Map()
  for (const f of geo('ne_10m_rivers_lake_centerlines')) {
    const p = f.properties
    const name = p.name_en || p.name
    if (!name || p.featurecla !== 'River' || (p.scalerank ?? 9) > 5) continue
    if (!rivers.has(name)) rivers.set(name, { sr: 9, parts: [] })
    const r = rivers.get(name)
    r.sr = Math.min(r.sr, p.scalerank)
    for (const l of lines(f.geometry)) r.parts.push(l)
  }
  for (const [name, r] of rivers) {
    if (/delta|estuary|mouth/i.test(name)) continue
    // Same name, different rivers (e.g. several "Negro" rivers): cluster parts by
    // proximity and skip ambiguous names instead of merging unrelated geometry.
    const clusters = []
    for (const part of r.parts) {
      const hit = clusters.find((c) => c.some((q) => part.some((pt, i) => i % 5 === 0 && q.some((u, j) => j % 5 === 0 && km(pt, u) < 400))))
      if (hit) hit.push(part)
      else clusters.push([part])
    }
    if (clusters.length > 1) continue
    const pts = r.parts.flat()
    let span = 0
    for (let i = 1; i < pts.length; i++) span = Math.max(span, km(pts[0], pts[i]))
    if (pts.length < 6 || span < 150) continue
    const longest = [...r.parts].sort((a, b) => b.length - a.length)[0]
    const mid = longest[Math.floor(longest.length / 2)]
    pushFeature({
      id: `river:${norm(name)}`,
      kind: 'feature',
      featureKind: 'river',
      name,
      ...regionAt(mid[0], mid[1]),
      point: ll(mid[1], mid[0]),
      v: { m: 'path', paths: r.parts.map((l) => simplify(l, 0.05).map(([x, y]) => [q2(y), q2(x)])), d: 40 + (6 - r.sr) * 14 },
    })
  }
  for (const f of geo('ne_10m_lakes')) {
    const p = f.properties
    const name = lakeName(p)
    if (!name || (p.scalerank ?? 9) > 4 || p.featurecla === 'Reservoir') continue
    const pt = labelPoint(f.geometry)
    pushFeature({ id: `lake:${norm(name)}`, kind: 'feature', featureKind: 'lake', name, ...regionAt(pt[0], pt[1]), point: ll(pt[1], pt[0]), v: { m: 'poly', rings: polyOut(f.geometry, 0.04, 2), t: 25 } })
  }
  for (const f of geo('ne_10m_geography_regions_elevation_points')) {
    const p = f.properties
    if (p.featurecla !== 'mountain' || (p.scalerank ?? 9) > 5) continue
    const [lng, lat] = f.geometry.coordinates
    pushFeature({ id: `peak:${norm(nameOf(p))}`, kind: 'feature', featureKind: 'mountain', name: nameOf(p), ...regionAt(lng, lat), point: ll(lat, lng), v: { m: 'point', r: 60 } })
  }
  const REGION_FEATURE = { 'Range/mtn': ['range', 60, 4], Island: ['island', 40, 4], 'Island group': ['island', 60, 3], Desert: ['desert', 60, 4] }
  for (const f of geo('ne_10m_geography_regions_polys')) {
    const p = f.properties
    const spec = REGION_FEATURE[p.FEATURECLA]
    if (!spec || (p.SCALERANK ?? 9) > spec[2]) continue
    const pt = labelPoint(f.geometry)
    const name = p.NAME_EN || p.NAME
    pushFeature({ id: `${spec[0]}:${norm(name)}`, kind: 'feature', featureKind: spec[0], name, ...regionAt(pt[0], pt[1]), point: ll(pt[1], pt[0]), v: { m: 'poly', rings: polyOut(f.geometry, 0.05), t: spec[1] } })
  }
  const MARINE = { sea: 'sea', gulf: 'sea', bay: 'sea', strait: 'strait', channel: 'strait' }
  for (const f of geo('ne_10m_geography_marine_polys')) {
    const p = f.properties
    const fk = MARINE[p.featurecla]
    if (!fk || (p.scalerank ?? 9) > 4) continue
    const pt = labelPoint(f.geometry)
    if (!pt) continue
    const name = nameOf(p)
    pushFeature({ id: `${fk}:${norm(name)}`, kind: 'feature', featureKind: fk, name, ...regionAt(pt[0], pt[1]), point: ll(pt[1], pt[0]), v: { m: 'poly', rings: polyOut(f.geometry, fk === 'strait' ? 0.012 : 0.06, 3), t: fk === 'strait' ? 60 : 40 } })
  }

  const pool = { version: 1, generated: new Date().toISOString().slice(0, 10), difficulties: { simple, medium, hard, expert } }
  mkdirSync('public/game', { recursive: true })
  writeFileSync('public/game/pool.json', JSON.stringify(pool))
  const kinds = {}
  for (const e of expert) kinds[e.featureKind] = (kinds[e.featureKind] ?? 0) + 1
  console.log('pool sizes', { simple: simple.length, medium: medium.length, hard: hard.length, expert: expert.length, expertKinds: kinds })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
