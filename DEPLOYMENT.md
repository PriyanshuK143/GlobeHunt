# Deployment checklist

GLOBEHUNT has two processes in development: the static Vite frontend and the
Socket.IO game server. They can be hosted together behind one HTTPS reverse
proxy, or on separate hosts. Do not expose the development servers directly.

## Before a first deployment

```bash
npm ci
npm --prefix server ci
npm run build
npm --prefix server run build
npm --prefix server test
npm audit
npm --prefix server audit
```

## Free hosting: Cloudflare Pages + Render

**Render (Web Service, Free)**: deploy the backend first, so the frontend has its URL.

| Setting | Value |
| --- | --- |
| Root Directory | `server` |
| Runtime | Node |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm run start:prod` |
| Health Check Path | `/health` |

Environment: `NODE_ENV=production`, `ALLOWED_ORIGINS=https://<project>.pages.dev`
(comma-separate any custom domain too), `TRUST_PROXY=1`. Do not set `PORT` or `HOST`:
Render provides `PORT` and the server binds `0.0.0.0` by default. `--include=dev`
is needed because `NODE_ENV=production` makes `npm ci` skip TypeScript.

**Cloudflare Pages (Git integration)**

| Setting | Value |
| --- | --- |
| Root directory | `/` (repo root) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `VITE_SERVER_URL=https://<service>.onrender.com` |

`VITE_SERVER_URL` is baked in at build time: change it, then redeploy. A Pages build
fails on purpose if it is missing or not `https://`. Node 24 comes from `.node-version`.
SPA fallback needs no config (no `404.html`, so Pages serves `index.html`); invite
links use `/?join=CODE` on the root path.

Render Free sleeps after ~15 minutes idle; the first connection then takes up to a
minute while the server wakes, and live rooms are lost when it sleeps or redeploys.

## Operational limits to address before scaling

- Match rooms are currently in process memory. Run one game-server instance,
  or add a shared room/state adapter before using multiple replicas.
- The current static location pool is included in the frontend for singleplayer
  play. Multiplayer validation and scoring are server-authoritative, but a
  competitive public launch should move singleplayer challenge selection and
  validation behind the game server so exact location data is never shipped to
  browsers.
- Test real touch devices and Safari/Chrome/Firefox after selecting a host;
  browser emulation cannot verify all mobile WebGL and audio behavior.

## Local development

Use `npm run dev:all` to start both services. Stop it with `Ctrl+C`; the helper
terminates both child processes together. For LAN testing, open the Vite URL
with the computer's private IP and keep the server running with `ALLOW_LAN=1`
(the development default). Never enable broad LAN origin acceptance in a public
production deployment.
