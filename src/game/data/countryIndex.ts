import { feature } from 'topojson-client'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import { pointInMultiPolygon, pointInPolygon } from '../validation/geoMath'
import type { LatLng } from '../../globe'

export interface CountryRecord {
  name: string
  geometry: Polygon | MultiPolygon
}

interface WorldAtlasTopo {
  type: 'Topology'
  objects: {
    countries: {
      type: 'GeometryCollection'
      geometries: Array<{
        type: string
        properties?: { name?: string }
        arcs?: unknown
      }>
    }
  }
  arcs: unknown
}

let cache: Map<string, CountryRecord> | null = null
let loadPromise: Promise<Map<string, CountryRecord>> | null = null

async function buildIndex(): Promise<Map<string, CountryRecord>> {
  const response = await fetch('/data/countries-110m.json')
  if (!response.ok) {
    throw new Error(`Failed to load country boundaries (${response.status})`)
  }
  const topo = (await response.json()) as WorldAtlasTopo
  const collection = feature(topo as never, topo.objects.countries as never) as unknown as FeatureCollection<
    Polygon | MultiPolygon,
    { name: string }
  >

  const map = new Map<string, CountryRecord>()
  for (const f of collection.features) {
    const name = f.properties?.name
    if (!name) continue
    if (f.geometry?.type !== 'Polygon' && f.geometry?.type !== 'MultiPolygon') continue
    map.set(normalizeName(name), {
      name,
      geometry: f.geometry,
    })
  }
  return map
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

export async function loadCountryIndex(): Promise<Map<string, CountryRecord>> {
  if (cache) return cache
  if (!loadPromise) {
    loadPromise = buildIndex()
      .then((map) => {
        cache = map
        return map
      })
      .catch((error) => {
        loadPromise = null
        throw error
      })
  }
  return loadPromise
}

export function findCountry(
  index: Map<string, CountryRecord>,
  atlasName: string,
): CountryRecord | undefined {
  return index.get(normalizeName(atlasName))
}

export function isPointInCountry(point: LatLng, record: CountryRecord): boolean {
  if (record.geometry.type === 'Polygon') {
    return pointInPolygon(point, record.geometry.coordinates)
  }
  return pointInMultiPolygon(point, record.geometry.coordinates)
}
