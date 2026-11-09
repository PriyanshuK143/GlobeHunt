import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { Feature, MultiPolygon, Polygon } from 'geojson'
import type { AtlasLabel } from './types'

/** Hand-placed anchors where a polygon centroid lands somewhere unhelpful. */
const ANCHORS: Record<string, [number, number]> = {
  'United States of America': [39.5, -98.5],
  Canada: [58, -102],
  Russia: [62, 94],
  France: [46.6, 2.4],
  Norway: [61.5, 9],
  Chile: [-29, -70.6],
  Indonesia: [-2.2, 117],
  Malaysia: [3.9, 102.2],
  Japan: [36.8, 138.6],
  'United Kingdom': [53.5, -1.8],
  'New Zealand': [-41.6, 172.6],
  Philippines: [12.6, 122.4],
  Italy: [42.8, 12.6],
  Greece: [39.4, 22],
  Denmark: [56.1, 9.3],
  Croatia: [45.2, 15.6],
  Vietnam: [15.8, 106.6],
  Argentina: [-35.5, -65],
  Brazil: [-10.5, -52],
  Mongolia: [46.8, 103],
  Kazakhstan: [48.2, 67.5],
  China: [34.5, 103],
}

/** Shorter display names for long Natural Earth names. */
const DISPLAY: Record<string, string> = {
  'United States of America': 'United States',
  'Dem. Rep. Congo': 'DR Congo',
  'Central African Rep.': 'Central African Rep.',
  'Bosnia and Herz.': 'Bosnia & Herz.',
  'Dominican Rep.': 'Dominican Rep.',
  'Eq. Guinea': 'Eq. Guinea',
  'Fr. S. Antarctic Lands': '',
  'N. Cyprus': '',
  Antarctica: 'Antarctica',
}

function ringStats(ring: number[][]): { area: number; lat: number; lng: number } {
  // Unwrap longitudes so rings that cross the antimeridian stay contiguous.
  const minLng = Math.min(...ring.map((p) => p[0]))
  const maxLng = Math.max(...ring.map((p) => p[0]))
  const wrap = maxLng - minLng > 180
  const pts = ring.map(([lng, lat]) => [wrap && lng < 0 ? lng + 360 : lng, lat])
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
    a += f
    cx += (pts[j][0] + pts[i][0]) * f
    cy += (pts[j][1] + pts[i][1]) * f
  }
  a /= 2
  if (Math.abs(a) < 1e-9) return { area: 0, lat: pts[0][1], lng: pts[0][0] }
  let lng = cx / (6 * a)
  if (lng > 180) lng -= 360
  return { area: Math.abs(a), lat: cy / (6 * a), lng }
}

/** One label per country, anchored on its largest landmass, tiered by size. */
export async function loadCountryLabels(url = '/data/countries-110m.json'): Promise<AtlasLabel[]> {
  const topo = (await (await fetch(url)).json()) as Topology
  const fc = feature(topo, topo.objects.countries as GeometryCollection) as unknown as {
    features: Feature<Polygon | MultiPolygon, { name: string }>[]
  }
  const labels: AtlasLabel[] = []
  for (const f of fc.features) {
    const name = f.properties?.name
    if (!name || !f.geometry) continue
    const display = DISPLAY[name] ?? name
    if (!display) continue
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    let best = { area: 0, lat: 0, lng: 0 }
    let total = 0
    for (const poly of polys) {
      const s = ringStats(poly[0] as number[][])
      total += s.area
      if (s.area > best.area) best = s
    }
    const [lat, lng] = ANCHORS[name] ?? [best.lat, best.lng]
    // Zoom tier + type size from area (square degrees).
    const maxDistance = total > 250 ? 4.6 : total > 60 ? 3.6 : total > 12 ? 2.9 : total > 2 ? 2.3 : 1.8
    const size = total > 900 ? 1.25 : total > 250 ? 1.1 : total > 60 ? 1 : 0.88
    labels.push({
      id: `country:${name}`,
      name: display,
      kind: 'country',
      lat,
      lng,
      country: name,
      maxDistance,
      // Country names outrank every city label; bigger countries win among themselves.
      priority: 86 + Math.min(12, Math.log10(1 + total) * 4),
      size,
    })
  }
  return labels
}
