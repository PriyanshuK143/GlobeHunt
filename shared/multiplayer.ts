/** Shared multiplayer contracts used by the Vite client and Socket.IO server. */

export type Difficulty = 'simple' | 'medium' | 'hard' | 'expert'
/** Any whole number of rounds in [MIN_ROUNDS, MAX_ROUNDS]; presets are 1/3/5/10. */
export type RoundCount = number
export const MIN_ROUNDS = 1
export const MAX_ROUNDS = 50
/** Any whole number of seconds in the supported custom timer range. */
export type TimerSeconds = number
export const MIN_TIMER_SECONDS = 5
export const MAX_TIMER_SECONDS = 300

export interface GameConfig {
  difficulty: Difficulty
  rounds: RoundCount
  timerSeconds: TimerSeconds
  /** Show atlas place-name labels on the globe during play. */
  showLabels: boolean
}

export const MAX_PLAYERS = 8
export const DEFAULT_MP_CONFIG: GameConfig = {
  difficulty: 'simple',
  rounds: 10,
  timerSeconds: 30,
  showLabels: true,
}

export type RoomPhase = 'lobby' | 'playing' | 'round_result' | 'match_results'

export interface PublicPlayer {
  id: string
  nickname: string
  isHost: boolean
  ready: boolean
  connected: boolean
  /** Match totals — present during/after gameplay. */
  score: number
  correctCount: number
}

export interface PublicRoom {
  code: string
  phase: RoomPhase
  config: GameConfig
  players: PublicPlayer[]
  hostId: string
  maxPlayers: number
  /** Present while a match is active. */
  roundIndex?: number
  totalRounds?: number
  challengeName?: string
  challengeKind?: string
  roundEndsAt?: number
  roundStartedAt?: number
}

export interface RoundPlayerResult {
  playerId: string
  nickname: string
  outcome: 'correct' | 'timeout' | 'pending'
  elapsedMs: number | null
  score: number
  totalScore: number
}

/** Answer location — sent only after a round has ended (never during play). */
export interface RoundReveal {
  challengeId: string
  kind: 'country' | 'city' | 'feature'
  featureKind?: string
  location: { lat: number; lng: number }
}

export interface ClientChallengeView {
  /** Opaque per-round key. It deliberately cannot resolve to a public pool record. */
  roundKey: string
  kind: 'country' | 'city' | 'feature'
  name: string
  featureKind?: string
  /** Broad, target-independent regional camera anchor selected by the server. */
  guide: { lat: number; lng: number; altitude: number }
}

/** Client → Server */
export type ClientToServerEvents = {
  room_create: (
    payload: { nickname: string },
    ack: (res: { ok: true; room: PublicRoom; playerId: string; sessionToken: string } | { ok: false; error: string }) => void,
  ) => void
  room_join: (
    payload: { code: string; nickname: string },
    ack: (res: { ok: true; room: PublicRoom; playerId: string; sessionToken: string } | { ok: false; error: string }) => void,
  ) => void
  /** Re-bind a new socket to an existing seat after a network drop (secret session token). */
  room_resume: (
    payload: { sessionToken: string },
    ack: (res: { ok: true; room: PublicRoom; playerId: string } | { ok: false; error: string }) => void,
  ) => void
  room_leave: () => void
  room_set_ready: (payload: { ready: boolean }) => void
  room_set_config: (payload: Partial<GameConfig>) => void
  room_start: (
    ack: (res: { ok: true } | { ok: false; error: string }) => void,
  ) => void
  match_submit_answer: (
    payload: { lat: number; lng: number },
    ack: (res: { ok: true; correct: boolean } | { ok: false; error: string }) => void,
  ) => void
  match_return_lobby: () => void
  match_play_again: (
    ack: (res: { ok: true } | { ok: false; error: string }) => void,
  ) => void
}

/** Server → Client */
export type ServerToClientEvents = {
  room_state: (room: PublicRoom) => void
  room_error: (payload: { error: string }) => void
  match_round_start: (payload: {
    room: PublicRoom
    challenge: ClientChallengeView
    roundIndex: number
    totalRounds: number
    startedAt: number
    endsAt: number
  }) => void
  match_player_finished: (payload: {
    playerId: string
    nickname: string
    elapsedMs: number
    score: number
  }) => void
  match_round_result: (payload: {
    room: PublicRoom
    results: RoundPlayerResult[]
    challengeName: string
    reveal: RoundReveal
  }) => void
  match_complete: (payload: {
    room: PublicRoom
    rankings: Array<{
      playerId: string
      nickname: string
      score: number
      correctCount: number
      averageFindMs: number | null
    }>
  }) => void
  match_aborted: (payload: { reason: string }) => void
}
