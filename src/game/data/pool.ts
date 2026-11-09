import type { LocationPool, PoolDifficulty, PoolEntry } from '../../../shared/geoPool'

let poolPromise: Promise<LocationPool> | null = null
let byId: Map<string, PoolEntry> | null = null

/** Generated location pools (public/game/pool.json), fetched once and cached. */
export function loadPool(): Promise<LocationPool> {
  poolPromise ??= fetch('/game/pool.json')
    .then((r) => {
      if (!r.ok) throw new Error(`Location pool unavailable (${r.status})`)
      return r.json() as Promise<LocationPool>
    })
    .then((pool) => {
      byId = new Map()
      for (const list of Object.values(pool.difficulties)) for (const e of list) byId.set(e.id, e)
      return pool
    })
    .catch((err) => {
      poolPromise = null
      throw err
    })
  return poolPromise
}

export async function loadDifficultyPool(difficulty: PoolDifficulty): Promise<PoolEntry[]> {
  return (await loadPool()).difficulties[difficulty]
}

/** Synchronous lookup once the pool has loaded (e.g. a multiplayer challenge id). */
export function poolEntryById(id: string | null | undefined): PoolEntry | null {
  return (id && byId?.get(id)) || null
}
