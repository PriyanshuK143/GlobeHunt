import { io } from 'socket.io-client'

const opts = { transports: ['polling', 'websocket'], forceNew: true }

function connect() {
  const s = io('http://127.0.0.1:3001', opts)
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('connect timeout')), 5000)
    s.on('connect', () => {
      clearTimeout(t)
      resolve(s)
    })
    s.on('connect_error', (e) => {
      clearTimeout(t)
      reject(e)
    })
  })
}

const a = await connect()
console.log('a connected')
const created = await new Promise((r) => a.emit('room_create', { nickname: 'HostAce' }, r))
console.log('create', created)
if (!created.ok) process.exit(1)
const code = created.room.code

const b = await connect()
console.log('b connected')
const joined = await new Promise((r) => b.emit('room_join', { code, nickname: 'GuestBee' }, r))
console.log('join', joined.ok, joined.room?.players?.map((p) => p.nickname))

const c = await connect()
const bad = await new Promise((r) => c.emit('room_join', { code: '9999', nickname: 'Nope' }, r))
console.log('bad', bad)

a.emit('room_set_config', { rounds: 5, timerSeconds: 15 })
await new Promise((r) => setTimeout(r, 150))
a.emit('room_set_ready', { ready: true })
b.emit('room_set_ready', { ready: true })
await new Promise((r) => setTimeout(r, 150))

b.on('match_round_start', (p) => console.log('round_start', p.challenge.name))
const start = await new Promise((r) => a.emit('room_start', r))
console.log('start', start)
await new Promise((r) => setTimeout(r, 1000))
const miss = await new Promise((r) => a.emit('match_submit_answer', { lat: 0, lng: 0 }, r))
console.log('miss', miss)

a.close()
b.close()
c.close()
process.exit(0)
