import type { Challenge } from '../types'

const FEATURE_LABEL: Record<string, string> = {
  river: 'River',
  lake: 'Lake',
  mountain: 'Mountain',
  range: 'Mountain range',
  island: 'Island',
  desert: 'Desert',
  sea: 'Sea / gulf',
  strait: 'Strait',
}

export function featureLabel(kind: string | undefined): string {
  return FEATURE_LABEL[kind ?? ''] ?? 'Feature'
}

export function challengeLabel(challenge: Challenge): string {
  if (challenge.kind === 'feature') return `${challenge.name} · ${featureLabel(challenge.featureKind)}`
  return challenge.name
}

/**
 * The answer point — used only for the post-round reveal and discovery card.
 * Camera framing during an active search never uses target coordinates.
 */
export function answerLocation(challenge: Challenge): { lat: number; lng: number } {
  return { lat: challenge.point[0], lng: challenge.point[1] }
}
