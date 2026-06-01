/** [lat, lng, target-Asian population, total population] per Census tract. */
export type DemandTract = [number, number, number, number]
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
