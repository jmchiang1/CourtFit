import type { Demographics } from '@/types/demographics'
import { badmintonFit, pickleballFit } from '@/lib/fit-score'

/**
 * Pull trade-area demographics within ~5 miles of a property from the US Census
 * ACS 5-year estimates, and derive badminton / pickleball demand fit scores.
 *
 * Flow:
 *   1. TIGERweb (ArcGIS REST) — every census tract intersecting a 5-mile circle.
 *   2. ACS API — summable population / ethnicity / income / age counts per tract.
 *   3. Aggregate across tracts and score.
 *
 * Returns null (never throws) when there are no coordinates, no Census key, the
 * point is outside the US, or any request fails — callers treat that as "no
 * demographics yet", mirroring lib/geocode.ts.
 */

const ACS_VINTAGE = '2023'
const RADIUS_MILES = 5
const RADIUS_METERS = Math.round(RADIUS_MILES * 1609.344) // 8047

const TIGERWEB_TRACTS =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/0/query'
const ACS_BASE = `https://api.census.gov/data/${ACS_VINTAGE}/acs/acs5`

// --- ACS variable codes (verified against the 2023 ACS5 group metadata) ---
// B02015 = Asian Alone by Selected Groups. Census buckets the leaves under
// East / Southeast / South / Central Asian headings; we sum the East and South
// Asian leaves (the badminton target communities). Hmong (_003) sits under
// Census's "East Asian" heading, so it's included there per their grouping.
const POP = 'B01003_001E' // total population
const HOUSEHOLDS = 'B11001_001E' // total households
const AGG_INCOME = 'B19025_001E' // aggregate household income
const ASIAN_TOTAL = 'B02015_001E'
const EAST_ASIAN = range('B02015', 2, 9) // Chinese..Other East Asian
const SOUTH_ASIAN = range('B02015', 21, 28) // Asian Indian..Other South Asian

// B01001 = Sex by Age. Male and Female mirror each other, offset by 24.
const AGE_TOTAL = 'B01001_001E'
const AGE_UNDER18 = [...range('B01001', 3, 6), ...range('B01001', 27, 30)]
const AGE_PRIME = [...range('B01001', 7, 14), ...range('B01001', 31, 38)] // 18–44
const AGE_MATURE = [...range('B01001', 15, 19), ...range('B01001', 39, 43)] // 45–64
const AGE_SENIOR = [...range('B01001', 20, 25), ...range('B01001', 44, 49)] // 65+

// Two ACS calls per county keeps each request well under the 50-variable cap.
const POP_VARS = [POP, HOUSEHOLDS, AGG_INCOME, ASIAN_TOTAL, ...EAST_ASIAN, ...SOUTH_ASIAN]
const AGE_VARS = [AGE_TOTAL, ...AGE_UNDER18, ...AGE_PRIME, ...AGE_MATURE, ...AGE_SENIOR]

function range(table: string, from: number, to: number): string[] {
  const out: string[] = []
  for (let n = from; n <= to; n++) out.push(`${table}_${String(n).padStart(3, '0')}E`)
  return out
}

interface Accum {
  population: number
  households: number
  aggIncome: number
  eastAsian: number
  southAsian: number
  under18: number
  prime: number
  mature: number
  senior: number
}

export async function fetchDemographics(
  lat: number | null,
  lng: number | null,
): Promise<Demographics | null> {
  if (lat == null || lng == null) return null

  const key = process.env.CENSUS_API_KEY
  if (!key) {
    console.warn('[census] No CENSUS_API_KEY set — skipping demographics.')
    return null
  }

  try {
    const geoids = await tractsWithinRadius(lat, lng)
    if (!geoids.length) return null

    // Group the wanted tract GEOIDs by state+county so we make one request per
    // county. We query every tract in the county (`tract:*`) and filter to this
    // set, which avoids long-URL limits from passing 70+ tract codes inline.
    const byCounty = new Map<string, Set<string>>()
    for (const g of geoids) {
      if (g.length < 11) continue
      const stateCounty = `${g.slice(0, 2)}:${g.slice(2, 5)}`
      const set = byCounty.get(stateCounty) ?? new Set<string>()
      set.add(g)
      byCounty.set(stateCounty, set)
    }
    if (!byCounty.size) return null

    const acc: Accum = {
      population: 0, households: 0, aggIncome: 0,
      eastAsian: 0, southAsian: 0,
      under18: 0, prime: 0, mature: 0, senior: 0,
    }

    for (const [sc, wanted] of byCounty) {
      const [state, county] = sc.split(':')
      const [pop, age] = await Promise.all([
        acsQuery(POP_VARS, state, county, wanted, key),
        acsQuery(AGE_VARS, state, county, wanted, key),
      ])
      for (const row of pop) {
        acc.population += sum(row, [POP])
        acc.households += sum(row, [HOUSEHOLDS])
        acc.aggIncome += sum(row, [AGG_INCOME])
        acc.eastAsian += sum(row, EAST_ASIAN)
        acc.southAsian += sum(row, SOUTH_ASIAN)
      }
      for (const row of age) {
        acc.under18 += sum(row, AGE_UNDER18)
        acc.prime += sum(row, AGE_PRIME)
        acc.mature += sum(row, AGE_MATURE)
        acc.senior += sum(row, AGE_SENIOR)
      }
    }

    if (acc.population <= 0) return null
    return assemble(acc, geoids.length)
  } catch (err) {
    console.warn('[census] demographics fetch failed:', err)
    return null
  }
}

/** Census tract GEOIDs whose geometry intersects a 5-mile circle around the point. */
async function tractsWithinRadius(lat: number, lng: number): Promise<string[]> {
  const url = new URL(TIGERWEB_TRACTS)
  url.searchParams.set('geometry', `${lng},${lat}`)
  url.searchParams.set('geometryType', 'esriGeometryPoint')
  url.searchParams.set('inSR', '4326')
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
  url.searchParams.set('distance', String(RADIUS_METERS))
  url.searchParams.set('units', 'esriSRUnit_Meter')
  url.searchParams.set('outFields', 'GEOID')
  url.searchParams.set('returnGeometry', 'false')
  url.searchParams.set('f', 'json')

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    console.warn(`[census] TIGERweb HTTP ${res.status}`)
    return []
  }
  const data = (await res.json()) as {
    features?: { attributes?: { GEOID?: string } }[]
  }
  const ids = (data.features ?? [])
    .map((f) => f.attributes?.GEOID)
    .filter((g): g is string => typeof g === 'string')
  return Array.from(new Set(ids))
}

type AcsRow = Record<string, number>

/**
 * Query ACS for `vars` across every tract in one county, then keep only the
 * rows whose GEOID is in `wanted` (the tracts inside our radius). Querying
 * `tract:*` and filtering avoids long-URL limits from listing many tract codes.
 */
async function acsQuery(
  vars: string[],
  state: string,
  county: string,
  wanted: Set<string>,
  key: string,
): Promise<AcsRow[]> {
  const url = new URL(ACS_BASE)
  url.searchParams.set('get', vars.join(','))
  url.searchParams.set('for', 'tract:*')
  url.searchParams.set('in', `state:${state} county:${county}`)
  url.searchParams.set('key', key)

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    console.warn(`[census] ACS HTTP ${res.status} (state ${state} county ${county})`)
    return []
  }
  // ACS returns [ [header...], [row...], ... ]. First row is the column names;
  // every row also carries state/county/tract columns we rebuild a GEOID from.
  const table = (await res.json()) as string[][]
  if (!Array.isArray(table) || table.length < 2) return []
  const header = table[0]
  const gi = {
    state: header.indexOf('state'),
    county: header.indexOf('county'),
    tract: header.indexOf('tract'),
  }
  const rows: AcsRow[] = []
  for (const cells of table.slice(1)) {
    const geoid = `${cells[gi.state]}${cells[gi.county]}${cells[gi.tract]}`
    if (!wanted.has(geoid)) continue
    const row: AcsRow = {}
    header.forEach((col, i) => {
      const n = Number(cells[i])
      // Census jams missing values with large negatives (e.g. -666666666); drop them.
      row[col] = Number.isFinite(n) && n >= 0 ? n : 0
    })
    rows.push(row)
  }
  return rows
}

const sum = (row: AcsRow, cols: string[]) => cols.reduce((t, c) => t + (row[c] ?? 0), 0)

function assemble(acc: Accum, tractCount: number): Demographics {
  const pop = acc.population
  const targetAsian = acc.eastAsian + acc.southAsian
  const meanHouseholdIncome = acc.households > 0 ? Math.round(acc.aggIncome / acc.households) : null
  const targetShare = targetAsian / pop
  const prime18to44Share = acc.prime / pop
  const adult18to64Share = (acc.prime + acc.mature) / pop

  const fitInputs = {
    targetShare,
    meanHouseholdIncome,
    prime18to44Share,
    adult18to64Share,
    totalPopulation: pop,
  }

  return {
    vintage: ACS_VINTAGE,
    radiusMiles: RADIUS_MILES,
    tractCount,
    totalPopulation: pop,
    households: acc.households,
    meanHouseholdIncome,
    ethnicity: {
      eastAsian: acc.eastAsian,
      southAsian: acc.southAsian,
      targetAsian,
      eastAsianShare: acc.eastAsian / pop,
      southAsianShare: acc.southAsian / pop,
      targetShare,
    },
    age: {
      under18: acc.under18,
      prime18to44: acc.prime,
      mature45to64: acc.mature,
      senior65plus: acc.senior,
      prime18to44Share,
      adult18to64Share,
    },
    badmintonFit: badmintonFit(fitInputs),
    pickleballFit: pickleballFit(fitInputs),
    fetchedAt: new Date().toISOString(),
  }
}
