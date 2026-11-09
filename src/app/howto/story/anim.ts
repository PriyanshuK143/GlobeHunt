/** Tiny keyframe toolkit for the hand-animated story. Times are in seconds. */

export type Ease = (x: number) => number
export const linear: Ease = (x) => x
export const easeInOut: Ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)
export const easeOut: Ease = (x) => 1 - Math.pow(1 - x, 3)
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** Interpolate a numeric track [[t, v], …] at time t (holds ends). */
export function track(t: number, keys: Array<[number, number]>, ease: Ease = easeInOut): number {
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i]
    if (t <= t1) {
      const [t0, v0] = keys[i - 1]
      const k = t1 === t0 ? 1 : ease((t - t0) / (t1 - t0))
      return v0 + (v1 - v0) * k
    }
  }
  return keys[keys.length - 1][1]
}

/** Discrete value at time t from [[t, value], …] (step function). */
export function step<T>(t: number, keys: Array<[number, T]>): T {
  let v = keys[0][1]
  for (const [k, val] of keys) if (t >= k) v = val
  return v
}

export interface Pt {
  x: number
  y: number
}

export const lerpPt = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k })

/** Point track: interpolates x and y with the same keys. */
export function trackPt(t: number, keys: Array<[number, Pt]>, ease: Ease = easeInOut): Pt {
  return {
    x: track(t, keys.map(([k, p]) => [k, p.x]), ease),
    y: track(t, keys.map(([k, p]) => [k, p.y]), ease),
  }
}

/** Two-bone IK: elbow position for shoulder S reaching target T. */
export function solveArm(s: Pt, t: Pt, l1: number, l2: number, bend: 1 | -1): { elbow: Pt; hand: Pt } {
  let dx = t.x - s.x
  let dy = t.y - s.y
  let d = Math.hypot(dx, dy)
  const max = l1 + l2 - 0.5
  if (d > max) {
    dx *= max / d
    dy *= max / d
    d = max
  }
  d = Math.max(d, Math.abs(l1 - l2) + 1)
  const a = Math.atan2(dy, dx)
  const cosB = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
  const b = Math.acos(Math.max(-1, Math.min(1, cosB))) * bend
  const elbow = { x: s.x + Math.cos(a + b) * l1, y: s.y + Math.sin(a + b) * l1 }
  return { elbow, hand: { x: s.x + dx, y: s.y + dy } }
}

/** Deterministic pseudo-random in [0,1) from a number. */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
