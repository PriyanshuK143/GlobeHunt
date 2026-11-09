import { clamp01, easeOut, linear, track, trackPt, type Pt } from './anim'
import { CAST, type KidId } from './cast'
import type { KidPose } from './Kid'
import { mapToStage } from './Set'

export const STORY_LENGTH = 49

const BRAZIL = mapToStage(-52, -10)
const MEXICO = mapToStage(-102, 23)
const g = (lng: number, lat: number) => mapToStage(lng, lat)

/** Global stage point → kid-local hand target. */
function local(id: KidId, p: Pt): Pt {
  const k = CAST[id]
  return { x: (p.x - k.x) / k.scale, y: (p.y - k.y) / k.scale }
}

export interface Bubble {
  id: string
  speaker: KidId
  text: string
  start: number
  end: number
}

export const BUBBLES: Bubble[] = [
  { id: 'b1', speaker: 'meera', text: 'Find Brazil!', start: 10.4, end: 13.6 },
  { id: 'b2', speaker: 'arjun', text: 'Where is it?', start: 14.8, end: 17.2 },
  { id: 'b3', speaker: 'priya', text: 'Quick! Time’s running out!', start: 17.6, end: 20.8 },
  { id: 'b4', speaker: 'ravi', text: 'Is this it?', start: 22.0, end: 24.6 },
  { id: 'b5', speaker: 'meera', text: 'No! Look properly!', start: 24.9, end: 27.7 },
  { id: 'b6', speaker: 'arjun', text: 'Found it!', start: 30.8, end: 33.2 },
  { id: 'b7', speaker: 'kabir', text: 'Okay, your turn!', start: 33.4, end: 36.2 },
]

const TYPE_RATE = 22 // characters per second

function talking(id: KidId, t: number): boolean {
  return BUBBLES.some((b) => b.speaker === id && t >= b.start && t <= b.start + b.text.length / TYPE_RATE + 0.7)
}

const BLINK_OFFSET: Record<KidId, number> = { meera: 0.3, arjun: 1.7, kabir: 2.6, ravi: 0, priya: 1.1 }

function base(id: KidId, t: number): KidPose {
  const phase = BLINK_OFFSET[id]
  return {
    lean: 0,
    forward: 0,
    bob: Math.sin(t * 2.1 + phase * 2) * 1.4,
    headTilt: Math.sin(t * 0.7 + phase) * 1.5,
    headTurn: 0,
    eyes: 'open',
    mouth: 'smile',
    brows: 0,
    left: null,
    right: null,
  }
}

function finish(id: KidId, t: number, p: KidPose): KidPose {
  if (talking(id, t) && p.mouth !== 'laugh') p.mouth = Math.floor(t * 7) % 2 === 0 ? 'open' : p.mouth === 'grin' ? 'grin' : 'smile'
  const blinking = (t + BLINK_OFFSET[id]) % 3.8 < 0.13
  if (blinking && (p.eyes === 'open' || p.eyes === 'wide')) p.eyes = 'closed'
  return p
}

const within = (t: number, a: number, b: number) => t >= a && t < b
const cheer = (t: number) => within(t, 31.2, 34.2)

function meera(t: number): KidPose {
  const p = base('meera', t)
  p.forward = track(t, [[9, 0], [10, 38], [21, 34], [36, 30], [37.5, 48]])
  p.lean = track(t, [[9, 0], [10, 4], [36, 3]])
  if (within(t, 10.1, 13.8)) {
    p.right = local('meera', g(-140, 40))
    p.pointRight = true
    p.brows = 3
    p.headTurn = 0.2
  }
  if (within(t, 14, 24.7)) {
    p.headTurn = 0.45
    p.mouth = t > 17 ? 'grin' : 'smile'
  }
  if (within(t, 24.7, 28)) {
    p.headTilt = Math.sin(t * 15) * 7
    p.brows = -3
    p.right = local('meera', g(-112, 30))
    p.pointRight = true
    p.headTurn = 0.3
  }
  if (cheer(t)) {
    const clap = Math.sin(t * 16) > 0 ? 0 : 14
    p.left = { x: -14 - clap, y: -70 }
    p.right = { x: 14 + clap, y: -70 }
    p.eyes = 'happy'
    p.mouth = 'grin'
  }
  if (t >= 37.5) {
    // Her turn now: she searches the atlas.
    p.right = local('meera', trackPt(t, [[37.5, g(-150, 35)], [39, g(-120, 15)], [40.5, g(-140, 50)], [42, g(-110, 25)], [44, g(-135, 40)]]))
    p.pointRight = true
    p.headTurn = 0.25 + Math.sin(t * 1.4) * 0.15
    p.eyes = 'wide'
    p.mouth = 'o'
  }
  return finish('meera', t, p)
}

function arjun(t: number): KidPose {
  const p = base('arjun', t)
  p.forward = track(t, [[9.5, 0], [10.5, 30], [14, 30], [14.8, 56], [31.6, 56], [33, 34], [36, 28]])
  if (within(t, 9, 14)) p.headTurn = -0.3
  if (within(t, 14, 29)) {
    const hand = trackPt(t, [
      [14.2, g(10, 40)],
      [15.6, g(40, 10)],
      [17, g(-10, 0)],
      [18.4, g(30, 30)],
      [20, g(-20, 20)],
      [21.5, g(15, 45)],
      [24.6, g(15, 45)],
      [26, g(-25, 5)],
      [27.6, g(-40, -5)],
      [29, g(-30, 10)],
    ])
    p.right = local('arjun', hand)
    p.pointRight = true
    p.headTurn = Math.max(-0.6, Math.min(0.6, (hand.x - 800) / 60))
    p.eyes = 'wide'
    p.mouth = t < 21 ? 'o' : 'flat'
    p.brows = 4
    if (within(t, 22, 24.6)) p.headTurn = -0.7
  }
  if (within(t, 29, 34)) {
    const k = clamp01((t - 29) / 1.5)
    p.right = local('arjun', trackPt(k, [[0, g(-30, 10)], [1, BRAZIL]], easeOut))
    p.pointRight = true
    p.eyes = t < 30.6 ? 'wide' : 'happy'
    p.mouth = t < 30.6 ? 'o' : 'grin'
    p.brows = 5
    if (t > 31.6) {
      p.left = { x: -64, y: -215 + Math.sin(t * 10) * 6 }
      p.bob += Math.abs(Math.sin(t * 7)) * -6
    }
  }
  if (within(t, 34, 37.5)) p.headTurn = 0.5
  if (t >= 37.5) {
    p.headTurn = -0.55
    p.mouth = 'smile'
  }
  return finish('arjun', t, p)
}

function kabir(t: number): KidPose {
  const p = base('kabir', t)
  p.forward = track(t, [[6.8, 0], [7.3, 46], [8.8, 46], [9.6, 26], [14, 26], [14.8, 34], [36, 30]])
  if (within(t, 7.0, 9.0)) {
    const hand = trackPt(t, [[7.0, { x: 1000, y: 648 }], [7.4, { x: 1000, y: 648 }], [8.6, { x: 925, y: 640 }], [9.0, { x: 940, y: 650 }]], linear)
    p.left = local('kabir', hand)
    p.headTurn = -0.3
  }
  if (within(t, 10, 14)) p.headTurn = -0.4
  if (within(t, 14, 24.5)) {
    p.eyes = 'wide'
    p.mouth = 'o'
    p.headTurn = -0.35
  }
  if (within(t, 24.5, 28.8)) {
    p.lean = -6
    p.eyes = 'happy'
    p.mouth = 'laugh'
    p.bob += Math.sin(t * 28) * 2.6
    p.left = { x: -18, y: -38 }
    p.right = { x: 22, y: -30 }
    p.headTilt = -6
  }
  if (cheer(t) && t < 33.3) {
    p.left = { x: -66, y: -212 }
    p.right = { x: 66, y: -212 }
    p.eyes = 'happy'
    p.mouth = 'grin'
    p.bob -= Math.abs(Math.sin(t * 7)) * 6
  }
  if (within(t, 33.3, 36.4)) {
    p.headTurn = -0.6
    p.left = { x: -118, y: -86 }
    p.mouth = 'grin'
  }
  if (t >= 36.4) p.headTurn = -0.4
  return finish('kabir', t, p)
}

function ravi(t: number): KidPose {
  const p = base('ravi', t)
  p.forward = track(t, [[9, 0], [10, 28], [21.3, 28], [22, 58], [24.6, 58], [25.6, 30], [36, 34]])
  if (within(t, 21.6, 25.2)) {
    p.right = local('ravi', MEXICO)
    p.pointRight = true
    p.headTilt = 6
  }
  if (within(t, 25.2, 28.6)) {
    p.headTurn = -0.6
    p.bob += Math.sin(t * 22) * 1.5
  }
  if (cheer(t)) {
    p.left = { x: -62, y: -218 }
    p.right = { x: 62, y: -218 }
    p.bob -= Math.abs(Math.sin(t * 7.5)) * 6
  }
  if (t >= 36) p.headTurn = 0.3 * Math.sin(t * 0.6)
  return finish('ravi', t, p)
}

function priya(t: number): KidPose {
  const p = base('priya', t)
  p.forward = track(t, [[9, 0], [10, 26], [36, 32]])
  if (within(t, 17.4, 21)) {
    p.bob += Math.sin(t * 12) * 3
    p.right = { x: 76 + Math.sin(t * 14) * 14, y: -170 }
    p.headTurn = 0.5
  }
  if (within(t, 24.6, 28.6)) {
    p.left = { x: -6, y: -150 }
    p.bob += Math.sin(t * 24) * 1.6
    p.headTilt = 5
  }
  if (cheer(t)) {
    p.left = { x: -62, y: -218 }
    p.right = { x: 62, y: -218 }
    p.bob -= Math.abs(Math.sin(t * 7 + 1)) * 6
  }
  if (t >= 36) p.headTurn = 0.25
  return finish('priya', t, p)
}

const ACTORS: Record<KidId, (t: number) => KidPose> = { meera, arjun, kabir, ravi, priya }

export interface Frame {
  poses: Record<KidId, KidPose>
  camera: { x: number; y: number; zoom: number }
  /** 1 = framed as an old photograph, 0 = living scene. */
  photo: number
  atlasOpen: number
  brazilGlow: number
  wrongMark: number
  countdown: { visible: number; value: number | null }
  gold: number
  captions: Array<{ id: string; text: string; opacity: number; kind: 'memory' | 'title' }>
}

export function frameAt(t: number): Frame {
  // The photograph is a frozen moment until the memory comes alive.
  const tp = t < 3.6 ? 0 : t
  const poses = Object.fromEntries((Object.keys(ACTORS) as KidId[]).map((id) => [id, ACTORS[id](tp)])) as Record<KidId, KidPose>
  const camera = {
    x: track(t, [[0, 800], [9, 800], [14, 800], [21, 785], [22.6, 760], [28.6, 775], [30.2, 775], [36, 800], [44, 800]]),
    y: track(t, [[0, 520], [6.5, 520], [9, 560], [14, 590], [21, 600], [22.6, 618], [28.6, 615], [30.2, 605], [36, 565], [44, 505]]),
    zoom: track(t, [[0, 1], [6.5, 1], [9, 1.12], [14, 1.24], [21, 1.3], [22.6, 1.44], [28.6, 1.42], [30.2, 1.45], [36, 1.3], [44, 0.9]]),
  }
  const remaining = 10 - Math.floor((t - 14.5) / 1.6)
  const fade = (a: number, b: number, c: number, d: number) => Math.min(clamp01((t - a) / (b - a)), 1 - clamp01((t - c) / (d - c)))
  return {
    poses,
    camera,
    photo: 1 - clamp01((t - 3.4) / 2.8),
    atlasOpen: track(t, [[7.3, 0], [8.7, 1]], linear),
    brazilGlow: t < 30.5 ? 0 : 0.6 + Math.sin((t - 30.5) * 4) * 0.25 * Math.max(0, 1 - (t - 30.5) / 6),
    wrongMark: fade(22.2, 22.6, 27.5, 28.5),
    countdown: {
      visible: fade(14.4, 15, 34, 35),
      value: t >= 30.5 ? null : Math.max(1, Math.min(10, remaining)),
    },
    gold: track(t, [[37.5, 0], [42.5, 0.5], [44.5, 1]]),
    captions: [
      { id: 'c1', text: 'Remember those school days?', opacity: fade(0.6, 1.6, 4.6, 5.8), kind: 'memory' },
      { id: 'c2', text: 'Some memories never leave us.', opacity: fade(38.6, 40, 43.4, 44.4), kind: 'memory' },
      { id: 'c3', text: 'That childhood game is now', opacity: fade(44.8, 45.8, 48.2, 49), kind: 'memory' },
      { id: 'c4', text: 'GLOBEHUNT', opacity: fade(45.6, 46.8, 48.4, 49), kind: 'title' },
    ],
  }
}

export function bubbleReveal(b: Bubble, t: number): { opacity: number; chars: number; scale: number } {
  if (t < b.start || t > b.end + 0.35) return { opacity: 0, chars: 0, scale: 0.6 }
  const pop = clamp01((t - b.start) / 0.22)
  const out = 1 - clamp01((t - b.end) / 0.35)
  return {
    opacity: Math.min(pop, out),
    chars: Math.min(b.text.length, Math.floor((t - b.start - 0.12) * TYPE_RATE)),
    scale: 0.7 + 0.3 * easeOut(pop),
  }
}


