/**
 * Skywriting stroke font. Each glyph is drawn in a cell of height 1 (baseline y = 0)
 * and width `w`. A stroke is a polyline the aircraft flies with smoke ON; curves are
 * dense point runs. Sharp corners are detected later and flown as small loops out of
 * the writing plane, like real skywriters do, so turns stay smooth.
 */
export type Pt = [number, number]
export type Stroke = Pt[]

export interface Glyph {
  w: number
  strokes: Stroke[]
}

/** Elliptical arc from a0 to a1 degrees (counter-clockwise if a1 > a0). */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, step = 9): Pt[] {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step))
  const pts: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry])
  }
  return pts
}

const G: Record<string, Glyph> = {
  A: { w: 0.82, strokes: [[[0, 0], [0.41, 1], [0.82, 0]], [[0.17, 0.38], [0.65, 0.38]]] },
  B: {
    w: 0.74,
    strokes: [
      [[0.08, 0], [0.08, 1]],
      [[0.08, 1], [0.4, 1], ...arc(0.4, 0.76, 0.26, 0.24, 90, -90), [0.08, 0.52]],
      [[0.08, 0.52], [0.44, 0.52], ...arc(0.44, 0.26, 0.29, 0.26, 90, -90), [0.08, 0]],
    ],
  },
  C: { w: 0.8, strokes: [arc(0.44, 0.5, 0.4, 0.5, 42, 318)] },
  D: { w: 0.8, strokes: [[[0.08, 0], [0.08, 1]], [[0.08, 1], [0.32, 1], ...arc(0.32, 0.5, 0.44, 0.5, 90, -90), [0.08, 0]]] },
  E: { w: 0.68, strokes: [[[0.66, 1], [0.08, 1], [0.08, 0], [0.66, 0]], [[0.08, 0.52], [0.54, 0.52]]] },
  F: { w: 0.64, strokes: [[[0.64, 1], [0.08, 1], [0.08, 0]], [[0.08, 0.52], [0.52, 0.52]]] },
  G: { w: 0.84, strokes: [[...arc(0.44, 0.5, 0.4, 0.5, 45, 360), [0.5, 0.5]]] },
  H: { w: 0.76, strokes: [[[0.08, 0], [0.08, 1]], [[0.68, 0], [0.68, 1]], [[0.08, 0.5], [0.68, 0.5]]] },
  I: { w: 0.22, strokes: [[[0.11, 1], [0.11, 0]]] },
  J: { w: 0.6, strokes: [[[0.52, 1], [0.52, 0.3], ...arc(0.28, 0.3, 0.24, 0.3, 0, -180)]] },
  K: { w: 0.72, strokes: [[[0.08, 0], [0.08, 1]], [[0.68, 1], [0.08, 0.4]], [[0.3, 0.6], [0.72, 0]]] },
  L: { w: 0.62, strokes: [[[0.08, 1], [0.08, 0], [0.6, 0]]] },
  M: { w: 0.92, strokes: [[[0.06, 0], [0.06, 1], [0.46, 0.32], [0.86, 1], [0.86, 0]]] },
  N: { w: 0.78, strokes: [[[0.08, 0], [0.08, 1], [0.7, 0], [0.7, 1]]] },
  O: { w: 0.88, strokes: [arc(0.44, 0.5, 0.42, 0.5, 90, 450)] },
  P: { w: 0.7, strokes: [[[0.08, 0], [0.08, 1]], [[0.08, 1], [0.38, 1], ...arc(0.38, 0.74, 0.28, 0.26, 90, -90), [0.08, 0.48]]] },
  Q: { w: 0.88, strokes: [arc(0.44, 0.5, 0.42, 0.5, 90, 450), [[0.52, 0.24], [0.9, -0.06]]] },
  R: {
    w: 0.74,
    strokes: [
      [[0.08, 0], [0.08, 1]],
      [[0.08, 1], [0.38, 1], ...arc(0.38, 0.74, 0.28, 0.26, 90, -90), [0.08, 0.48]],
      [[0.36, 0.48], [0.72, 0]],
    ],
  },
  S: { w: 0.72, strokes: [[...arc(0.38, 0.75, 0.3, 0.25, 25, 270), ...arc(0.38, 0.25, 0.32, 0.25, 90, -155).slice(1)]] },
  T: { w: 0.76, strokes: [[[0, 1], [0.76, 1]], [[0.38, 1], [0.38, 0]]] },
  U: { w: 0.76, strokes: [[[0.08, 1], [0.08, 0.32], ...arc(0.38, 0.32, 0.3, 0.32, 180, 360), [0.68, 1]]] },
  V: { w: 0.8, strokes: [[[0, 1], [0.4, 0], [0.8, 1]]] },
  W: { w: 1.04, strokes: [[[0, 1], [0.26, 0], [0.52, 0.66], [0.78, 0], [1.04, 1]]] },
  X: { w: 0.76, strokes: [[[0.04, 1], [0.72, 0]], [[0.72, 1], [0.04, 0]]] },
  Y: { w: 0.78, strokes: [[[0.03, 1], [0.39, 0.48]], [[0.75, 1], [0.39, 0.48], [0.39, 0]]] },
  Z: { w: 0.72, strokes: [[[0.04, 1], [0.68, 1], [0.04, 0], [0.7, 0]]] },
  '&': {
    w: 0.86,
    strokes: [
      [
        [0.84, 0],
        [0.3, 0.58],
        [0.24, 0.74],
        [0.3, 0.9],
        [0.44, 0.97],
        [0.57, 0.9],
        [0.6, 0.76],
        [0.5, 0.63],
        [0.2, 0.42],
        [0.1, 0.24],
        [0.16, 0.08],
        [0.34, 0],
        [0.56, 0.05],
        [0.72, 0.2],
        [0.84, 0.4],
      ],
    ],
  },
  '.': { w: 0.2, strokes: [[[0.08, 0], [0.12, 0.06]]] },
  '-': { w: 0.5, strokes: [[[0.06, 0.5], [0.44, 0.5]]] },
  "'": { w: 0.18, strokes: [[[0.09, 1], [0.09, 0.78]]] },
}

export const SPACE_WIDTH = 0.5
export const LETTER_SPACING = 0.26

export function getGlyph(ch: string): Glyph | null {
  return G[ch.toUpperCase()] ?? null
}

/** Advance width of a text line in glyph units. */
export function measureLine(text: string): number {
  let w = 0
  for (const ch of text) {
    const g = getGlyph(ch)
    w += g ? g.w + LETTER_SPACING : SPACE_WIDTH
  }
  return Math.max(0, w - LETTER_SPACING)
}
