// No `server-only` guard here (same as lib/census-core.ts): this is imported by
// census-core, which build scripts run directly under tsx. App code reaches it
// only through lib/census.ts, which carries the server-only guard.

/**
 * Drive-time isochrones via the Mapbox Isochrone API.
 *
 * Returns the outer ring of the area reachable within `minutes` of driving from
 * the point, as [lng, lat] pairs (GeoJSON order). Used to define a property's
 * trade area instead of a straight-line radius — it respects the road network
 * and water barriers, which matters a lot in places like NYC.
 *
 * Returns null (never throws) when the token is missing, the request fails, or
 * no polygon comes back — callers treat that as "fall back to radius", mirroring
 * the null-on-failure contract in lib/geocode.ts.
 */
const MAPBOX_ISOCHRONE = 'https://api.mapbox.com/isochrone/v1/mapbox/driving'

export async function fetchIsochrone(
  lat: number,
  lng: number,
  minutes: number,
): Promise<number[][] | null> {
  const token = process.env.MAPBOX_TOKEN
  if (!token) {
    console.warn('[isochrone] No MAPBOX_TOKEN set — skipping drive-time.')
    return null
  }

  const url = new URL(`${MAPBOX_ISOCHRONE}/${lng},${lat}`)
  url.searchParams.set('contours_minutes', String(minutes))
  url.searchParams.set('polygons', 'true')
  url.searchParams.set('denoise', '1')
  url.searchParams.set('access_token', token)

  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      console.warn(`[isochrone] HTTP ${res.status} for ${minutes}min @ ${lat},${lng}`)
      return null
    }
    const data = (await res.json()) as {
      features?: { geometry?: { type?: string; coordinates?: number[][][] } }[]
    }
    const geom = data.features?.[0]?.geometry
    // Mapbox returns a Polygon: coordinates[0] is the outer ring of [lng,lat] pairs.
    const ring = geom?.coordinates?.[0]
    if (!Array.isArray(ring) || ring.length < 3) return null
    return ring
  } catch (err) {
    console.warn('[isochrone] request failed:', err)
    return null
  }
}
