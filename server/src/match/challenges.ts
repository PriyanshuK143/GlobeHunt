import { readFileSync } from 'node:fs'
import { publicFile } from '../paths.js'
import type { GameConfig } from '../../../shared/multiplayer.js'
import {
  historyLimit,
  pickLocations,
  randomSeed,
  type LocationPool,
  type PoolDifficulty,
  type PoolEntry,
} from '../../../shared/geoPool.js'

/** Server-side challenge = a pool entry (same data the client validates against). */
export type ServerChallenge = PoolEntry

let pool: LocationPool | null = null
function loadPool(): LocationPool {
  if (pool) return pool
  pool = JSON.parse(readFileSync(publicFile('game/pool.json'), 'utf8')) as LocationPool
  return pool
}

/** Per-room history of recent targets per difficulty (avoided across matches). */
const roomHistory = new Map<string, Map<PoolDifficulty, string[]>>()

/**
 * Server-authoritative match selection: one seeded, region-balanced pick for the whole
 * match, kept on the server. Clients only ever see the current round's challenge.
 */
export function selectServerChallenges(config: GameConfig, roomCode: string): ServerChallenge[] {
  const list = loadPool().difficulties[config.difficulty]
  const history = roomHistory.get(roomCode) ?? new Map<PoolDifficulty, string[]>()
  roomHistory.set(roomCode, history)
  const recent = history.get(config.difficulty) ?? []
  const picks = pickLocations(list, config.rounds, { seed: `${roomCode}:${randomSeed()}`, recent })
  history.set(config.difficulty, [...recent.filter((id) => !picks.some((p) => p.id === id)), ...picks.map((p) => p.id)].slice(-historyLimit(list.length)))
  return picks
}

export function forgetRoom(roomCode: string): void {
  roomHistory.delete(roomCode)
}

/** What clients receive at round start: no coordinates, no geometry, no framing. */
export function toClientChallenge(challenge: ServerChallenge) {
  return {
    id: challenge.id,
    kind: challenge.kind,
    name: challenge.name,
    featureKind: challenge.featureKind,
  }
}

export function poolSizes(): Record<PoolDifficulty, number> {
  const d = loadPool().difficulties
  return { simple: d.simple.length, medium: d.medium.length, hard: d.hard.length, expert: d.expert.length }
}
