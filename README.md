# GLOBEHUNT

Interactive 3D geography game — singleplayer challenges and Socket.IO multiplayer rooms.

## Run locally

Use two terminals:

```bash
# Terminal 1 — multiplayer server (port 3001)
npm run dev:server

# Terminal 2 — frontend (port 2002)
npm run dev
```

Open **http://127.0.0.1:2002**

Vite proxies `/socket.io` → the multiplayer server.

## Modes

- **Singleplayer** — countries, cities, landmarks; timed speed scoring
- **Multiplayer** — 4-digit rooms, up to 8 players, synchronized rounds, server-authoritative validation
- **Settings** — audio, defaults, graphics, orbit sensitivity (persisted in `localStorage`)
- **Credits** — cinematic aircraft + contrail text reveal

## Dev helpers

```js
__GLOBEHUNT__.flyTo(48.86, 2.35)
__GLOBEHUNT_GAME__.pick(lat, lng) // singleplayer
```

## Stack

Vite · React · TypeScript · Three.js · R3F · Socket.IO · Natural Earth / world-atlas
