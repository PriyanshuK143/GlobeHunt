import { config } from './config.js'
import { createGameServer } from './app.js'

if (config.production && config.allowedOrigins.length === 0) {
  console.error('[GLOBEHUNT] ALLOWED_ORIGINS must be set in production (e.g. https://globehunt.example.com)')
  process.exit(1)
}

const server = createGameServer({ allowedOrigins: config.allowedOrigins, trustProxy: config.trustProxy, allowLan: config.allowLan })

const port = await server.listen(config.port, config.host)
console.log(`[GLOBEHUNT] Multiplayer server listening on ${config.host}:${port} (origins: ${config.allowedOrigins.join(', ') || 'none'}${config.allowLan ? ' + private LAN' : ''})`)

let shuttingDown = false
async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[GLOBEHUNT] ${signal} received — closing connections`)
  const force = setTimeout(() => process.exit(1), 10_000)
  force.unref()
  await server.close()
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('unhandledRejection', (reason) => {
  console.error('[GLOBEHUNT] Unhandled promise rejection', reason)
})
process.on('uncaughtException', (err) => {
  // State may be inconsistent: log and exit so the process manager restarts us.
  console.error('[GLOBEHUNT] Uncaught exception', err)
  process.exit(1)
})
