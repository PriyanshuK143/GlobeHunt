import { readFileSync } from 'node:fs'
import { publicFile } from '../paths.js'
import type { GameConfig, Difficulty } from '../../../shared/multiplayer.js'
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

interface RegionGuide {
  lat: number
  lng: number
  altitude: number
}

let pool: LocationPool | null = null
let regionAnchors: Map<string, { lat: number; lng: number }> | null = null
function loadPool(): LocationPool {
  if (pool) return pool
  pool = JSON.parse(readFileSync(publicFile('game/pool.json'), 'utf8')) as LocationPool
  return pool
}

/**
 * Stable broad-region anchors. Every eligible place in a subregion shares the same
 * guide, so the client receives useful orientation without an answer-centred view.
 */
function anchors(): Map<string, { lat: number; lng: number }> {
  if (regionAnchors) return regionAnchors
  const sums = new Map<string, { x: number; y: number; z: number }>()
  for (const list of Object.values(loadPool().difficulties)) {
    for (const entry of list) {
      const key = `${entry.continent}|${entry.region}`
      const lat = (entry.point[0] * Math.PI) / 180
      const lng = (entry.point[1] * Math.PI) / 180
      const sum = sums.get(key) ?? { x: 0, y: 0, z: 0 }
      sum.x += Math.cos(lat) * Math.cos(lng)
      sum.y += Math.sin(lat)
      sum.z += Math.cos(lat) * Math.sin(lng)
      sums.set(key, sum)
    }
  }
  regionAnchors = new Map(
    [...sums].map(([key, sum]) => {
      const h = Math.hypot(sum.x, sum.z)
      return [key, { lat: (Math.atan2(sum.y, h) * 180) / Math.PI, lng: (Math.atan2(sum.z, sum.x) * 180) / Math.PI }]
    }),
  )
  return regionAnchors
}

function guideFor(challenge: ServerChallenge, difficulty: Difficulty): RegionGuide {
  const anchor = anchors().get(`${challenge.continent}|${challenge.region}`)
  const baseAltitude: Record<Difficulty, number> = { simple: 2.55, medium: 2.4, hard: 2.2, expert: 2.4 }
  const featureAltitude: Record<string, number> = { sea: 2.6, desert: 2.55, range: 2.55, island: 2.5, river: 2.5, lake: 2.3, mountain: 2.3, strait: 2.3 }
  const altitude = difficulty === 'expert' ? featureAltitude[challenge.featureKind ?? ''] ?? baseAltitude.expert : baseAltitude[difficulty]
  // The fallback is only for malformed source data; normal challenge records always
  // have a broad-region anchor.
  return { ...(anchor ?? { lat: 0, lng: 0 }), altitude }
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

/** What clients receive at round start: a broad regional guide, never answer geometry. */
export function toClientChallenge(challenge: ServerChallenge, difficulty: Difficulty, roundIndex: number) {
  return {
    roundKey: String(roundIndex),
    kind: challenge.kind,
    name: challenge.name,
    featureKind: challenge.featureKind,
    guide: guideFor(challenge, difficulty),
  }
}

export function poolSizes(): Record<PoolDifficulty, number> {
  const d = loadPool().difficulties
  return { simple: d.simple.length, medium: d.medium.length, hard: d.hard.length, expert: d.expert.length }
}
