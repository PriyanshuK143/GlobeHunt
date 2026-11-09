import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ClientChallengeView,
  GameConfig,
  PublicRoom,
  RoundPlayerResult,
  RoundReveal,
} from '../../shared/multiplayer'
import { getSocket } from './socket'

/** Seat token for reconnects. sessionStorage: survives reloads, not shared across tabs. */
const TOKEN_KEY = 'globehunt.mpSession'
function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
function saveToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* storage unavailable: reconnect just won't restore the seat */
  }
}
function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export type MpScreen =
  | 'hub'
  | 'create'
  | 'join'
  | 'lobby'
  | 'playing'
  | 'round_result'
  | 'match_results'

export interface MpRoundResultView {
  challengeName: string
  results: RoundPlayerResult[]
  reveal: RoundReveal | null
}

export interface MpRankings {
  playerId: string
  nickname: string
  score: number
  correctCount: number
  averageFindMs: number | null
}

export function useMultiplayer() {
  const [screen, setScreen] = useState<MpScreen>('hub')
  const [nickname, setNickname] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [room, setRoom] = useState<PublicRoom | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [challenge, setChallenge] = useState<ClientChallengeView | null>(null)
  const [roundEndsAt, setRoundEndsAt] = useState<number | null>(null)
  const [roundStartedAt, setRoundStartedAt] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  const [roundResult, setRoundResult] = useState<MpRoundResultView | null>(null)
  const [rankings, setRankings] = useState<MpRankings[] | null>(null)
  const [finishedPeers, setFinishedPeers] = useState<
    Array<{ playerId: string; nickname: string; elapsedMs: number; score: number }>
  >([])

  const playerIdRef = useRef(playerId)
  playerIdRef.current = playerId

  useEffect(() => {
    const s = getSocket()
    const onConnect = () => {
      setConnected(true)
      // After a network drop (or a page reload) the server sees a new socket:
      // reclaim our seat with the secret session token.
      const token = readToken()
      if (!token) return
      s.emit('room_resume', { sessionToken: token }, (res) => {
        if (!res.ok) {
          clearToken()
          setRoom(null)
          setPlayerId(null)
          setScreen((cur) => (cur === 'hub' || cur === 'create' || cur === 'join' ? cur : 'hub'))
          setError('Connection lost — your seat in the room expired.')
          return
        }
        setRoom(res.room)
        setPlayerId(res.playerId)
        if (res.room.phase === 'lobby') setScreen('lobby')
        else if (res.room.phase === 'match_results') setScreen('lobby')
        else setScreen((cur) => (cur === 'round_result' ? cur : 'playing'))
      })
    }
    const onDisconnect = () => setConnected(false)
    const onState = (next: PublicRoom) => {
      setRoom(next)
      if (next.phase === 'lobby') {
        setScreen('lobby')
        setChallenge(null)
        setRoundResult(null)
        setFinished(false)
        setFinishedPeers([])
      }
    }
    const onError = (payload: { error: string }) => setError(payload.error)
    const onRoundStart = (payload: {
      room: PublicRoom
      challenge: ClientChallengeView
      startedAt: number
      endsAt: number
    }) => {
      setRoom(payload.room)
      setChallenge(payload.challenge)
      setRoundStartedAt(payload.startedAt)
      setRoundEndsAt(payload.endsAt)
      setFinished(false)
      setFinishedPeers([])
      setRoundResult(null)
      setRankings(null)
      setScreen('playing')
      setError(null)
    }
    const onPlayerFinished = (payload: {
      playerId: string
      nickname: string
      elapsedMs: number
      score: number
    }) => {
      setFinishedPeers((prev) => {
        if (prev.some((p) => p.playerId === payload.playerId)) return prev
        return [...prev, payload]
      })
      if (payload.playerId === playerIdRef.current) setFinished(true)
    }
    const onRoundResult = (payload: {
      room: PublicRoom
      results: RoundPlayerResult[]
      challengeName: string
      reveal?: RoundReveal
    }) => {
      setRoom(payload.room)
      setRoundResult({ challengeName: payload.challengeName, results: payload.results, reveal: payload.reveal ?? null })
      setScreen('round_result')
      setFinished(true)
    }
    const onComplete = (payload: { room: PublicRoom; rankings: MpRankings[] }) => {
      setRoom(payload.room)
      setRankings(payload.rankings)
      setScreen('match_results')
    }

    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)
    s.on('room_state', onState)
    s.on('room_error', onError)
    s.on('match_round_start', onRoundStart)
    s.on('match_player_finished', onPlayerFinished)
    s.on('match_round_result', onRoundResult)
    s.on('match_complete', onComplete)
    if (s.connected) onConnect()

    return () => {
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
      s.off('room_state', onState)
      s.off('room_error', onError)
      s.off('match_round_start', onRoundStart)
      s.off('match_player_finished', onPlayerFinished)
      s.off('match_round_result', onRoundResult)
      s.off('match_complete', onComplete)
    }
  }, [])

  const openCreate = useCallback(() => {
    setError(null)
    setScreen('create')
  }, [])

  const openJoin = useCallback(() => {
    setError(null)
    setScreen('join')
  }, [])

  const backToHub = useCallback(() => {
    setError(null)
    setScreen('hub')
  }, [])

  const createRoom = useCallback(() => {
    setError(null)
    const s = getSocket()
    s.emit('room_create', { nickname }, (res) => {
      if (!res.ok) {
        setError(res.error)
        return
      }
      saveToken(res.sessionToken)
      setRoom(res.room)
      setPlayerId(res.playerId)
      setScreen('lobby')
    })
  }, [nickname])

  const joinRoom = useCallback(() => {
    setError(null)
    const s = getSocket()
    s.emit('room_join', { code: joinCode.trim(), nickname }, (res) => {
      if (!res.ok) {
        setError(res.error)
        return
      }
      saveToken(res.sessionToken)
      setRoom(res.room)
      setPlayerId(res.playerId)
      setScreen('lobby')
    })
  }, [joinCode, nickname])

  const leaveRoom = useCallback(() => {
    getSocket().emit('room_leave')
    clearToken()
    setRoom(null)
    setPlayerId(null)
    setChallenge(null)
    setRoundResult(null)
    setRankings(null)
    setScreen('hub')
  }, [])

  const setReady = useCallback((ready: boolean) => {
    getSocket().emit('room_set_ready', { ready })
  }, [])

  const setConfig = useCallback((patch: Partial<GameConfig>) => {
    getSocket().emit('room_set_config', patch)
  }, [])

  const startMatch = useCallback(() => {
    setError(null)
    getSocket().emit('room_start', (res) => {
      if (!res.ok) setError(res.error)
    })
  }, [])

  const submitAnswer = useCallback((lat: number, lng: number) => {
    return new Promise<boolean>((resolve) => {
      getSocket().emit('match_submit_answer', { lat, lng }, (res) => {
        if (!res.ok) {
          setError(res.error)
          resolve(false)
          return
        }
        resolve(res.correct)
      })
    })
  }, [])

  const returnLobby = useCallback(() => {
    getSocket().emit('match_return_lobby')
  }, [])

  const playAgain = useCallback(() => {
    getSocket().emit('match_play_again', (res) => {
      if (!res.ok) setError(res.error)
    })
  }, [])

  const self = room?.players.find((p) => p.id === playerId) ?? null
  const isHost = Boolean(self?.isHost)

  return {
    screen,
    setScreen,
    nickname,
    setNickname,
    joinCode,
    setJoinCode,
    room,
    playerId,
    self,
    isHost,
    error,
    setError,
    connected,
    challenge,
    roundEndsAt,
    roundStartedAt,
    finished,
    roundResult,
    rankings,
    finishedPeers,
    openCreate,
    openJoin,
    backToHub,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    setConfig,
    startMatch,
    submitAnswer,
    returnLobby,
    playAgain,
  }
}
