/**
 * Per Census tract, packed as a flat tuple to keep the baked JSON compact:
 * [lat, lng, total, white, black, hispanic, asian, eastAsian, southAsian, medianIncome]
 * (see scripts/gen-demand-tracts.ts). Income is dollars; 0 means "not reported".
 */
export type DemandTract = [
  number, number, number, number, number, number, number, number, number, number,
]

/** Field positions within a DemandTract tuple. */
export const TRACT = {
  lat: 0, lng: 1, total: 2, white: 3, black: 4, hispanic: 5,
  asian: 6, eastAsian: 7, southAsian: 8, income: 9,
} as const

/** Selectable population pools for the heatmap weight. */
export type HeatEthnicity =
  | 'Total'
  | 'White'
  | 'Black'
  | 'Hispanic'
  | 'Asian'
  | 'East Asian'
  | 'South Asian'

/** Ordered for the dropdown; maps each option to its tuple index. */
export const ETHNICITY_OPTIONS: { label: HeatEthnicity; index: number }[] = [
  { label: 'Total', index: TRACT.total },
  { label: 'White', index: TRACT.white },
  { label: 'Black', index: TRACT.black },
  { label: 'Hispanic', index: TRACT.hispanic },
  { label: 'Asian', index: TRACT.asian },
  { label: 'East Asian', index: TRACT.eastAsian },
  { label: 'South Asian', index: TRACT.southAsian },
]

/** Median household income is top-coded by the ACS near this value. */
export const INCOME_MAX = 250_000

export interface DemandTractData {
  vintage: string
  tracts: DemandTract[]
}

// Module-level cache so the ~73 KB dataset is fetched & parsed at most once per
// session, shared across map re-mounts.
let cache: DemandTractData | null = null
let inflight: Promise<DemandTractData> | null = null

/**
 * Load the baked per-tract demand for NYC + Nassau (see scripts/gen-demand-tracts.ts).
 *
 * Uses a dynamic `import()` so the JSON ships as its own lazily-fetched chunk —
 * it stays out of the main bundle (loads only when the map asks for it) and
 * avoids a server round-trip, unlike the previous server action. The browser/
 * bundler caches the chunk, so a prefetch on map mount makes the heatmap toggle
 * effectively instant.
 */
export function loadDemandTracts(): Promise<DemandTractData> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = import('@/lib/demand-tracts.json').then((m) => {
      const raw = (m as { default?: unknown }).default ?? m
      cache = raw as unknown as DemandTractData
      return cache
    })
  }
  return inflight
}
