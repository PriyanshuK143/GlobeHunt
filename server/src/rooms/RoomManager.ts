import { randomInt, randomUUID } from 'node:crypto'
import {
  DEFAULT_MP_CONFIG,
  MAX_PLAYERS,
  type GameConfig,
  MIN_ROUNDS,
  MAX_ROUNDS,
  type PublicPlayer,
  type PublicRoom,
  type RoomPhase,
} from '../../../shared/multiplayer.js'

export interface InternalPlayer {
  id: string
  nickname: string
  ready: boolean
  connected: boolean
  score: number
  correctCount: number
  findTimesMs: number[]
  /** Socket id currently bound (may change on reconnect). */
  socketId: string
  /** Stable session token for soft reconnect. */
  sessionToken: string
}

export interface InternalRoom {
  code: string
  hostId: string
  phase: RoomPhase
  config: GameConfig
  players: Map<string, InternalPlayer>
  createdAt: number
  lastActivityAt: number
  /** Match runtime — filled in Phase 4. */
  match: MatchState | null
}

export interface MatchState {
  // challenges typed loosely here to avoid circular imports; MatchController casts.
  challenges: unknown[]
  roundIndex: number
  roundStartedAt: number
  roundEndsAt: number
  submissions: Map<string, { elapsedMs: number; score: number }>
  /** Guess attempts per player this round (anti brute-force). */
  attempts: Map<string, { count: number; last: number }>
  currentChallenge: unknown | null
  roundTimer: ReturnType<typeof setTimeout> | null
  resultTimer: ReturnType<typeof setTimeout> | null
}

const EMPTY_ROOM_TTL_MS = 60_000
const IDLE_ROOM_TTL_MS = 45 * 60_000
const DISCONNECT_GRACE_MS = 45_000

function randomCode(): string {
  // CSPRNG: room codes must not be predictable.
  return String(randomInt(0, 10000)).padStart(4, '0')
}

function sanitizeNickname(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  if (trimmed.length < 2 || trimmed.length > 16) return null
  if (!/^[\p{L}\p{N} _.-]+$/u.test(trimmed)) return null
  return trimmed
}

function isValidConfig(patch: Partial<GameConfig>): boolean {
  if (patch.difficulty !== undefined) {
    if (!['simple', 'medium', 'hard', 'expert'].includes(patch.difficulty)) return false
  }
  if (patch.rounds !== undefined) {
    if (!Number.isInteger(patch.rounds) || patch.rounds < MIN_ROUNDS || patch.rounds > MAX_ROUNDS) return false
  }
  if (patch.showLabels !== undefined && typeof patch.showLabels !== 'boolean') return false
  if (patch.timerSeconds !== undefined) {
    if (![15, 30, 45, 60].includes(patch.timerSeconds)) return false
  }
  return true
}

export class RoomManager {
  private rooms = new Map<string, InternalRoom>()
  private socketToPlayer = new Map<string, { roomCode: string; playerId: string }>()
  private sessionToPlayer = new Map<string, { roomCode: string; playerId: string }>()
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()
  /** Called whenever a room is destroyed (lets other modules drop per-room state). */
  onDestroy: ((code: string) => void) | null = null

  listCodes(): string[] {
    return [...this.rooms.keys()]
  }

  get roomCount(): number {
    return this.rooms.size
  }

  /** Is this socket currently seated in a room? */
  hasSocket(socketId: string): boolean {
    return this.socketToPlayer.has(socketId)
  }

  createRoom(socketId: string, nicknameRaw: string): { room: PublicRoom; playerId: string; sessionToken: string } {
    const nickname = sanitizeNickname(nicknameRaw)
    if (!nickname) throw new Error('Nickname must be 2–16 letters, numbers, or spaces')

    const code = this.allocateCode()
    const playerId = randomUUID()
    const sessionToken = randomUUID()
    const player: InternalPlayer = {
      id: playerId,
      nickname,
      ready: false,
      connected: true,
      score: 0,
      correctCount: 0,
      findTimesMs: [],
      socketId,
      sessionToken,
    }

    const room: InternalRoom = {
      code,
      hostId: playerId,
      phase: 'lobby',
      config: { ...DEFAULT_MP_CONFIG },
      players: new Map([[playerId, player]]),
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      match: null,
    }

    this.rooms.set(code, room)
    this.socketToPlayer.set(socketId, { roomCode: code, playerId })
    this.sessionToPlayer.set(sessionToken, { roomCode: code, playerId })
    return { room: this.toPublic(room), playerId, sessionToken }
  }

  joinRoom(
    socketId: string,
    codeRaw: string,
    nicknameRaw: string,
  ): { room: PublicRoom; playerId: string; sessionToken: string } {
    const code = codeRaw.trim()
    if (!/^\d{4}$/.test(code)) throw new Error('Room code must be exactly 4 digits')

    const room = this.rooms.get(code)
    if (!room) throw new Error('Room not found')
    if (room.phase !== 'lobby') throw new Error('Match already in progress')

    const connectedCount = [...room.players.values()].filter((p) => p.connected).length
    if (connectedCount >= MAX_PLAYERS) throw new Error('Room is full (max 8 players)')

    const nickname = sanitizeNickname(nicknameRaw)
    if (!nickname) throw new Error('Nickname must be 2–16 letters, numbers, or spaces')

    const taken = [...room.players.values()].some(
      (p) => p.connected && p.nickname.toLowerCase() === nickname.toLowerCase(),
    )
    if (taken) throw new Error('Nickname already taken in this room')

    const playerId = randomUUID()
    const sessionToken = randomUUID()
    const player: InternalPlayer = {
      id: playerId,
      nickname,
      ready: false,
      connected: true,
      score: 0,
      correctCount: 0,
      findTimesMs: [],
      socketId,
      sessionToken,
    }

    room.players.set(playerId, player)
    room.lastActivityAt = Date.now()
    this.socketToPlayer.set(socketId, { roomCode: code, playerId })
    this.sessionToPlayer.set(sessionToken, { roomCode: code, playerId })
    return { room: this.toPublic(room), playerId, sessionToken }
  }

  leaveBySocket(socketId: string): PublicRoom | null {
    const ref = this.socketToPlayer.get(socketId)
    if (!ref) return null
    return this.removePlayer(ref.roomCode, ref.playerId, true)
  }

  handleDisconnect(socketId: string): { room: PublicRoom | null; delayed: boolean } {
    const ref = this.socketToPlayer.get(socketId)
    if (!ref) return { room: null, delayed: false }

    const room = this.rooms.get(ref.roomCode)
    if (!room) return { room: null, delayed: false }
    const player = room.players.get(ref.playerId)
    if (!player) return { room: null, delayed: false }

    player.connected = false
    player.ready = false
    room.lastActivityAt = Date.now()
    this.socketToPlayer.delete(socketId)

    const key = `${ref.roomCode}:${ref.playerId}`
    const existing = this.disconnectTimers.get(key)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      this.disconnectTimers.delete(key)
      this.removePlayer(ref.roomCode, ref.playerId, false)
    }, DISCONNECT_GRACE_MS)
    this.disconnectTimers.set(key, timer)

    return { room: this.toPublic(room), delayed: true }
  }

  tryReconnect(
    socketId: string,
    sessionToken: string,
  ): { room: PublicRoom; playerId: string } | null {
    const ref = this.sessionToPlayer.get(sessionToken)
    if (!ref) return null
    const room = this.rooms.get(ref.roomCode)
    if (!room) return null
    const player = room.players.get(ref.playerId)
    if (!player || player.sessionToken !== sessionToken) return null

    const key = `${ref.roomCode}:${ref.playerId}`
    const timer = this.disconnectTimers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.disconnectTimers.delete(key)
    }

    player.connected = true
    player.socketId = socketId
    room.lastActivityAt = Date.now()
    this.socketToPlayer.set(socketId, ref)
    return { room: this.toPublic(room), playerId: player.id }
  }

  setReady(socketId: string, ready: boolean): PublicRoom {
    const { room, player } = this.requireLobbyPlayer(socketId)
    player.ready = Boolean(ready)
    room.lastActivityAt = Date.now()
    return this.toPublic(room)
  }

  setConfig(socketId: string, patch: Partial<GameConfig>): PublicRoom {
    const { room, player } = this.requireLobbyPlayer(socketId)
    if (player.id !== room.hostId) throw new Error('Only the host can change settings')
    if (room.phase !== 'lobby') throw new Error('Settings are locked during a match')
    if (!isValidConfig(patch)) throw new Error('Invalid configuration')
    // Whitelist known keys so clients cannot inject arbitrary config fields.
    const clean: Partial<GameConfig> = {}
    if (patch.difficulty !== undefined) clean.difficulty = patch.difficulty
    if (patch.rounds !== undefined) clean.rounds = patch.rounds
    if (patch.timerSeconds !== undefined) clean.timerSeconds = patch.timerSeconds
    if (patch.showLabels !== undefined) clean.showLabels = patch.showLabels
    room.config = { ...room.config, ...clean }
    // Changing settings resets ready flags so everyone re-confirms
    for (const p of room.players.values()) p.ready = false
    room.lastActivityAt = Date.now()
    return this.toPublic(room)
  }

  assertCanStart(socketId: string): InternalRoom {
    const { room, player } = this.requireLobbyPlayer(socketId)
    if (player.id !== room.hostId) throw new Error('Only the host can start the match')
    const connected = [...room.players.values()].filter((p) => p.connected)
    if (connected.length < 1) throw new Error('Need at least one player')
    const notReady = connected.filter((p) => !p.ready)
    if (notReady.length > 0) {
      throw new Error('All connected players must be ready')
    }
    return room
  }

  getRoomBySocket(socketId: string): InternalRoom | null {
    const ref = this.socketToPlayer.get(socketId)
    if (!ref) return null
    return this.rooms.get(ref.roomCode) ?? null
  }

  getRoom(code: string): InternalRoom | null {
    return this.rooms.get(code) ?? null
  }

  getPublic(code: string): PublicRoom | null {
    const room = this.rooms.get(code)
    return room ? this.toPublic(room) : null
  }

  getPlayerRef(socketId: string): { room: InternalRoom; player: InternalPlayer } | null {
    const ref = this.socketToPlayer.get(socketId)
    if (!ref) return null
    const room = this.rooms.get(ref.roomCode)
    const player = room?.players.get(ref.playerId)
    if (!room || !player) return null
    return { room, player }
  }

  getPlayerBySocket(socketId: string): InternalPlayer | null {
    return this.getPlayerRef(socketId)?.player ?? null
  }

  toPublic(room: InternalRoom): PublicRoom {
    const players: PublicPlayer[] = [...room.players.values()]
      .filter((p) => p.connected || room.phase !== 'lobby')
      .map((p) => ({
        id: p.id,
        nickname: p.nickname,
        isHost: p.id === room.hostId,
        ready: p.ready,
        connected: p.connected,
        score: p.score,
        correctCount: p.correctCount,
      }))

    const pub: PublicRoom = {
      code: room.code,
      phase: room.phase,
      config: { ...room.config },
      players,
      hostId: room.hostId,
      maxPlayers: MAX_PLAYERS,
    }

    if (room.match && room.phase !== 'lobby') {
      pub.roundIndex = room.match.roundIndex
      pub.totalRounds = room.config.rounds
      pub.roundStartedAt = room.match.roundStartedAt
      pub.roundEndsAt = room.match.roundEndsAt
      const challenge = room.match.currentChallenge as { name?: string; kind?: string } | null
      if (challenge) {
        pub.challengeName = challenge.name
        pub.challengeKind = challenge.kind
      }
    }

    return pub
  }

  cleanupExpired(): string[] {
    const now = Date.now()
    const removed: string[] = []
    for (const [code, room] of this.rooms) {
      const connected = [...room.players.values()].filter((p) => p.connected)
      const emptyTooLong =
        connected.length === 0 && now - room.lastActivityAt > EMPTY_ROOM_TTL_MS
      const idleTooLong = now - room.lastActivityAt > IDLE_ROOM_TTL_MS
      if (emptyTooLong || idleTooLong) {
        this.destroyRoom(code)
        removed.push(code)
      }
    }
    return removed
  }

  destroyRoom(code: string): void {
    const room = this.rooms.get(code)
    if (!room) return
    this.clearMatchTimers(room)
    for (const player of room.players.values()) {
      this.socketToPlayer.delete(player.socketId)
      this.sessionToPlayer.delete(player.sessionToken)
      const key = `${code}:${player.id}`
      const timer = this.disconnectTimers.get(key)
      if (timer) clearTimeout(timer)
      this.disconnectTimers.delete(key)
    }
    this.rooms.delete(code)
    this.onDestroy?.(code)
  }

  clearMatchTimers(room: InternalRoom): void {
    if (!room.match) return
    if (room.match.roundTimer) clearTimeout(room.match.roundTimer)
    if (room.match.resultTimer) clearTimeout(room.match.resultTimer)
    room.match.roundTimer = null
    room.match.resultTimer = null
  }

  resetToLobby(room: InternalRoom): PublicRoom {
    this.clearMatchTimers(room)
    room.phase = 'lobby'
    room.match = null
    for (const p of room.players.values()) {
      p.ready = false
      p.score = 0
      p.correctCount = 0
      p.findTimesMs = []
    }
    room.lastActivityAt = Date.now()
    return this.toPublic(room)
  }

  private removePlayer(roomCode: string, playerId: string, immediate: boolean): PublicRoom | null {
    const room = this.rooms.get(roomCode)
    if (!room) return null
    const player = room.players.get(playerId)
    if (!player) return null

    this.socketToPlayer.delete(player.socketId)
    this.sessionToPlayer.delete(player.sessionToken)
    room.players.delete(playerId)
    room.lastActivityAt = Date.now()

    const key = `${roomCode}:${playerId}`
    const timer = this.disconnectTimers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.disconnectTimers.delete(key)
    }

    const connected = [...room.players.values()].filter((p) => p.connected)
    if (connected.length === 0) {
      if (immediate) {
        this.destroyRoom(roomCode)
        return null
      }
      return this.toPublic(room)
    }

    if (room.hostId === playerId) {
      room.hostId = connected[0]!.id
      connected[0]!.ready = false
    }

    if (room.phase !== 'lobby' && connected.length === 0) {
      this.destroyRoom(roomCode)
      return null
    }

    return this.toPublic(room)
  }

  private requireLobbyPlayer(socketId: string): { room: InternalRoom; player: InternalPlayer } {
    const ref = this.socketToPlayer.get(socketId)
    if (!ref) throw new Error('Not in a room')
    const room = this.rooms.get(ref.roomCode)
    if (!room) throw new Error('Room not found')
    const player = room.players.get(ref.playerId)
    if (!player || !player.connected) throw new Error('Player not found')
    if (room.phase !== 'lobby') throw new Error('Match already in progress')
    return { room, player }
  }

  private allocateCode(): string {
    for (let i = 0; i < 50; i++) {
      const code = randomCode()
      if (!this.rooms.has(code)) return code
    }
    throw new Error('Unable to allocate room code — try again')
  }
}
