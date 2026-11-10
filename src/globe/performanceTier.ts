/**
 * Picks a graphics tier per device so low-end laptops and phones get a lighter globe
 * (fewer stars, no baked nebula/clouds on low, fewer detail tiles in GPU memory, lower
 * pixel ratio) instead of the desktop-GPU defaults.
 *
 * 1. `initialTier()` — cheap hints available before any WebGL context exists.
 * 2. `tierForRenderer()` — refined from the real GPU name once the renderer exists.
 * 3. `lowerStoredTier()` — the scene drops a step when frames stay slow or the GPU
 *    context is lost; remembered for a few days so the next load starts light too.
 */
export type GraphicsTier = 'low' | 'medium' | 'high'

const ORDER: GraphicsTier[] = ['low', 'medium', 'high']
const STORE_KEY = 'globehunt.gpuTier.v1'
/** A remembered downgrade expires, so a one-off bad session doesn't stick forever. */
const STORE_TTL_MS = 3 * 24 * 60 * 60 * 1000

export const lowerTier = (a: GraphicsTier, b: GraphicsTier): GraphicsTier =>
  ORDER[Math.min(ORDER.indexOf(a), ORDER.indexOf(b))]

function storedCap(): GraphicsTier | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const { tier, at } = JSON.parse(raw) as { tier: GraphicsTier; at: number }
    if (!ORDER.includes(tier) || Date.now() - at > STORE_TTL_MS) return null
    return tier
  } catch {
    return null
  }
}

/** Device hints only (no GPU access): cores, memory, phone-class screens. */
function hintTier(): GraphicsTier {
  if (typeof navigator === 'undefined') return 'high'
  const cores = navigator.hardwareConcurrency || 4
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  if (cores <= 2 || (memory !== undefined && memory <= 2)) return 'low'
  if (cores <= 4 || (memory !== undefined && memory <= 4) || coarse) return 'medium'
  return 'high'
}

export function initialTier(): GraphicsTier {
  const cap = storedCap()
  const hint = hintTier()
  return cap ? lowerTier(cap, hint) : hint
}

/** Software renderers are unplayable at high; common integrated / mobile GPUs get medium. */
export function tierForRenderer(renderer: string, maxTextureSize: number): GraphicsTier {
  const r = renderer.toLowerCase()
  if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(r) || maxTextureSize < 4096) return 'low'
  const integrated =
    (/intel/.test(r) && !/\barc\b/.test(r)) ||
    /mali|powervr|adreno \(tm\) [1-5]\d\d|adreno [1-5]\d\d|videocore|apple gpu/.test(r) ||
    maxTextureSize < 8192
  return integrated ? 'medium' : 'high'
}

/** Remember a downgrade (slow frames / lost GPU context) for the next few loads. */
export function lowerStoredTier(from: GraphicsTier): GraphicsTier {
  const next = ORDER[Math.max(0, ORDER.indexOf(from) - 1)]
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ tier: next, at: Date.now() }))
  } catch {
    /* storage unavailable: the downgrade still applies to this session */
  }
  return next
}

/** Pixel-ratio ceiling per tier (also bounded by the caller's own cap). */
export const DPR_FOR_TIER: Record<GraphicsTier, number> = { low: 1, medium: 1.5, high: 2 }
/** Streamed imagery tiles kept on the GPU (each ~1.4 MB with mipmaps). */
export const TILE_CACHE_FOR_TIER: Record<GraphicsTier, number> = { low: 40, medium: 80, high: 140 }
