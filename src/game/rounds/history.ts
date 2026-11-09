import { historyLimit, type PoolDifficulty } from '../../../shared/geoPool'

const KEY = 'globehunt.recentTargets.v1'

type Store = Partial<Record<PoolDifficulty, string[]>>

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store
  } catch {
    return {}
  }
}

/** Ids played recently on this device (avoided across consecutive games). */
export function recentTargets(difficulty: PoolDifficulty): string[] {
  return read()[difficulty] ?? []
}

export function rememberTargets(difficulty: PoolDifficulty, ids: string[], poolSize: number): void {
  const store = read()
  const merged = [...(store[difficulty] ?? []).filter((id) => !ids.includes(id)), ...ids]
  store[difficulty] = merged.slice(-historyLimit(poolSize))
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* storage unavailable — history just isn't kept */
  }
}
