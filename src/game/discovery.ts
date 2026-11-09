import { PLACE_INFO } from './data/facts'
import { poolEntryById } from './data/pool'
import { answerLocation, challengeLabel, featureLabel } from './navigation/regionCamera'
import { labelNorm } from '../globe'
import type { Challenge } from './types'

function factFor(c: Pick<Challenge, 'kind' | 'name'>) {
  // Disambiguated city names ("Hyderabad, Pakistan") look up by the bare name.
  return PLACE_INFO[`${c.kind}:${labelNorm(c.name.split(',')[0])}`]
}

/** Discovery-card content (facts only from the curated, verified table). */
export function discoveryInfoFor(challenge: Challenge) {
  const info = factFor(challenge)
  const kind = challenge.kind === 'country' ? 'Country' : challenge.kind === 'city' ? 'City' : featureLabel(challenge.featureKind)
  const where = challenge.kind === 'city' ? challenge.country : info?.region ?? challenge.region
  return {
    name: challenge.kind === 'feature' ? challenge.name : challengeLabel(challenge),
    subtitle: where ? `${kind} · ${where}` : kind,
    location: answerLocation(challenge),
    fact: info?.fact,
  }
}

/** Multiplayer reveal (the server sends the location only after the round ends). */
export function discoveryInfoForReveal(
  name: string,
  reveal: { challengeId: string; kind: string; featureKind?: string; location: { lat: number; lng: number } },
) {
  const entry = poolEntryById(reveal.challengeId)
  if (entry) return { ...discoveryInfoFor(entry), location: reveal.location }
  const kind = reveal.kind === 'country' ? 'Country' : reveal.kind === 'city' ? 'City' : featureLabel(reveal.featureKind)
  return { name, subtitle: kind, location: reveal.location, fact: undefined }
}
