import type { AtlasLabel, LabelKind } from '../labels/types'

/**
 * Progressive loader for the packaged atlas (public/atlas, built by
 * scripts/build-atlas.mjs). Core labels load at startup; denser tiers load per tile
 * as the camera approaches. Tiles are static same-origin files — no runtime APIs.
 */
interface Tier {
  id: string
  min: number
  cell: number
}
interface Manifest {
  version: number
  kinds: LabelKind[]
  tiers: Tier[]
  tiles: Record<string, string[]>
  attribution: string[]
}

type Row = [string, number, number, number, number, number, string | 0, ...unknown[]]

const BASE = '/atlas'

class AtlasStore {
  private manifest: Manifest | null = null
  private available = new Map<string, Set<string>>()
  private loaded = new Map<string, AtlasLabel[]>()
  private pending = new Set<string>()
  private listeners = new Set<() => void>()
  private flat: AtlasLabel[] = []
  private dirty = false
  version = 0
  failed = false
  readonly ready: Promise<void>

  constructor() {
    this.ready = this.init()
  }

  private async init() {
    try {
      const res = await fetch(`${BASE}/manifest.json`)
      this.manifest = (await res.json()) as Manifest
      for (const [tier, cells] of Object.entries(this.manifest.tiles)) this.available.set(tier, new Set(cells))
      await this.load('core', `${BASE}/core.json`)
    } catch (err) {
      this.failed = true
      console.warn('[GLOBEHUNT] Atlas data unavailable', err)
    }
  }

  get tiers(): Tier[] {
    return this.manifest?.tiers ?? []
  }

  get attribution(): string[] {
    return this.manifest?.attribution ?? []
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Every label loaded so far (stable array between versions). */
  labels(): AtlasLabel[] {
    if (this.dirty) {
      this.flat = [...this.loaded.values()].flat()
      this.dirty = false
    }
    return this.flat
  }

  private parse(rows: Row[], tier: string): AtlasLabel[] {
    const kinds = this.manifest?.kinds ?? []
    return rows.map((r) => {
      const [rawName, lat, lng, kindIdx, priority, maxDistance, country, axis, line, alt] = r as [
        string, number, number, number, number, number, string | 0, [number, number] | 0 | undefined, number[] | 0 | undefined, string | 0 | undefined,
      ]
      const [name, text] = rawName.split('\u0000')
      const kind = kinds[kindIdx] ?? 'region'
      return {
        id: `${kind}:${name}:${lat}:${lng}`,
        name,
        text: text || undefined,
        kind,
        lat,
        lng,
        priority,
        maxDistance,
        country: country || undefined,
        axis: axis ? { lng: axis[0], lat: axis[1] } : undefined,
        line: line || undefined,
        alt: alt ? alt.split('|') : undefined,
        tier,
      }
    })
  }

  private async load(key: string, url: string) {
    if (this.loaded.has(key) || this.pending.has(key)) return
    this.pending.add(key)
    try {
      const rows = (await (await fetch(url)).json()) as Row[]
      this.loaded.set(key, this.parse(rows, key === 'core' ? 'core' : key.split('/')[0]))
      this.dirty = true
      this.version++
      this.listeners.forEach((l) => l())
    } catch {
      // A missing tile just means no extra labels there.
    } finally {
      this.pending.delete(key)
    }
  }

  /**
   * Request tiles of every tier needed at camera distance `distance` within
   * `radiusDeg` of (lat, lng). Cheap to call often: already-loaded tiles are skipped.
   */
  request(lat: number, lng: number, radiusDeg: number, distance: number, maxTier = Infinity) {
    if (!this.manifest) return
    this.manifest.tiers.forEach((tier, i) => {
      if (tier.id === 'core' || i > maxTier) return
      // A tier is needed once the camera is closer than its upper bound.
      const upper = this.manifest!.tiers[i - 1]?.min ?? Infinity
      if (distance > upper * 1.04) return
      this.requestRegion(tier, lat, lng, radiusDeg)
    })
  }

  private requestRegion(tier: Tier, lat: number, lng: number, radiusDeg: number) {
    const cells = this.available.get(tier.id)
    if (!cells) return
    const c = tier.cell
    const latMin = Math.max(-90, lat - radiusDeg)
    const latMax = Math.min(90, lat + radiusDeg)
    const lngRadius = Math.min(180, radiusDeg / Math.max(0.15, Math.cos(((Math.abs(lat) + radiusDeg * 0.5) * Math.PI) / 180)))
    for (let cy = Math.floor((latMin + 90) / c); cy <= Math.floor((latMax + 90) / c); cy++) {
      for (let x = lng - lngRadius; x <= lng + lngRadius + c; x += c) {
        const wrapped = ((((x + 180) % 360) + 360) % 360) - 180
        const cx = Math.floor((wrapped + 180) / c)
        const cell = `${cy}_${cx}`
        if (cells.has(cell)) void this.load(`${tier.id}/${cell}`, `${BASE}/${tier.id}/${cell}.json`)
      }
    }
  }

  /** Load the canonical tiers (core, t1, t2) around a point; resolves when done. */
  async ensureRegion(lat: number, lng: number, km: number): Promise<void> {
    await this.ready
    if (!this.manifest) return
    const deg = km / 111
    const jobs: Promise<void>[] = []
    for (const tier of this.manifest.tiers.slice(1, 3)) {
      const before = new Set(this.pending)
      this.requestRegion(tier, lat, lng, deg)
      for (const key of this.pending) if (!before.has(key)) jobs.push(this.waitFor(key))
    }
    await Promise.all(jobs)
  }

  private waitFor(key: string): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (!this.pending.has(key)) {
          off()
          resolve()
        }
      }
      const off = this.subscribe(check)
      // Failed loads never notify; poll briefly as a fallback.
      const id = window.setInterval(() => {
        if (!this.pending.has(key)) {
          window.clearInterval(id)
          off()
          resolve()
        }
      }, 200)
      check()
    })
  }
}

export const atlasStore = new AtlasStore()
