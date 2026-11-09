import type { Server } from 'socket.io'
import type {
  ClientToServerEvents,
  PublicRoom,
  RoundPlayerResult,
  ServerToClientEvents,
} from '../../../shared/multiplayer.js'
import type { RoomManager, InternalRoom } from '../rooms/RoomManager.js'
import { selectServerChallenges, toClientChallenge, type ServerChallenge } from './challenges.js'
import { scoreElapsed, validateServerAnswer } from './geoValidate.js'

// Long enough for the travel-to-answer reveal + discovery card + leaderboard.
const ROUND_RESULT_MS = 7000
const TRAVEL_MS = 2600
export const MAX_ATTEMPTS_PER_ROUND = 12
export const MIN_GUESS_INTERVAL_MS = 250

/** Answer location for the post-round reveal (never sent while a round is live). */
function revealFor(challenge: ServerChallenge | undefined) {
  if (!challenge) return { challengeId: 'unknown', kind: 'country' as const, location: { lat: 0, lng: 0 } }
  return { challengeId: challenge.id, kind: challenge.kind, featureKind: challenge.featureKind, location: { lat: challenge.point[0], lng: challenge.point[1] } }
}

export interface MatchTimings {
  /** Client camera travel before the search timer starts. */
  travelMs: number
  /** Round result screen before the next round. */
  resultMs: number
}

export const DEFAULT_TIMINGS: MatchTimings = { travelMs: TRAVEL_MS, resultMs: ROUND_RESULT_MS }

export class MatchController {
  constructor(
    private rooms: RoomManager,
    private io: Server<ClientToServerEvents, ServerToClientEvents>,
    private timings: MatchTimings = DEFAULT_TIMINGS,
  ) {}

  /** Current round payload for a player resuming mid-round (no answer data). */
  liveRound(room: InternalRoom) {
    const match = room.match
    const challenge = match?.currentChallenge as ServerChallenge | null | undefined
    if (!match || room.phase !== 'playing' || !challenge) return null
    return {
      room: this.rooms.toPublic(room),
      challenge: toClientChallenge(challenge),
      roundIndex: match.roundIndex,
      totalRounds: room.config.rounds,
      startedAt: match.roundStartedAt,
      endsAt: match.roundEndsAt,
    }
  }

  getPublicRoom(code: string): PublicRoom | null {
    return this.rooms.getPublic(code)
  }

  startMatch(socketId: string): void {
    const room = this.rooms.assertCanStart(socketId)
    this.rooms.clearMatchTimers(room)

    for (const p of room.players.values()) {
      p.score = 0
      p.correctCount = 0
      p.findTimesMs = []
      p.ready = false
    }

    const challenges = selectServerChallenges(room.config, room.code)
    room.match = {
      challenges,
      roundIndex: 0,
      roundStartedAt: 0,
      roundEndsAt: 0,
      submissions: new Map(),
      attempts: new Map(),
      currentChallenge: null,
      roundTimer: null,
      resultTimer: null,
    }
    room.phase = 'playing'
    room.lastActivityAt = Date.now()
    this.beginRound(room)
  }

  submitAnswer(socketId: string, lat: number, lng: number): { correct: boolean } {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error('Invalid coordinates')
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error('Coordinates out of range')
    }

    const ref = this.rooms.getPlayerRef(socketId)
    if (!ref) throw new Error('Not in a room')
    const { room, player } = ref
    if (room.phase !== 'playing' || !room.match) throw new Error('No active round')
    if (!player.connected) throw new Error('Disconnected')

    const match = room.match
    if (match.submissions.has(player.id)) {
      return { correct: true }
    }

    const challenge = match.currentChallenge as ServerChallenge | null
    if (!challenge) throw new Error('No challenge')

    const now = Date.now()
    // The travel window is not search time: an early answer would score as instant.
    if (now < match.roundStartedAt) throw new Error('Round has not started yet')
    if (now > match.roundEndsAt) throw new Error('Round already ended')

    // Wrong guesses are free, so cap and pace them to stop scripted grid searches.
    const attempt = match.attempts.get(player.id) ?? { count: 0, last: 0 }
    if (attempt.count >= MAX_ATTEMPTS_PER_ROUND) throw new Error('No guesses left this round')
    if (now - attempt.last < MIN_GUESS_INTERVAL_MS) throw new Error('Too fast — wait a moment')
    attempt.count += 1
    attempt.last = now
    match.attempts.set(player.id, attempt)

    const correct = validateServerAnswer(challenge, { lat, lng })
    if (!correct) return { correct: false }

    const elapsedMs = Math.max(0, Math.min(now - match.roundStartedAt, room.config.timerSeconds * 1000))
    const score = scoreElapsed(elapsedMs, room.config.timerSeconds, challenge, room.config.difficulty)
    match.submissions.set(player.id, { elapsedMs, score })
    player.score += score
    player.correctCount += 1
    player.findTimesMs.push(elapsedMs)

    this.io.to(room.code).emit('match_player_finished', {
      playerId: player.id,
      nickname: player.nickname,
      elapsedMs,
      score,
    })
    this.io.to(room.code).emit('room_state', this.rooms.toPublic(room))

    if (this.allConnectedFinished(room)) {
      this.finishRound(room)
    }

    return { correct: true }
  }

  returnToLobby(socketId: string): PublicRoom | null {
    const ref = this.rooms.getPlayerRef(socketId)
    if (!ref) throw new Error('Not in a room')
    if (ref.player.id !== ref.room.hostId) throw new Error('Only the host can return to lobby')
    return this.rooms.resetToLobby(ref.room)
  }

  private beginRound(room: InternalRoom): void {
    const match = room.match
    if (!match) return
    const challenge = match.challenges[match.roundIndex] as ServerChallenge | undefined
    if (!challenge) {
      this.completeMatch(room)
      return
    }

    match.submissions = new Map()
    match.attempts = new Map()
    match.currentChallenge = challenge
    // Travel window: clients fly to the new region before the search timer starts.
    const startedAt = Date.now() + this.timings.travelMs
    const endsAt = startedAt + room.config.timerSeconds * 1000
    match.roundStartedAt = startedAt
    match.roundEndsAt = endsAt
    room.phase = 'playing'
    room.lastActivityAt = Date.now()

    if (match.roundTimer) clearTimeout(match.roundTimer)
    match.roundTimer = setTimeout(() => this.finishRound(room), endsAt - Date.now())

    const publicRoom = this.rooms.toPublic(room)
    this.io.to(room.code).emit('match_round_start', {
      room: publicRoom,
      challenge: toClientChallenge(challenge),
      roundIndex: match.roundIndex,
      totalRounds: room.config.rounds,
      startedAt,
      endsAt,
    })
    this.io.to(room.code).emit('room_state', publicRoom)
  }

  private finishRound(room: InternalRoom): void {
    const match = room.match
    if (!match || room.phase === 'round_result' || room.phase === 'match_results') return

    if (match.roundTimer) {
      clearTimeout(match.roundTimer)
      match.roundTimer = null
    }

    room.phase = 'round_result'
    const challenge = match.currentChallenge as ServerChallenge
    const results: RoundPlayerResult[] = [...room.players.values()]
      .filter((p) => p.connected || match.submissions.has(p.id))
      .map((p) => {
        const sub = match.submissions.get(p.id)
        return {
          playerId: p.id,
          nickname: p.nickname,
          outcome: sub ? ('correct' as const) : ('timeout' as const),
          elapsedMs: sub?.elapsedMs ?? null,
          score: sub?.score ?? 0,
          totalScore: p.score,
        }
      })
      .sort((a, b) => b.totalScore - a.totalScore || (a.elapsedMs ?? 1e9) - (b.elapsedMs ?? 1e9))

    const publicRoom = this.rooms.toPublic(room)
    this.io.to(room.code).emit('match_round_result', {
      room: publicRoom,
      results,
      challengeName: challenge?.name ?? 'Unknown',
      reveal: revealFor(challenge),
    })
    this.io.to(room.code).emit('room_state', publicRoom)

    if (match.resultTimer) clearTimeout(match.resultTimer)
    match.resultTimer = setTimeout(() => {
      match.roundIndex += 1
      if (match.roundIndex >= room.config.rounds) {
        this.completeMatch(room)
      } else {
        this.beginRound(room)
      }
    }, this.timings.resultMs)
  }

  private completeMatch(room: InternalRoom): void {
    this.rooms.clearMatchTimers(room)
    room.phase = 'match_results'
    room.lastActivityAt = Date.now()

    const rankings = [...room.players.values()]
      .filter((p) => p.connected || p.score > 0)
      .map((p) => ({
        playerId: p.id,
        nickname: p.nickname,
        score: p.score,
        correctCount: p.correctCount,
        averageFindMs:
          p.findTimesMs.length > 0
            ? Math.round(p.findTimesMs.reduce((a, b) => a + b, 0) / p.findTimesMs.length)
            : null,
      }))
      .sort((a, b) => b.score - a.score || b.correctCount - a.correctCount)

    const publicRoom = this.rooms.toPublic(room)
    this.io.to(room.code).emit('match_complete', { room: publicRoom, rankings })
    this.io.to(room.code).emit('room_state', publicRoom)
  }

  private allConnectedFinished(room: InternalRoom): boolean {
    const match = room.match
    if (!match) return false
    const connected = [...room.players.values()].filter((p) => p.connected)
    return connected.length > 0 && connected.every((p) => match.submissions.has(p.id))
  }
}
