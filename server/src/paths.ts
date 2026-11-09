import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'

/**
 * Locate a file in the frontend's public/ folder (shared game data), whether the server
 * runs from source (tsx) or from compiled output (dist/), or PUBLIC_DIR is set.
 */
export function publicFile(rel: string): string {
  if (config.publicDir) return resolve(config.publicDir, rel)
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, 'public', rel)
    if (existsSync(candidate)) return candidate
    dir = dirname(dir)
  }
  throw new Error(`Game data not found: public/${rel} (set PUBLIC_DIR)`)
}
