/**
 * NASA GIBS (Global Imagery Browse Services) — public, CORS-enabled WMTS.
 * Layer: Blue Marble shaded relief + bathymetry (NASA Earth Observatory, public domain).
 * EPSG:4326 tile matrix "500m": level L ≥ 3 is an exact grid of square tiles,
 * (10·2^(L-3)) columns × (5·2^(L-3)) rows, 512 px each, top-left at (-180°, 90°).
 */
export const GIBS_LAYER = 'BlueMarble_ShadedRelief_Bathymetry'
const GIBS_BASE = `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${GIBS_LAYER}/default/2004-08-01/500m`

export const GIBS_MIN_LEVEL = 3
export const GIBS_MAX_LEVEL = 7
export const GIBS_TILE_PX = 512

export const IMAGERY_CREDIT = 'Imagery: NASA Blue Marble · GIBS'

export interface TileId {
  level: number
  col: number
  row: number
}

export function tileGrid(level: number): { cols: number; rows: number; deg: number } {
  const scale = 2 ** (level - GIBS_MIN_LEVEL)
  return { cols: 10 * scale, rows: 5 * scale, deg: 36 / scale }
}

export function tileUrl({ level, col, row }: TileId): string {
  return `${GIBS_BASE}/${level}/${row}/${col}.jpeg`
}

export function tileKey({ level, col, row }: TileId): string {
  return `${level}/${row}/${col}`
}

/** Geographic bounds of a tile in degrees. */
export function tileBounds({ level, col, row }: TileId) {
  const { deg } = tileGrid(level)
  const west = -180 + col * deg
  const north = 90 - row * deg
  return { west, east: west + deg, north, south: north - deg, deg }
}

export function loadImage(url: string, timeoutMs = 20_000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    const timer = window.setTimeout(() => {
      img.src = ''
      reject(new Error(`timeout ${url}`))
    }, timeoutMs)
    img.onload = () => {
      window.clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error(`failed ${url}`))
    }
    img.src = url
  })
}
