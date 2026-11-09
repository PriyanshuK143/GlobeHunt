import type { LatLng } from '../../globe'
import { validatePoolAnswer } from '../../../shared/geoPool'
import type { Challenge } from '../types'
import { findCountry, isPointInCountry, type CountryRecord } from '../data/countryIndex'

/** Shared validation (same rules as the multiplayer server) + client country polygons. */
export function validateAnswer(challenge: Challenge, click: LatLng, countryIndex: Map<string, CountryRecord>): boolean {
  return validatePoolAnswer(challenge, click, (atlasName, p) => {
    const record = findCountry(countryIndex, atlasName)
    if (!record) {
      console.warn('[GLOBEHUNT] Missing country polygon for', atlasName)
      return false
    }
    return isPointInCountry(p, record)
  })
}
