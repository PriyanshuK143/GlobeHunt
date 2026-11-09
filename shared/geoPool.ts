/**
 * Location pools, answer validation, scoring and the location picker — shared by the
 * singleplayer client and the multiplayer server so both behave identically.
 * Pools are generated from the atlas datasets by scripts/build-atlas.mjs
 * (public/game/pool.json). Pure TypeScript: no DOM, no Node APIs.
 */

export type PoolDifficulty = 'simple' | 'medium' | 'hard' | 'expert'
export type PoolFeatureKind = 'river' | 'lake' | 'mountain' | 'range' | 'island' | 'desert' | 'sea' | 'strait'

export type PoolValidation =
  | { m: 'country'; atlas: string }
  | { m: 'point'; r: number }
  | { m: 'path'; paths: Array<Array<[number, number]>>; d: number }
  | { m: 'poly'; rings: Array<Array<[number, number]>>; t: number }

export interface PoolEntry {
  id: string
  kind: 'country' | 'city' | 'feature'
  name: string
  featureKind?: PoolFeatureKind
  country?: string
  continent: string
  region: string
  pop?: number
  /** Answer / reveal point [lat, lng]. Never used for camera framing during a search. */
  point: [number, number]
  /** Validation geometry. Paths are [lat, lng]; polygon rings are [lng, lat]. */
  v: PoolValidation
}

export interface LocationPool {
  version: number
  difficulties: Record<PoolDifficulty, PoolEntry[]>
}

export interface LatLngLike {
  lat: number
  lng: number
}

// ───────── geometry ─────────

const R = 6371
const toRad = (d: number) => (d * Math.PI) / 180

export function distanceKm(a: LatLngLike, b: LatLngLike): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180
}

/** Distance from a point to a polyline, sampling each segment (handles the antimeridian). */
function distanceToPolylineKm(p: LatLngLike, pts: Array<{ lat: number; lng: number }>): number {
  if (pts.length === 1) return distanceKm(p, pts[0])
  let min = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const dLng = wrapLng(b.lng - a.lng)
    const steps = Math.max(2, Math.ceil(distanceKm(a, b) / 15))
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      min = Math.min(min, distanceKm(p, { lat: a.lat + (b.lat - a.lat) * t, lng: wrapLng(a.lng + dLng * t) }))
    }
  }
  return min
}

function inRing(p: LatLngLike, ring: Array<[number, number]>): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi + Number.EPSILON) + xi) inside = !inside
  }
  return inside
}

/**
 * Is the guess correct? Countries use the 1:110m country polygons (supplied by the
 * caller, since client and server load them differently); everything else is checked
 * here against radius, river path or feature polygon (+ shore/edge tolerance).
 */
export function validatePoolAnswer(entry: PoolEntry, click: LatLngLike, inCountry: (atlasName: string, click: LatLngLike) => boolean): boolean {
  const v = entry.v
  switch (v.m) {
    case 'country':
      return inCountry(v.atlas, click)
    case 'point':
      return distanceKm(click, { lat: entry.point[0], lng: entry.point[1] }) <= v.r
    case 'path':
      return v.paths.some((path) => distanceToPolylineKm(click, path.map(([lat, lng]) => ({ lat, lng }))) <= v.d)
    case 'poly':
      return v.rings.some(
        (ring) => inRing(click, ring) || distanceToPolylineKm(click, ring.map(([lng, lat]) => ({ lat, lng }))) <= v.t,
      )
  }
}

// ───────── scoring ─────────

export const MAX_BASE_SCORE = 1000

/** Harder categories are worth more per second saved. */
export const DIFFICULTY_MULTIPLIER: Record<PoolDifficulty, number> = { simple: 1, medium: 1.2, hard: 1.4, expert: 1.5 }
/** Expert: feature-specific multipliers (small peaks and straits are the hardest to pin). */
export const FEATURE_MULTIPLIER: Record<PoolFeatureKind, number> = {
  river: 1.45,
  lake: 1.45,
  mountain: 1.7,
  range: 1.4,
  island: 1.45,
  desert: 1.35,
  sea: 1.4,
  strait: 1.7,
}

export function scoreMultiplier(entry: Pick<PoolEntry, 'featureKind'>, difficulty: PoolDifficulty): number {
  return difficulty === 'expert' && entry.featureKind ? FEATURE_MULTIPLIER[entry.featureKind] : DIFFICULTY_MULTIPLIER[difficulty]
}

/** Speed-based score × difficulty multiplier. Wrong answers never score. */
export function scoreAnswer(elapsedMs: number, timerSeconds: number, multiplier: number): number {
  const limit = timerSeconds * 1000
  if (elapsedMs < 0 || elapsedMs >= limit) return 0
  return Math.round(MAX_BASE_SCORE * (1 - elapsedMs / limit) * multiplier)
}

// ───────── picker ─────────

function fnv(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function weighted<T>(rng: () => number, items: T[], weight: (t: T) => number): T {
  const ws = items.map(weight)
  const total = ws.reduce((a, b) => a + b, 0)
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= ws[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const it of items) {
    const k = key(it)
    let arr = m.get(k)
    if (!arr) m.set(k, (arr = []))
    arr.push(it)
  }
  return m
}

export interface PickOptions {
  /** Reproducible picks for a given seed (multiplayer: chosen by the server). */
  seed: string
  /** Recently played ids (previous matches) to avoid while the pool allows. */
  recent?: Iterable<string>
}

/**
 * Region-balanced, anti-repetitive picker:
 * - never repeats an id within a match unless the pool is exhausted;
 * - avoids recently played ids (session history) while enough fresh ones remain;
 * - samples continent → region → country (cities) / feature kind (expert), each level
 *   weighted by √size so dense datasets can't dominate but big regions still get more;
 * - damps the continent / region / country / feature kind of the last few picks and
 *   rejects picks within 800 km of the previous two, so sequences spread out.
 */
export function pickLocations(pool: readonly PoolEntry[], count: number, opts: PickOptions): PoolEntry[] {
  const rng = mulberry32(fnv(opts.seed))
  const recent = new Set(opts.recent ?? [])
  const used = new Set<string>()
  const usedNames = new Set<string>()
  const picks: PoolEntry[] = []

  for (let i = 0; i < count; i++) {
    // Same display name twice in one match would look like a repeat — skip those too.
    let eligible = pool.filter((e) => !used.has(e.id) && !usedNames.has(e.name) && !recent.has(e.id))
    if (eligible.length === 0) eligible = pool.filter((e) => !used.has(e.id) && !usedNames.has(e.name))
    if (eligible.length === 0) {
      used.clear() // pool exhausted: start a new cycle
      usedNames.clear()
      eligible = [...pool]
    }

    const last = picks.slice(-4)
    const lastOf = (f: (e: PoolEntry) => string | undefined, n: number) => new Set(last.slice(-n).map(f))
    const recentCont = lastOf((e) => e.continent, 1)
    const recentCont2 = lastOf((e) => e.continent, 2)
    const recentRegion = lastOf((e) => e.region, 3)
    const recentCountry = lastOf((e) => e.country, 4)
    const recentKind = lastOf((e) => e.featureKind, 2)

    let choice: PoolEntry | null = null
    for (let attempt = 0; attempt < 10 && !choice; attempt++) {
      let level = eligible
      // Expert: rotate through feature kinds first (rivers, lakes, peaks, islands…).
      if (level[0]?.kind === 'feature') {
        const kinds = groupBy(level, (e) => e.featureKind ?? 'other')
        const k = weighted(rng, [...kinds.keys()], (key) => Math.sqrt(kinds.get(key)!.length) * (recentKind.has(key as PoolFeatureKind) ? 0.12 : 1))
        level = kinds.get(k)!
      }
      const conts = groupBy(level, (e) => e.continent)
      const cont = weighted(rng, [...conts.keys()], (key) => {
        let w = Math.sqrt(conts.get(key)!.length)
        if (recentCont.has(key)) w *= 0.12
        else if (recentCont2.has(key)) w *= 0.5
        if (key === 'Antarctica' || key === 'Other') w *= 0.3
        return w
      })
      const regions = groupBy(conts.get(cont)!, (e) => e.region)
      const region = weighted(rng, [...regions.keys()], (key) => Math.sqrt(regions.get(key)!.length) * (recentRegion.has(key) ? 0.1 : 1))
      let bucket = regions.get(region)!
      if (bucket[0]?.kind === 'city') {
        const countries = groupBy(bucket, (e) => e.country ?? '?')
        const c = weighted(rng, [...countries.keys()], (key) => Math.sqrt(countries.get(key)!.length) * (recentCountry.has(key) ? 0.05 : 1))
        bucket = countries.get(c)!
      }
      const candidate = bucket[Math.floor(rng() * bucket.length)]
      const tooClose = picks
        .slice(-2)
        .some((p) => distanceKm({ lat: p.point[0], lng: p.point[1] }, { lat: candidate.point[0], lng: candidate.point[1] }) < 800)
      if (!tooClose || attempt === 9) choice = candidate
    }
    picks.push(choice!)
    used.add(choice!.id)
    usedNames.add(choice!.name)
  }
  return picks
}

/** How many recent ids to remember per difficulty (40% of the pool, capped). */
export function historyLimit(poolSize: number): number {
  return Math.min(300, Math.max(10, Math.floor(poolSize * 0.4)))
}

export function randomSeed(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}
