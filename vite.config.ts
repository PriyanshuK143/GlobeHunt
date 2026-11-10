import { networkInterfaces } from 'node:os'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/**
 * This machine's address on the local network (Wi-Fi / Ethernet), so invite links copied
 * on the host's own browser (opened at localhost) still work on other devices.
 * Docker / VM bridges are skipped.
 */
function lanAddress(): string | null {
  const skip = /^(docker|br-|veth|virbr|vmnet|vboxnet|tun|tap|lo)/
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    if (skip.test(name)) continue
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) return a.address
    }
  }
  return null
}

const PORT = 2002

/**
 * Production builds talk to a separately hosted game server. On a hosting build
 * (Cloudflare Pages sets CF_PAGES=1) a missing or non-HTTPS VITE_SERVER_URL would ship a
 * bundle whose multiplayer silently points at the static host, so fail the build instead.
 */
function checkServerUrl(mode: string): void {
  if (!process.env.CF_PAGES) return
  const raw = (loadEnv(mode, process.cwd(), 'VITE_').VITE_SERVER_URL ?? '').trim()
  let url: URL | null = null
  try {
    url = raw ? new URL(raw) : null
  } catch {
    url = null
  }
  if (!url || url.protocol !== 'https:' || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(url.hostname)) {
    throw new Error(`VITE_SERVER_URL must be the public https:// URL of the game server (got "${raw}")`)
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') checkServerUrl(mode)
  return {
    plugins: [react()],
    define: {
      // Only the dev server needs it (invite links opened via localhost); never bake the
      // build machine's private address into a production bundle.
      __LAN_ADDRESS__: JSON.stringify(command === 'serve' ? lanAddress() : null),
    },
    resolve: {
      alias: {
        '@shared': new URL('./shared', import.meta.url).pathname,
      },
    },
    server: {
      port: PORT,
      strictPort: true,
      // Reachable from other devices on the same Wi-Fi / LAN.
      host: true,
      proxy: {
        '/health': {
          target: 'http://127.0.0.1:3001',
        },
        '/socket.io': {
          target: 'http://127.0.0.1:3001',
          ws: true,
        },
      },
    },
    preview: {
      port: PORT,
      strictPort: true,
      host: true,
      proxy: {
        '/health': {
          target: 'http://127.0.0.1:3001',
        },
        '/socket.io': {
          target: 'http://127.0.0.1:3001',
          ws: true,
        },
      },
    },
  }
})
