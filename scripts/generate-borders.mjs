/**
 * Regenerates public/textures/earth-borders.png from Natural Earth TopoJSON.
 * Usage: npm run generate:borders
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { feature } from 'topojson-client'
import { PNG } from 'pngjs'

const WIDTH = 4096
const HEIGHT = 2048
const topo = JSON.parse(readFileSync('public/data/countries-110m.json', 'utf8'))
const geo = feature(topo, topo.objects.countries)

const png = new PNG({ width: WIDTH, height: HEIGHT, colorType: 6 })
png.data.fill(0)

function project(lon, lat) {
  return [((lon + 180) / 360) * WIDTH, ((90 - lat) / 180) * HEIGHT]
}

function setPixel(x, y, a) {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (xi < 0 || yi < 0 || xi >= WIDTH || yi >= HEIGHT) return
  const idx = (WIDTH * yi + xi) << 2
  png.data[idx] = 210
  png.data[idx + 1] = 225
  png.data[idx + 2] = 245
  png.data[idx + 3] = Math.max(png.data[idx + 3], a)
}

function drawLine(x0, y0, x1, y1) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    setPixel(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 185)
  }
}

function drawRing(ring) {
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon0, lat0] = ring[i]
    const [lon1, lat1] = ring[i + 1]
    if (Math.abs(lon0 - lon1) > 180) continue
    const [x0, y0] = project(lon0, lat0)
    const [x1, y1] = project(lon1, lat1)
    drawLine(x0, y0, x1, y1)
  }
}

for (const f of geo.features) {
  const g = f.geometry
  if (!g) continue
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  for (const poly of polys) {
    for (const ring of poly) drawRing(ring)
  }
}

mkdirSync('public/textures', { recursive: true })
writeFileSync('public/textures/earth-borders.png', PNG.sync.write(png))
console.log(`Wrote public/textures/earth-borders.png (${WIDTH}x${HEIGHT})`)
