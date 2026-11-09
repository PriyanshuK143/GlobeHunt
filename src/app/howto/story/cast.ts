import type { KidLook } from './Kid'

/**
 * The five friends — fixed looks used in every scene (character consistency).
 * Three boys (Arjun, Kabir, Ravi) and two girls (Meera, Priya).
 */
const SKIN_A = '#c8956a'
const SKIN_B = '#b98459'
const SKIN_C = '#d2a174'

export const CAST: Record<string, KidLook & { x: number; y: number; scale: number }> = {
  meera: {
    id: 'meera', name: 'Meera', gender: 'girl', view: 'front', hair: 'braids', bindi: true,
    skin: SKIN_C, shirt: '#f1e3c4', bottom: '#7e4f2a', accent: '#c0632e',
    x: 520, y: 600, scale: 0.92,
  },
  arjun: {
    id: 'arjun', name: 'Arjun', gender: 'boy', view: 'front', hair: 'sidepart', tie: true,
    skin: SKIN_A, shirt: '#f3e6ca', bottom: '#5c4630', accent: '#8a4a22',
    x: 800, y: 585, scale: 0.88,
  },
  kabir: {
    id: 'kabir', name: 'Kabir', gender: 'boy', view: 'front', hair: 'curly', glasses: true,
    skin: SKIN_B, shirt: '#ead9b6', bottom: '#6a5236', accent: '#8a4a22',
    x: 1080, y: 600, scale: 0.92,
  },
  ravi: {
    id: 'ravi', name: 'Ravi', gender: 'boy', view: 'back', hair: 'crew',
    skin: SKIN_A, shirt: '#efe0c0', bottom: '#5c4630', accent: '#8a4a22',
    x: 505, y: 880, scale: 1.12,
  },
  priya: {
    id: 'priya', name: 'Priya', gender: 'girl', view: 'back', hair: 'longbraid',
    skin: SKIN_C, shirt: '#f1e3c4', bottom: '#7e4f2a', accent: '#c0632e',
    x: 1095, y: 880, scale: 1.12,
  },
}

export type KidId = keyof typeof CAST
export const BACK_ROW: KidId[] = ['meera', 'arjun', 'kabir']
export const FRONT_ROW: KidId[] = ['ravi', 'priya']
