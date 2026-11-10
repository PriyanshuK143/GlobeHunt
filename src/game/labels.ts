import { labelKeys, labelNorm, type AtlasLabel, type LabelFilterFactory, type LabelKind } from '../globe'
import { haversineKm } from '../globe'
import { answerLocation } from './navigation/regionCamera'
import { poolEntryById } from './data/pool'
import type { Challenge } from './types'

const norm = labelNorm

/** What the player is currently looking for (works for singleplayer and multiplayer views). */
export interface LabelTarget {
  kind: 'country' | 'city' | 'feature'
  name: string
  /** Natural Earth name for countries. */
  atlasName?: string
  featureKind?: string
  /** Approximate answer point (country centre / city / feature). */
  near?: { lat: number; lng: number }
  /** River targets: the validation path. */
  path?: Array<{ lat: number; lng: number }>
  /**
   * Shared per-round seed (challenge id + round index). Decoys depend only on it and on
   * static data, so every multiplayer client hides exactly the same labels.
   */
  seed: string
}

const PLACE_KINDS = new Set<LabelKind>(['capital', 'admincap', 'city', 'town', 'village'])
const NAMED_AFTER_KINDS = new Set<LabelKind>(['airport', 'port', 'landmark'])

/** Label kinds that can name a feature target of each type. */
const FEATURE_LABEL_KINDS: Record<string, LabelKind[]> = {
  river: ['river'],
  lake: ['lake'],
  mountain: ['mountain'],
  range: ['range'],
  island: ['island', 'country'],
  desert: ['desert'],
  sea: ['sea', 'bay'],
  strait: ['bay', 'sea'],
}
/** A same-kind label this close to the target's own point is the target under another name. */
const SAME_FEATURE_KM: Record<string, number> = { mountain: 8, lake: 20, island: 40, range: 60, desert: 80, sea: 80, strait: 40 }

/** Is this river line the target river (most of it runs along the target path)? */
function sameRiver(line: number[], path: Array<{ lat: number; lng: number }>): boolean {
  let near = 0
  let total = 0
  for (let i = 0; i < line.length; i += 2) {
    total++
    const p = { lat: line[i + 1], lng: line[i] }
    if (path.some((q) => haversineKm(p, q) < 30)) near++
  }
  return total > 0 && near / total >= 0.6
}

/**
 * Target-only label suppression during an active search: hides exactly the labels that
 * identify the target itself, at every zoom and from every source —
 *  - its name / alternate names (incl. a country label sharing an island's name),
 *  - airports/ports named after it ("Cairo International"),
 *  - the same settlement under another spelling (within 4 km of a target city),
 *  - the same feature under another name (same kind at the target's location; rivers by
 *    shape overlap, so Natural Earth's "Amazonas" is hidden for the Amazon).
 * Nothing else changes: surrounding places, neighbouring countries and capitals render
 * exactly as they would for any other target — no decoys, no styling differences.
 */
export function labelFilterFor(target: LabelTarget | null): LabelFilterFactory | undefined {
  if (!target) return undefined
  const names = new Set([norm(target.name)])
  if (target.atlasName) names.add(norm(target.atlasName))
  const owners = target.kind === 'country' ? new Set([norm(target.name), norm(target.atlasName ?? target.name)]) : null
  const featureKinds = new Set<LabelKind>(FEATURE_LABEL_KINDS[target.featureKind ?? ''] ?? [])
  const sameKm = SAME_FEATURE_KM[target.featureKind ?? ''] ?? 0
  // Exact-name matches count only for kinds that can name this target (so "Lake
  // Victoria" doesn't hide the Seychelles capital Victoria).
  const nameKinds: Set<LabelKind> | null = target.kind === 'feature' ? featureKinds : null
  const namedAfterKm = target.kind === 'city' ? 120 : target.kind === 'feature' ? 400 : 3000

  const identifies = (l: AtlasLabel): boolean => {
    const keys = labelKeys(l)
    if ((!nameKinds || nameKinds.has(l.kind)) && keys.some((k) => names.has(k))) return true
    if (owners && l.kind === 'country' && l.country && owners.has(norm(l.country))) return true
    if (
      NAMED_AFTER_KINDS.has(l.kind) &&
      keys.some((k) => [...names].some((n) => n.length > 3 && k.includes(n))) &&
      (!target.near || haversineKm(target.near, l) < namedAfterKm)
    )
      return true
    if (target.kind === 'city' && target.near && PLACE_KINDS.has(l.kind) && haversineKm(target.near, l) < 4) return true
    if (target.kind === 'city' && target.near && l.kind === 'admin1' && keys.some((k) => names.has(k)) && haversineKm(target.near, l) < 150) return true
    if (target.kind === 'feature' && featureKinds.has(l.kind) && l.kind !== 'country') {
      if (l.kind === 'river' && l.line && target.path) return sameRiver(l.line, target.path)
      if (target.near && haversineKm(target.near, l) < sameKm) return true
    }
    return false
  }

  return (all) => {
    const hidden = new Set<string>()
    for (const l of all) if (identifies(l)) hidden.add(l.id)
    return (l) => !hidden.has(l.id)
  }
}

/** Label target for a pool entry (singleplayer challenge or multiplayer lookup). */
export function labelTargetFor(c: Challenge | null, roundIndex: number): LabelTarget | null {
  if (!c) return null
  const seed = `${c.id}#${roundIndex}`
  const near = answerLocation(c)
  if (c.kind === 'country') return { kind: 'country', name: c.name, atlasName: c.v.m === 'country' ? c.v.atlas : undefined, near, seed }
  if (c.kind === 'city') return { kind: 'city', name: c.name.split(',')[0], near, seed }
  return {
    kind: 'feature',
    name: c.name,
    featureKind: c.featureKind,
    near,
    path: c.v.m === 'path' ? c.v.paths.flat().map(([lat, lng]) => ({ lat, lng })) : undefined,
    seed,
  }
}

/** Multiplayer: the client only receives the challenge id/name; look it up in the pool. */
export function labelTargetForId(id: string | null | undefined, roundIndex: number, fallbackName?: string): LabelTarget | null {
  if (!id) return null
  const entry = poolEntryById(id)
  if (entry) return labelTargetFor(entry, roundIndex)
  return fallbackName ? { kind: 'city', name: fallbackName, seed: `${id}#${roundIndex}` } : null
}

/**
 * Multiplayer searches receive no target coordinates or public-pool identifier.
 * Exact target-name suppression keeps labels useful without creating a location-based
 * gap in the atlas.
 */
export function labelTargetForMultiplayer(
  name: string | undefined,
  kind: LabelTarget['kind'] | undefined,
  featureKind: string | undefined,
  roundKey: string | undefined,
): LabelTarget | null {
  if (!name || !kind || !roundKey) return null
  return { kind, name: kind === 'city' ? name.split(',')[0] : name, featureKind, seed: roundKey }
}
