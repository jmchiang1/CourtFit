'use server'

import { fetchIsochrone } from '@/lib/isochrone'

/**
 * Fetch a single driving isochrone ring for the map's drive-time overlay. Lets
 * the user explore an arbitrary drive time around a marker (vs. the fixed
 * sport-specific catchments baked into the demand scores). Returns the outer
 * ring as [lng,lat] pairs, or null when Mapbox isn't configured / the request
 * fails. Minutes are clamped to Mapbox's 1–60 range.
 */
export async function getIsochrone(
  lat: number,
  lng: number,
  minutes: number,
): Promise<number[][] | null> {
  const m = Math.max(1, Math.min(60, Math.round(minutes)))
  return fetchIsochrone(lat, lng, m)
}
