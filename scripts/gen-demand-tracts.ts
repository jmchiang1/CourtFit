/**
 * Bake per-tract demand for the NYC metro — NYC's 5 boroughs, all of Long Island
 * (Nassau + Suffolk), and the commutable New Jersey counties — into
 * lib/demand-tracts.json, for the map's demand heatmap / greenfield finder.
 *
 * For each Census tract we store its centroid, a set of population pools by
 * race/ethnicity, and median household income:
 *   [lat, lng, total, white, black, hispanic, asian, eastAsian, southAsian, medianIncome]
 * The heatmap weights points by the selected ethnicity pool and filters them by
 * a median-income band (both chosen client-side).
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
// FIPS state codes: New York = 36, New Jersey = 34.
const COUNTIES: { state: string; fips: string; name: string }[] = [
  // New York — 5 boroughs + all of Long Island (Nassau + Suffolk)
  { state: '36', fips: '005', name: 'Bronx' },
  { state: '36', fips: '047', name: 'Brooklyn' },
  { state: '36', fips: '061', name: 'Manhattan' },
  { state: '36', fips: '081', name: 'Queens' },
  { state: '36', fips: '085', name: 'Staten Island' },
  { state: '36', fips: '059', name: 'Nassau' },
  { state: '36', fips: '103', name: 'Suffolk' },
  // New Jersey — commutable NYC-metro counties
  { state: '34', fips: '003', name: 'Bergen' },
  { state: '34', fips: '017', name: 'Hudson' },
  { state: '34', fips: '013', name: 'Essex' },
  { state: '34', fips: '039', name: 'Union' },
  { state: '34', fips: '031', name: 'Passaic' },
  { state: '34', fips: '023', name: 'Middlesex' },
  { state: '34', fips: '027', name: 'Morris' },
  { state: '34', fips: '035', name: 'Somerset' },
  { state: '34', fips: '025', name: 'Monmouth' },
]

const range = (table: string, from: number, to: number): string[] => {
  const out: string[] = []
  for (let n = from; n <= to; n++) out.push(`${table}_${String(n).padStart(3, '0')}E`)
  return out
}
// B02015 — Asian alone by detailed group (for the East/South Asian split).
const EAST_ASIAN = range('B02015', 2, 9)
const SOUTH_ASIAN = range('B02015', 21, 28)
// B03002 — Hispanic or Latino origin by race (mutually-exclusive groups).
const TOTAL = 'B03002_001E'
const WHITE_NH = 'B03002_003E' // White, not Hispanic
const BLACK_NH = 'B03002_004E' // Black, not Hispanic
const ASIAN_NH = 'B03002_006E' // Asian, not Hispanic
const HISPANIC = 'B03002_012E' // Hispanic or Latino, any race
// B19013 — median household income (dollars; missing comes back negative).
const MED_INCOME = 'B19013_001E'
const VARS = [TOTAL, WHITE_NH, BLACK_NH, ASIAN_NH, HISPANIC, MED_INCOME, ...EAST_ASIAN, ...SOUTH_ASIAN]

interface TractDemo {
  total: number
  white: number
  black: number
  hispanic: number
  asian: number
  eastAsian: number
  southAsian: number
  income: number
}

const num = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

const TIGERWEB =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/0/query'
const ACS_BASE = `https://api.census.gov/data/${ACS_VINTAGE}/acs/acs5`

async function acsByTract(state: string, county: string, key: string): Promise<Map<string, TractDemo>> {
  const url = new URL(ACS_BASE)
  url.searchParams.set('get', VARS.join(','))
  url.searchParams.set('for', 'tract:*')
  url.searchParams.set('in', `state:${state} county:${county}`)
  url.searchParams.set('key', key)
  const res = await fetch(url)
  const table = (await res.json()) as string[][]
  const header = table[0]
  const idx = (c: string) => header.indexOf(c)
  const si = idx('state')
  const ci = idx('county')
  const ti = idx('tract')
  const out = new Map<string, TractDemo>()
  for (const row of table.slice(1)) {
    const geoid = `${row[si]}${row[ci]}${row[ti]}`
    let eastAsian = 0
    for (const v of EAST_ASIAN) eastAsian += num(row[idx(v)])
    let southAsian = 0
    for (const v of SOUTH_ASIAN) southAsian += num(row[idx(v)])
    out.set(geoid, {
      total: num(row[idx(TOTAL)]),
      white: num(row[idx(WHITE_NH)]),
      black: num(row[idx(BLACK_NH)]),
      hispanic: num(row[idx(HISPANIC)]),
      asian: num(row[idx(ASIAN_NH)]),
      eastAsian,
      southAsian,
      income: num(row[idx(MED_INCOME)]),
    })
  }
  return out
}

async function centroidsByTract(state: string, county: string): Promise<Map<string, [number, number]>> {
  const url = new URL(TIGERWEB)
  url.searchParams.set('where', `STATE='${state}' AND COUNTY='${county}'`)
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

  // [lat, lng, total, white, black, hispanic, asian, eastAsian, southAsian, income]
  const tracts: number[][] = []
  for (const c of COUNTIES) {
    process.stdout.write(`• ${c.name} … `)
    const [acs, cents] = await Promise.all([acsByTract(c.state, c.fips, key), centroidsByTract(c.state, c.fips)])
    let n = 0
    for (const [geoid, d] of acs) {
      const cent = cents.get(geoid)
      if (!cent || d.total <= 0) continue
      tracts.push([cent[0], cent[1], d.total, d.white, d.black, d.hispanic, d.asian, d.eastAsian, d.southAsian, d.income])
      n++
    }
    console.log(`${n} tracts`)
  }

  const body = JSON.stringify({ vintage: ACS_VINTAGE, tracts })
  writeFileSync(resolve(root, 'lib/demand-tracts.json'), body)
  console.log(`\nWrote ${tracts.length} tracts → lib/demand-tracts.json (${(body.length / 1024).toFixed(0)} KB)`)
}

main()
