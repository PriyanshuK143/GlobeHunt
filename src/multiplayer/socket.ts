import { io, type Socket } from 'socket.io-client'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../shared/multiplayer'

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: GameSocket | null = null

export function getSocket(): GameSocket {
  if (socket) return socket
  // Production: VITE_SERVER_URL points at the game server (https://…, served over WSS).
  // Development: same origin, proxied to the local server by Vite.
  const url = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim() || '/'
  socket = io(url, {
    path: '/socket.io',
    autoConnect: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 8,
  })
  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}
