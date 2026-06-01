'use server'

import data from '@/lib/demand-tracts.json'

/** [lat, lng, target-Asian population, total population] per Census tract. */
export type DemandTract = [number, number, number, number]
export interface DemandTractData {
  vintage: string
  tracts: DemandTract[]
}

/**
 * Baked per-tract demand for NYC + Nassau (see scripts/gen-demand-tracts.ts).
 * Returned on demand so the ~73 KB dataset only loads when the map's demand
 * heatmap is switched on, rather than shipping in the main bundle.
 */
export async function getDemandTracts(): Promise<DemandTractData> {
  return data as DemandTractData
}
