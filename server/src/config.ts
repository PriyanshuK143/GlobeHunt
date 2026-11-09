/** Server configuration from environment variables (see server/.env.example). */
const env = process.env

export const config = {
  port: Number(env.PORT ?? 3001),
  host: env.HOST ?? '0.0.0.0',
  production: env.NODE_ENV === 'production',
  /**
   * Allowed browser origins for Socket.IO/HTTP (comma-separated). In development the
   * Vite dev server is allowed by default; in production this MUST be set.
   */
  allowedOrigins: (env.ALLOWED_ORIGINS ?? (env.NODE_ENV === 'production' ? '' : 'http://localhost:2002,http://127.0.0.1:2002'))
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  /**
   * Local-network play: also accept browser origins on private LAN addresses
   * (192.168.x.x, 10.x.x.x, 172.16–31.x.x, *.local). On by default in development,
   * off in production unless ALLOW_LAN=1.
   */
  allowLan: env.ALLOW_LAN ? env.ALLOW_LAN === '1' || env.ALLOW_LAN === 'true' : env.NODE_ENV !== 'production',
  /** Set when running behind a reverse proxy / load balancer that sets X-Forwarded-For. */
  trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
  /** Optional override for the folder containing game/pool.json and data/countries-110m.json. */
  publicDir: env.PUBLIC_DIR,
}
