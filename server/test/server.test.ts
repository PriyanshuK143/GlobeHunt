import { test, before, after, beforeEach } from 'node:test'
import { clearRateLimit } from '../src/rateLimit.ts'
import assert from 'node:assert/strict'
import { io, type Socket } from 'socket.io-client'
import { createGameServer, type GameServer } from '../src/app.ts'
import type { PoolEntry } from '../../shared/geoPool.ts'
import { MAX_ATTEMPTS_PER_ROUND } from '../src/match/MatchController.ts'

let server: GameServer
let url = ''
const TRAVEL = 250
const sockets: Socket[] = []

before(async () => {
  server = createGameServer({ allowedOrigins: ['http://localhost:2002'], trustProxy: false, timings: { travelMs: TRAVEL, resultMs: 250 } })
  const port = await server.listen(0, '127.0.0.1')
  url = `http://127.0.0.1:${port}`
})
after(async () => {
  for (const s of sockets) s.close()
  await server.close()
  await new Promise<void>((r) => server.httpServer.close(() => r()))
})

beforeEach(() => clearRateLimit(''))

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function client(): Promise<Socket> {
  const s = io(url, { transports: ['websocket'], forceNew: true, reconnection: false })
  sockets.push(s)
  await new Promise<void>((resolve, reject) => {
    s.once('connect', () => resolve())
    s.once('connect_error', reject)
  })
  return s
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function call<T = any>(s: Socket, event: string, payload?: unknown): Promise<T> {
  return new Promise((resolve) => {
    if (payload === undefined) s.emit(event, (res: T) => resolve(res))
    else s.emit(event, payload, (res: T) => resolve(res))
  })
}

async function room(names: string[]) {
  const host = await client()
  const created = await call(host, 'room_create', { nickname: names[0] })
  assert.ok(created.ok, created.error)
  assert.equal(typeof created.sessionToken, 'string')
  const others: Socket[] = []
  for (const n of names.slice(1)) {
    const s = await client()
    const joined = await call(s, 'room_join', { code: created.room.code, nickname: n })
    assert.ok(joined.ok, joined.error)
    others.push(s)
  }
  return { host, others, code: created.room.code as string, token: created.sessionToken as string }
}

async function startMatch(host: Socket, others: Socket[], config: Record<string, unknown> = {}) {
  host.emit('room_set_config', { rounds: 2, timerSeconds: 15, ...config })
  await wait(60)
  for (const s of [host, ...others]) s.emit('room_set_ready', { ready: true })
  await wait(60)
  const res = await call(host, 'room_start')
  assert.ok(res.ok, res.error)
}

const currentTarget = (code: string) => server.rooms.getRoom(code)!.match!.currentChallenge as PoolEntry
const at = (e: PoolEntry) => ({ lat: e.point[0], lng: e.point[1] })

test('host-only: non-host cannot change settings or start', async () => {
  const { host, others, code } = await room(['Hosty', 'Guesty'])
  const errs: string[] = []
  others[0].on('room_error', (p: { error: string }) => errs.push(p.error))
  others[0].emit('room_set_config', { rounds: 7 })
  await wait(80)
  assert.ok(errs.some((e) => /host/i.test(e)))
  assert.notEqual(server.rooms.getRoom(code)!.config.rounds, 7)
  const start = await call(others[0], 'room_start')
  assert.equal(start.ok, false)
  host.emit('room_leave')
})

test('room isolation: a player in room A cannot touch room B', async () => {
  const a = await room(['Alpha', 'Bravo'])
  const b = await room(['Charlie'])
  const leaked: unknown[] = []
  a.host.on('room_state', (r: { code: string }) => r.code === b.code && leaked.push(r))
  a.others[0].emit('room_set_config', { rounds: 9 })
  b.host.emit('room_set_config', { rounds: 3 })
  await wait(100)
  assert.equal(server.rooms.getRoom(b.code)!.config.rounds, 3)
  assert.equal(leaked.length, 0, 'room B state leaked to room A')
  const bPlayers = [...server.rooms.getRoom(b.code)!.players.values()].map((p) => p.nickname)
  assert.deepEqual(bPlayers, ['Charlie'])
})

test('joining another room leaves the first (no ghost seats)', async () => {
  const a = await room(['Delta'])
  const b = await room(['Echo'])
  const roamer = await client()
  await call(roamer, 'room_join', { code: a.code, nickname: 'Roamer' })
  await call(roamer, 'room_join', { code: b.code, nickname: 'Roamer' })
  const inA = [...server.rooms.getRoom(a.code)!.players.values()].some((p) => p.nickname === 'Roamer')
  assert.equal(inA, false)
})

test('malicious payloads: missing acks, bad types, huge strings do not crash', async () => {
  const s = await client()
  s.emit('room_create', { nickname: 'NoAck' }) // no ack callback
  s.emit('room_start') // no ack callback
  s.emit('match_submit_answer', { lat: 'x', lng: null })
  s.emit('room_set_config', null)
  s.emit('room_set_ready', 'yes')
  const bad = await call(s, 'room_join', { code: { $gt: '' }, nickname: 'x'.repeat(5000) })
  assert.equal(bad.ok, false)
  const nan = await call(s, 'match_submit_answer', { lat: NaN, lng: 10 })
  assert.equal(nan.ok, false)
  const inj = await call(s, 'room_create', { nickname: '<img src=x onerror=alert(1)>' })
  assert.equal(inj.ok, false)
  const health = await fetch(`${url}/health`).then((r) => r.json())
  assert.equal(health.ok, true)
})

test('config is locked during a match', async () => {
  const { host, others, code } = await room(['Foxtrot'])
  await startMatch(host, others)
  host.emit('room_set_config', { rounds: 20 })
  await wait(80)
  assert.equal(server.rooms.getRoom(code)!.config.rounds, 2)
  const join = await call(await client(), 'room_join', { code, nickname: 'Late' })
  assert.equal(join.ok, false)
})

test('host can use a custom whole-second timer within the supported range', async () => {
  const { host, code } = await room(['TimerHost'])
  host.emit('room_set_config', { rounds: 3, timerSeconds: 73 })
  await wait(80)
  assert.equal(server.rooms.getRoom(code)!.config.rounds, 3)
  assert.equal(server.rooms.getRoom(code)!.config.timerSeconds, 73)
  host.emit('room_set_config', { timerSeconds: 4 })
  await wait(80)
  assert.equal(server.rooms.getRoom(code)!.config.timerSeconds, 73)
})

test('round start sends no answer data; early answers are rejected', async () => {
  const host = await client()
  const created = await call(host, 'room_create', { nickname: 'Golf' })
  const starts: Array<{ challenge: Record<string, unknown> }> = []
  host.on('match_round_start', (p) => starts.push(p))
  host.emit('room_set_ready', { ready: true })
  await wait(50)
  await call(host, 'room_start')
  await wait(30)
  assert.deepEqual(Object.keys(starts[0].challenge).sort(), ['featureKind', 'guide', 'kind', 'name', 'roundKey'].filter((k) => k in starts[0].challenge).sort())
  assert.ok(!('id' in starts[0].challenge) && !('point' in starts[0].challenge) && !('v' in starts[0].challenge))
  assert.deepEqual(Object.keys((starts[0].challenge.guide as Record<string, unknown>)).sort(), ['altitude', 'lat', 'lng'])
  // During the travel window the exact answer must not score.
  const early = await call(host, 'match_submit_answer', at(currentTarget(created.room.code)))
  assert.equal(early.ok, false)
  await wait(TRAVEL + 50)
  const ok = await call(host, 'match_submit_answer', at(currentTarget(created.room.code)))
  assert.equal(ok.ok && ok.correct, true)
})

test('duplicate submissions never double-score', async () => {
  const { host, others, code } = await room(['Hotel', 'India'])
  await startMatch(host, others)
  await wait(TRAVEL + 50)
  const target = at(currentTarget(code))
  const first = await call(host, 'match_submit_answer', target)
  await wait(300)
  await call(host, 'match_submit_answer', target)
  assert.ok(first.correct)
  const player = [...server.rooms.getRoom(code)!.players.values()].find((p) => p.nickname === 'Hotel')!
  assert.equal(player.correctCount, 1)
  assert.ok(player.score > 0 && player.score <= 1000 * 1.0)
})

test('guess attempts are capped and paced per round', async () => {
  const { host, others, code } = await room(['Juliet', 'Kilo'])
  await startMatch(host, others, { difficulty: 'hard' })
  await wait(TRAVEL + 50)
  const t = currentTarget(code)
  const wrong = { lat: -t.point[0], lng: t.point[1] > 0 ? t.point[1] - 180 : t.point[1] + 180 }
  const fast = await Promise.all([call(host, 'match_submit_answer', wrong), call(host, 'match_submit_answer', wrong)])
  assert.ok(fast.some((r) => r.ok === false && /fast/i.test(r.error)))
  for (let i = 0; i < MAX_ATTEMPTS_PER_ROUND; i++) {
    await call(host, 'match_submit_answer', wrong)
    await wait(260)
  }
  const capped = await call(host, 'match_submit_answer', at(t))
  assert.equal(capped.ok, false)
  assert.match(capped.error, /no guesses left/i)
})

test('disconnect + room_resume restores the seat (with the secret token only)', async () => {
  const { host, others, code } = await room(['Lima', 'Mike'])
  const guestToken = [...server.rooms.getRoom(code)!.players.values()].find((p) => p.nickname === 'Mike')!.sessionToken
  others[0].disconnect()
  await wait(100)
  assert.equal([...server.rooms.getRoom(code)!.players.values()].find((p) => p.nickname === 'Mike')!.connected, false)
  const intruder = await client()
  const forged = await call(intruder, 'room_resume', { sessionToken: 'not-a-real-token' })
  assert.equal(forged.ok, false)
  const back = await client()
  const resumed = await call(back, 'room_resume', { sessionToken: guestToken })
  assert.ok(resumed.ok, resumed.error)
  assert.equal(resumed.room.code, code)
  assert.equal([...server.rooms.getRoom(code)!.players.values()].find((p) => p.nickname === 'Mike')!.connected, true)
  host.emit('room_leave')
})

test('full match completes and play-again restarts from results', async () => {
  const { host, others, code } = await room(['November'])
  const done = new Promise<void>((r) => host.once('match_complete', () => r()))
  await startMatch(host, others, { rounds: 1 })
  await wait(TRAVEL + 50)
  await call(host, 'match_submit_answer', at(currentTarget(code)))
  await done
  assert.equal(server.rooms.getRoom(code)!.phase, 'match_results')
  const again = await call(host, 'match_play_again')
  assert.ok(again.ok, again.error)
  assert.equal(server.rooms.getRoom(code)!.phase, 'playing')
})

test('foreign browser origins are refused', async () => {
  const res = await fetch(`${url}/socket.io/?EIO=4&transport=polling`, { headers: { Origin: 'https://evil.example' } })
  assert.equal(res.status, 403)
})
