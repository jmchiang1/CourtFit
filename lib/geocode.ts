import 'server-only'

export interface GeoPoint {
  lat: number
  lng: number
}

/**
 * Resolve a free-text address to coordinates via the Google Geocoding API.
 *
 * Uses a server-side key (`GOOGLE_MAPS_API_KEY`) so it can call the Geocoding
 * web service, which a browser-referrer-restricted `NEXT_PUBLIC_*` key cannot.
 * Falls back to the public key for local setups that only configured one.
 *
 * Returns null (never throws) when the address is empty, the key is missing,
 * or Google returns no result — callers treat that as "not mappable yet".
 */
export async function geocodeAddress(address: string | null): Promise<GeoPoint | null> {
  const query = address?.trim()
  if (!query) return null

  const key =
    process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) {
    console.warn('[geocode] No GOOGLE_MAPS_API_KEY set — skipping geocode.')
    return null
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', query)
  url.searchParams.set('key', key)

  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      console.warn(`[geocode] HTTP ${res.status} for "${query}"`)
      return null
    }
    const data = (await res.json()) as {
      status: string
      results?: { geometry?: { location?: GeoPoint } }[]
    }
    if (data.status !== 'OK' || !data.results?.length) {
      if (data.status !== 'ZERO_RESULTS') {
        console.warn(`[geocode] status ${data.status} for "${query}"`)
      }
      return null
    }
    const loc = data.results[0].geometry?.location
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null
    return { lat: loc.lat, lng: loc.lng }
  } catch (err) {
    console.warn('[geocode] request failed:', err)
    return null
  }
}
