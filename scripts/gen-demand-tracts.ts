/**
 * Bake per-tract demand for NYC (5 boroughs) + Nassau County into
 * lib/demand-tracts.json, for the map's demand heatmap / greenfield finder.
 *
 * For each Census tract we store its centroid + two demand pools:
 *   t = East+South Asian population (badminton demand)
 *   p = total population (pickleball / broad demand)
 * The heatmap weights points by the selected sport's pool, optionally dimmed
 * near existing facilities (computed client-side).
 *
 * Re-run if the counties / ACS vintage change:
 *   npx tsx scripts/gen-demand-tracts.ts
 * Requires CENSUS_API_KEY (read from .env.local).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv(name: string): void {
  if (process.env[name]) return
  try {
    const text = readFileSync(resolve(root, '.env.local'), 'utf8')
    for (const line of text.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && m[1] === name) process.env[name] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* rely on ambient env */
  }
}

const ACS_VINTAGE = '2023'
const STATE = '36'
const COUNTIES: { fips: string; name: string }[] = [
  { fips: '005', name: 'Bronx' },
  { fips: '047', name: 'Brooklyn' },
  { fips: '061', name: 'Manhattan' },
  { fips: '081', name: 'Queens' },
  { fips: '085', name: 'Staten Island' },
  { fips: '059', name: 'Nassau' },
]

const range = (table: string, from: number, to: number): string[] => {
  const out: string[] = []
  for (let n = from; n <= to; n++) out.push(`${table}_${String(n).padStart(3, '0')}E`)
  return out
}
const EAST_ASIAN = range('B02015', 2, 9)
const SOUTH_ASIAN = range('B02015', 21, 28)
const POP = 'B01003_001E'
const VARS = [POP, ...EAST_ASIAN, ...SOUTH_ASIAN]

const num = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

const TIGERWEB =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/0/query'
const ACS_BASE = `https://api.census.gov/data/${ACS_VINTAGE}/acs/acs5`

async function acsByTract(county: string, key: string): Promise<Map<string, { t: number; p: number }>> {
  const url = new URL(ACS_BASE)
  url.searchParams.set('get', VARS.join(','))
  url.searchParams.set('for', 'tract:*')
  url.searchParams.set('in', `state:${STATE} county:${county}`)
  url.searchParams.set('key', key)
  const res = await fetch(url)
  const table = (await res.json()) as string[][]
  const header = table[0]
  const idx = (c: string) => header.indexOf(c)
  const si = idx('state')
  const ci = idx('county')
  const ti = idx('tract')
  const out = new Map<string, { t: number; p: number }>()
  for (const row of table.slice(1)) {
    const geoid = `${row[si]}${row[ci]}${row[ti]}`
    const pop = num(row[idx(POP)])
    let target = 0
    for (const v of [...EAST_ASIAN, ...SOUTH_ASIAN]) target += num(row[idx(v)])
    out.set(geoid, { t: target, p: pop })
  }
  return out
}

async function centroidsByTract(county: string): Promise<Map<string, [number, number]>> {
  const url = new URL(TIGERWEB)
  url.searchParams.set('where', `STATE='${STATE}' AND COUNTY='${county}'`)
  url.searchParams.set('outFields', 'GEOID')
  url.searchParams.set('returnGeometry', 'true')
  url.searchParams.set('geometryPrecision', '5')
  url.searchParams.set('outSR', '4326')
  url.searchParams.set('f', 'json')
  const res = await fetch(url)
  const data = (await res.json()) as {
    features?: { attributes?: { GEOID?: string }; geometry?: { rings?: number[][][] } }[]
  }
  const out = new Map<string, [number, number]>()
  for (const f of data.features ?? []) {
    const geoid = f.attributes?.GEOID
    const rings = f.geometry?.rings
    if (!geoid || !rings?.length) continue
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const ring of rings) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    out.set(geoid, [Number(((minY + maxY) / 2).toFixed(5)), Number(((minX + maxX) / 2).toFixed(5))])
  }
  return out
}

async function main() {
  loadEnv('CENSUS_API_KEY')
  const key = process.env.CENSUS_API_KEY
  if (!key) {
    console.error('CENSUS_API_KEY not set (checked .env.local). Aborting.')
    process.exit(1)
  }

  const tracts: [number, number, number, number][] = [] // [lat, lng, target, pop]
  for (const c of COUNTIES) {
    process.stdout.write(`• ${c.name} … `)
    const [acs, cents] = await Promise.all([acsByTract(c.fips, key), centroidsByTract(c.fips)])
    let n = 0
    for (const [geoid, demo] of acs) {
      const cent = cents.get(geoid)
      if (!cent || demo.p <= 0) continue
      tracts.push([cent[0], cent[1], demo.t, demo.p])
      n++
    }
    console.log(`${n} tracts`)
  }

  const body = JSON.stringify({ vintage: ACS_VINTAGE, tracts })
  writeFileSync(resolve(root, 'lib/demand-tracts.json'), body)
  console.log(`\nWrote ${tracts.length} tracts → lib/demand-tracts.json (${(body.length / 1024).toFixed(0)} KB)`)
}

main()
