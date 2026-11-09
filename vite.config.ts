import { networkInterfaces } from 'node:os'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __LAN_ADDRESS__: JSON.stringify(lanAddress()),
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
      '/socket.io': {
        target: 'http://127.0.0.1:3001',
        ws: true,
      },
    },
  },
})
