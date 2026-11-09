import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  pickLocations,
  scoreAnswer,
  scoreMultiplier,
  validatePoolAnswer,
  type LocationPool,
  type PoolDifficulty,
} from '../../shared/geoPool.ts'
import { publicFile } from '../src/paths.ts'
import { validateServerAnswer } from '../src/match/geoValidate.ts'

const pool = JSON.parse(readFileSync(publicFile('game/pool.json'), 'utf8')) as LocationPool
const DIFFS: PoolDifficulty[] = ['simple', 'medium', 'hard', 'expert']

test('every difficulty pool is large enough for a 50-round match', () => {
  for (const d of DIFFS) assert.ok(pool.difficulties[d].length >= 50, `${d} has ${pool.difficulties[d].length}`)
})

test('picker: no duplicates within a match, deterministic per seed', () => {
  for (const d of DIFFS) {
    const a = pickLocations(pool.difficulties[d], 25, { seed: 'seed-1' })
    const b = pickLocations(pool.difficulties[d], 25, { seed: 'seed-1' })
    assert.equal(new Set(a.map((e) => e.id)).size, 25)
    assert.deepEqual(a.map((e) => e.id), b.map((e) => e.id))
  }
})

test('picker: avoids recently played ids while the pool allows', () => {
  const list = pool.difficulties.medium
  const first = pickLocations(list, 25, { seed: 'm1' })
  const second = pickLocations(list, 25, { seed: 'm2', recent: first.map((e) => e.id) })
  assert.equal(second.filter((e) => first.some((f) => f.id === e.id)).length, 0)
})

test('validation: every target accepts its own point and rejects its antipode', () => {
  for (const d of DIFFS) {
    for (const e of pool.difficulties[d]) {
      assert.ok(validateServerAnswer(e, { lat: e.point[0], lng: e.point[1] }), `${e.id} rejects its own point`)
      const anti = { lat: -e.point[0], lng: e.point[1] > 0 ? e.point[1] - 180 : e.point[1] + 180 }
      assert.ok(!validateServerAnswer(e, anti), `${e.id} accepts its antipode`)
    }
  }
})

test('validation: country check delegates to the polygon callback', () => {
  const egypt = pool.difficulties.simple.find((e) => e.name === 'Egypt')!
  assert.equal(validatePoolAnswer(egypt, { lat: 0, lng: 0 }, () => false), false)
  assert.equal(validatePoolAnswer(egypt, { lat: 0, lng: 0 }, () => true), true)
})

test('scoring: speed-based, multiplier applied, zero at/after the limit', () => {
  assert.equal(scoreAnswer(0, 30, 1), 1000)
  assert.equal(scoreAnswer(15_000, 30, 1), 500)
  assert.equal(scoreAnswer(30_000, 30, 1), 0)
  assert.equal(scoreAnswer(-5, 30, 1), 0)
  assert.equal(scoreAnswer(0, 30, 1.4), 1400)
  assert.equal(scoreMultiplier({}, 'hard'), 1.4)
  assert.equal(scoreMultiplier({ featureKind: 'mountain' }, 'expert'), 1.7)
})
