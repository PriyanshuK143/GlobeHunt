import { readFileSync } from 'node:fs'
import { publicFile } from '../paths.js'
import { feature } from 'topojson-client'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { ServerChallenge } from './challenges.js'
import { scoreAnswer, scoreMultiplier, validatePoolAnswer, type PoolDifficulty } from '../../../shared/geoPool.js'

interface LatLng {
  lat: number
  lng: number
}


function pointInRing(point: LatLng, ring: number[][]): boolean {
  const x = point.lng
  const y = point.lat
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!
    const yi = ring[i]![1]!
    const xj = ring[j]![0]!
    const yj = ring[j]![1]!
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function pointInPolygon(point: LatLng, polygon: number[][][]): boolean {
  if (!polygon.length) return false
  if (!pointInRing(point, polygon[0]!)) return false
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(point, polygon[i]!)) return false
  }
  return true
}


type CountryGeom = Polygon | MultiPolygon
let countryIndex: Map<string, CountryGeom> | null = null

function loadCountries(): Map<string, CountryGeom> {
  if (countryIndex) return countryIndex
  const topoPath = publicFile('data/countries-110m.json')
  const topo = JSON.parse(readFileSync(topoPath, 'utf8'))
  const collection = feature(topo, topo.objects.countries) as unknown as FeatureCollection<
    CountryGeom,
    { name: string }
  >
  const map = new Map<string, CountryGeom>()
  for (const f of collection.features) {
    const name = f.properties?.name
    if (!name || !f.geometry) continue
    map.set(name.trim().toLowerCase(), f.geometry)
  }
  countryIndex = map
  return map
}

function inCountry(point: LatLng, atlasName: string): boolean {
  const geom = loadCountries().get(atlasName.trim().toLowerCase())
  if (!geom) return false
  if (geom.type === 'Polygon') return pointInPolygon(point, geom.coordinates)
  return geom.coordinates.some((poly) => pointInPolygon(point, poly))
}

export function validateServerAnswer(challenge: ServerChallenge, click: LatLng): boolean {
  return validatePoolAnswer(challenge, click, (atlasName, p) => inCountry(p, atlasName))
}

export function scoreElapsed(elapsedMs: number, timerSeconds: number, challenge: ServerChallenge, difficulty: PoolDifficulty): number {
  return scoreAnswer(elapsedMs, timerSeconds, scoreMultiplier(challenge, difficulty))
}
