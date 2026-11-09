import type { LabelKind } from './types'

export type SymbolKind = 'capital' | 'admincap' | 'city' | 'town' | 'village' | 'peak' | 'airport' | 'port' | 'landmark'

export interface LabelStyle {
  font: (scale: number) => string
  size: number
  color: string
  upper?: boolean
  /** Letter spacing in px. */
  spacing: number
  symbol?: SymbolKind
}

const SANS = "'Source Sans 3', 'Segoe UI', sans-serif"
const f = (weight: string, px: number, italic = false) => (s: number) => `${italic ? 'italic ' : ''}${weight} ${Math.round(px * s)}px ${SANS}`

/** Distinct, atlas-like styling per feature class. */
export const STYLES: Record<LabelKind, LabelStyle> = {
  ocean: { font: f('500', 15, true), size: 15, color: '#a9d3ff', upper: true, spacing: 4.5 },
  country: { font: f('700', 12.5), size: 12.5, color: '#f7f9ff', upper: true, spacing: 2 },
  sea: { font: f('500', 12, true), size: 12, color: '#9fcbff', spacing: 1.2 },
  bay: { font: f('500', 11, true), size: 11, color: '#93c2f5', spacing: 0.6 },
  capital: { font: f('700', 12.5), size: 12.5, color: '#ffffff', spacing: 0, symbol: 'capital' },
  admincap: { font: f('600', 11.5), size: 11.5, color: '#f2f5fb', spacing: 0, symbol: 'admincap' },
  city: { font: f('600', 11.5), size: 11.5, color: '#eef2f9', spacing: 0, symbol: 'city' },
  town: { font: f('500', 11), size: 11, color: '#e2e8f2', spacing: 0, symbol: 'town' },
  village: { font: f('500', 10), size: 10, color: '#cdd6e4', spacing: 0, symbol: 'village' },
  river: { font: f('500', 11, true), size: 11, color: '#8fd0ff', spacing: 1 },
  lake: { font: f('500', 11, true), size: 11, color: '#8fd0ff', spacing: 0.4 },
  mountain: { font: f('500', 10.5), size: 10.5, color: '#f1dfbd', spacing: 0, symbol: 'peak' },
  range: { font: f('600', 11, true), size: 11, color: '#ead6ad', upper: true, spacing: 3 },
  desert: { font: f('600', 11, true), size: 11, color: '#f3dcae', upper: true, spacing: 3 },
  plateau: { font: f('500', 10.5, true), size: 10.5, color: '#e8d8b6', upper: true, spacing: 2 },
  region: { font: f('500', 10.5, true), size: 10.5, color: '#e3d6bb', spacing: 0.6 },
  island: { font: f('500', 11), size: 11, color: '#f2f6ff', spacing: 0.3 },
  admin1: { font: f('600', 10), size: 10, color: 'rgba(236, 226, 204, 0.88)', upper: true, spacing: 1.6 },
  airport: { font: f('500', 10), size: 10, color: '#cfe3ff', spacing: 0, symbol: 'airport' },
  port: { font: f('500', 10), size: 10, color: '#cfe3ff', spacing: 0, symbol: 'port' },
  landmark: { font: f('500', 10.5, true), size: 10.5, color: '#f0dca8', spacing: 0, symbol: 'landmark' },
}

const INK = 'rgba(3, 8, 20, 0.9)'

/** Small map symbols drawn at the exact coordinate. */
export function drawSymbol(ctx: CanvasRenderingContext2D, kind: SymbolKind, x: number, y: number) {
  ctx.save()
  ctx.lineWidth = 1.6
  switch (kind) {
    case 'capital':
      ctx.beginPath()
      ctx.arc(x, y, 4.4, 0, Math.PI * 2)
      ctx.fillStyle = INK
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y, 1.9, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      break
    case 'admincap':
      ctx.fillStyle = INK
      ctx.fillRect(x - 3.6, y - 3.6, 7.2, 7.2)
      ctx.fillStyle = '#f2f5fb'
      ctx.fillRect(x - 2.4, y - 2.4, 4.8, 4.8)
      break
    case 'city':
    case 'town':
    case 'village': {
      const r = kind === 'city' ? 2.8 : kind === 'town' ? 2.2 : 1.6
      ctx.beginPath()
      ctx.arc(x, y, r + 1.1, 0, Math.PI * 2)
      ctx.fillStyle = INK
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = kind === 'village' ? '#cdd6e4' : '#eef2f9'
      ctx.fill()
      break
    }
    case 'peak':
      ctx.beginPath()
      ctx.moveTo(x, y - 4.6)
      ctx.lineTo(x + 4.4, y + 3)
      ctx.lineTo(x - 4.4, y + 3)
      ctx.closePath()
      ctx.fillStyle = '#e9d3a8'
      ctx.strokeStyle = INK
      ctx.stroke()
      ctx.fill()
      break
    case 'landmark':
      ctx.beginPath()
      ctx.moveTo(x, y - 4)
      ctx.lineTo(x + 3.4, y)
      ctx.lineTo(x, y + 4)
      ctx.lineTo(x - 3.4, y)
      ctx.closePath()
      ctx.fillStyle = '#f0dca8'
      ctx.strokeStyle = INK
      ctx.stroke()
      ctx.fill()
      break
    case 'airport':
    case 'port':
      ctx.font = `11px 'Segoe UI Symbol', 'Noto Sans Symbols', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.strokeStyle = INK
      ctx.lineWidth = 3
      ctx.strokeText(kind === 'airport' ? '✈' : '⚓', x, y)
      ctx.fillStyle = '#cfe3ff'
      ctx.fillText(kind === 'airport' ? '✈' : '⚓', x, y)
      break
  }
  ctx.restore()
}
