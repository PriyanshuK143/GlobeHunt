import express from 'express'
import { createServer, type Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Server, type Socket } from 'socket.io'
import cors from 'cors'
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/multiplayer.js'
import { RoomManager } from './rooms/RoomManager.js'
import { allowAction, pruneRateLimits } from './rateLimit.js'
import { DEFAULT_TIMINGS, MatchController, type MatchTimings } from './match/MatchController.js'
import { forgetRoom } from './match/challenges.js'

export interface GameServerOptions {
  allowedOrigins: string[]
  trustProxy: boolean
  /** Also accept origins on private LAN addresses (local-network play). */
  allowLan?: boolean
  /** Production browsers always send Origin; reject originless sockets there. */
  allowNonBrowser?: boolean
  timings?: MatchTimings
}

export interface GameServer {
  httpServer: HttpServer
  io: Server<ClientToServerEvents, ServerToClientEvents>
  rooms: RoomManager
  matches: MatchController
  listen: (port: number, host?: string) => Promise<number>
  close: () => Promise<void>
}

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>

/** Reply to a client acknowledgement only if the client actually supplied one. */
function reply<T>(ack: unknown, value: T): void {
  if (typeof ack === 'function') (ack as (v: T) => void)(value)
}

const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback)

/** Per-socket event budget (all events), on top of per-action limits below. */
const SOCKET_EVENT_LIMIT = 40
const SOCKET_EVENT_WINDOW_MS = 5_000

/**
 * Builds the multiplayer server (HTTP health endpoint + Socket.IO game protocol)
 * without starting it, so tests can run it in-process on a random port.
 */
/** http(s) origin whose host is loopback or a private-network address (RFC 1918 / mDNS). */
export function isPrivateLanOrigin(origin: string): boolean {
  let host: string
  try {
    const u = new URL(origin)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    host = u.hostname
  } catch {
    return false
  }
  if (host === 'localhost' || host.endsWith('.local')) return true
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)
}

export function createGameServer(opts: GameServerOptions): GameServer {
  const app = express()
  app.disable('x-powered-by')
  if (opts.trustProxy) app.set('trust proxy', true)

  const originAllowed = (origin: string | undefined) =>
    (!origin && opts.allowNonBrowser !== false) || opts.allowedOrigins.includes(origin ?? '') || (!!opts.allowLan && !!origin && isPrivateLanOrigin(origin))
  const corsOrigin = (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) =>
    cb(null, originAllowed(origin))

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    next()
  })
  app.use(cors({ origin: corsOrigin }))

  const startedAt = Date.now()
  const rooms = new RoomManager()
  app.get('/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.json({ ok: true, service: 'globehunt-server', rooms: rooms.roomCount, uptime: Math.round((Date.now() - startedAt) / 1000) })
  })

  const httpServer = createServer(app)
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: corsOrigin },
    transports: ['websocket', 'polling'],
    // Game payloads are tiny; refuse large frames outright.
    maxHttpBufferSize: 16 * 1024,
    // Browsers send Origin on the WebSocket handshake: reject foreign sites.
    allowRequest: (req, cb) => cb(null, originAllowed(req.headers.origin)),
  })

  const matches = new MatchController(rooms, io, opts.timings ?? DEFAULT_TIMINGS)
  rooms.onDestroy = forgetRoom

  const clientIp = (socket: GameSocket): string => {
    if (opts.trustProxy) {
      const fwd = socket.handshake.headers['x-forwarded-for']
      const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim()
      if (first) return first
    }
    return socket.handshake.address
  }

  /** Leave whatever room this socket is seated in (prevents ghost seats across rooms). */
  const leaveCurrent = (socket: GameSocket) => {
    const current = rooms.getRoomBySocket(socket.id)
    if (!current) return
    const code = current.code
    const updated = rooms.leaveBySocket(socket.id)
    void socket.leave(code)
    if (updated) io.to(code).emit('room_state', updated)
  }

  io.on('connection', (socket) => {
    const ip = clientIp(socket)

    // Generic flood guard for every event on this socket.
    socket.use((_packet, next) => {
      if (allowAction(`sock:${socket.id}`, SOCKET_EVENT_LIMIT, SOCKET_EVENT_WINDOW_MS)) next()
      else next(new Error('Rate limited'))
    })
    socket.on('error', () => {
      socket.emit('room_error', { error: 'Too many requests — slow down' })
    })

    socket.on('room_create', (payload, ack) => {
      try {
        if (!allowAction(`create:${ip}`, 5, 60_000)) {
          reply(ack, { ok: false, error: 'Too many rooms created — wait a moment' })
          return
        }
        leaveCurrent(socket)
        const nickname = typeof payload?.nickname === 'string' ? payload.nickname : ''
        const { room, playerId, sessionToken } = rooms.createRoom(socket.id, nickname)
        void socket.join(room.code)
        reply(ack, { ok: true, room, playerId, sessionToken })
        socket.emit('room_state', room)
      } catch (err) {
        reply(ack, { ok: false, error: errorText(err, 'Couldn’t create the room') })
      }
    })

    socket.on('room_join', (payload, ack) => {
      try {
        const code = typeof payload?.code === 'string' ? payload.code : ''
        if (!allowAction(`join:${ip}`, 20, 60_000) || !allowAction(`join-code:${ip}:${code.slice(0, 8)}`, 8, 30_000)) {
          reply(ack, { ok: false, error: 'Too many join attempts — wait a moment' })
          return
        }
        leaveCurrent(socket)
        const nickname = typeof payload?.nickname === 'string' ? payload.nickname : ''
        const { room, playerId, sessionToken } = rooms.joinRoom(socket.id, code, nickname)
        void socket.join(room.code)
        reply(ack, { ok: true, room, playerId, sessionToken })
        io.to(room.code).emit('room_state', room)
      } catch (err) {
        reply(ack, { ok: false, error: errorText(err, 'Couldn’t join the room') })
      }
    })

    socket.on('room_resume', (payload, ack) => {
      try {
        if (!allowAction(`resume:${ip}`, 20, 60_000)) {
          reply(ack, { ok: false, error: 'Too many attempts — wait a moment' })
          return
        }
        const token = typeof payload?.sessionToken === 'string' ? payload.sessionToken : ''
        if (rooms.hasSocket(socket.id)) leaveCurrent(socket)
        const resumed = token ? rooms.tryReconnect(socket.id, token) : null
        if (!resumed) {
          reply(ack, { ok: false, error: 'Your seat has expired' })
          return
        }
        void socket.join(resumed.room.code)
        reply(ack, { ok: true, room: resumed.room, playerId: resumed.playerId })
        io.to(resumed.room.code).emit('room_state', resumed.room)
        const internal = rooms.getRoom(resumed.room.code)
        const live = internal ? matches.liveRound(internal) : null
        if (live) socket.emit('match_round_start', live)
      } catch (err) {
        reply(ack, { ok: false, error: errorText(err, 'Couldn’t rejoin the room') })
      }
    })

    socket.on('room_leave', () => leaveCurrent(socket))

    socket.on('room_set_ready', (payload) => {
      try {
        const room = rooms.setReady(socket.id, payload?.ready === true)
        io.to(room.code).emit('room_state', room)
      } catch (err) {
        socket.emit('room_error', { error: errorText(err, 'Unable to update ready state') })
      }
    })

    socket.on('room_set_config', (payload) => {
      try {
        const patch = payload && typeof payload === 'object' ? payload : {}
        const room = rooms.setConfig(socket.id, patch)
        io.to(room.code).emit('room_state', room)
      } catch (err) {
        socket.emit('room_error', { error: errorText(err, 'Unable to update settings') })
      }
    })

    socket.on('room_start', (ack) => {
      try {
        matches.startMatch(socket.id)
        reply(ack, { ok: true })
      } catch (err) {
        reply(ack, { ok: false, error: errorText(err, 'Unable to start') })
      }
    })

    socket.on('match_submit_answer', (payload, ack) => {
      try {
        const lat = Number(payload?.lat)
        const lng = Number(payload?.lng)
        const result = matches.submitAnswer(socket.id, lat, lng)
        reply(ack, { ok: true, correct: result.correct })
      } catch (err) {
        reply(ack, { ok: false, error: errorText(err, 'Couldn’t submit your answer') })
      }
    })

    socket.on('match_return_lobby', () => {
      try {
        const room = matches.returnToLobby(socket.id)
        if (room) io.to(room.code).emit('room_state', room)
      } catch (err) {
        socket.emit('room_error', { error: errorText(err, 'Unable to return to lobby') })
      }
    })

    socket.on('match_play_again', (ack) => {
      try {
        const ref = rooms.getPlayerRef(socket.id)
        if (!ref) throw new Error('Not in a room')
        if (ref.player.id !== ref.room.hostId) throw new Error('Only the host can restart')
        if (ref.room.phase !== 'match_results') throw new Error('The match is not finished')
        // startMatch requires the lobby phase: reset, ready everyone connected, start.
        rooms.resetToLobby(ref.room)
        for (const p of ref.room.players.values()) if (p.connected) p.ready = true
        matches.startMatch(socket.id)
        reply(ack, { ok: true })
      } catch (err) {
        reply(ack, { ok: false, error: errorText(err, 'Unable to restart') })
      }
    })

    socket.on('disconnect', () => {
      const code = rooms.getRoomBySocket(socket.id)?.code
      const { room } = rooms.handleDisconnect(socket.id)
      if (room && code) io.to(code).emit('room_state', room)
    })
  })

  const cleanup = setInterval(() => {
    rooms.cleanupExpired()
    pruneRateLimits()
  }, 15_000)
  cleanup.unref()

  return {
    httpServer,
    io,
    rooms,
    matches,
    listen: (port, host) =>
      new Promise((resolve, reject) => {
        httpServer.once('error', reject)
        httpServer.listen(port, host, () => resolve((httpServer.address() as AddressInfo).port))
      }),
    close: () =>
      new Promise((resolve) => {
        clearInterval(cleanup)
        for (const code of [...roomsCodes(rooms)]) rooms.destroyRoom(code)
        void io.close(() => resolve())
      }),
  }
}

function roomsCodes(rooms: RoomManager): string[] {
  return rooms.listCodes()
}
