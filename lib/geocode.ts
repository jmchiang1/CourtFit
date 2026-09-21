import 'server-only'

export interface GeoPoint {
  lat: number
  lng: number
}

/**
 * Outcome of a geocode attempt. `retryable` separates "Google says this address
 * doesn't exist" (don't ask again — every retry is a billable request) from
 * "the lookup itself failed" (key rejected, quota, network), which callers
 * should try again later rather than treating as a permanent answer.
 */
export type GeocodeResult =
  | { ok: true; point: GeoPoint }
  | { ok: false; retryable: boolean }

const FAILED_PERMANENT: GeocodeResult = { ok: false, retryable: false }
const FAILED_RETRYABLE: GeocodeResult = { ok: false, retryable: true }

/**
 * Resolve a free-text address to coordinates via the Google Geocoding API.
 *
 * Uses a server-side key (`GOOGLE_MAPS_API_KEY`) so it can call the Geocoding
 * web service, which a browser-referrer-restricted `NEXT_PUBLIC_*` key cannot.
 * Falls back to the public key for local setups that only configured one.
 *
 * Never throws. Only `ZERO_RESULTS` (and an empty address) counts as a settled
 * "no" — every other failure is reported as retryable.
 */
export async function geocodeAddress(address: string | null): Promise<GeocodeResult> {
  const query = address?.trim()
  if (!query) return FAILED_PERMANENT

  const key =
    process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) {
    console.warn('[geocode] No GOOGLE_MAPS_API_KEY set — skipping geocode.')
    return FAILED_RETRYABLE
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', query)
  url.searchParams.set('key', key)

  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      console.warn(`[geocode] HTTP ${res.status} for "${query}"`)
      return FAILED_RETRYABLE
    }
    const data = (await res.json()) as {
      status: string
      error_message?: string
      results?: { geometry?: { location?: GeoPoint } }[]
    }
    if (data.status !== 'OK' || !data.results?.length) {
      if (data.status === 'ZERO_RESULTS') return FAILED_PERMANENT
      // REQUEST_DENIED (billing/key), OVER_QUERY_LIMIT, UNKNOWN_ERROR — the
      // address may well be fine, so leave the door open for another attempt.
      console.warn(
        `[geocode] status ${data.status} for "${query}"`,
        data.error_message ? `— ${data.error_message}` : '',
      )
      return FAILED_RETRYABLE
    }
    const loc = data.results[0].geometry?.location
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
      return FAILED_RETRYABLE
    }
    return { ok: true, point: { lat: loc.lat, lng: loc.lng } }
  } catch (err) {
    console.warn('[geocode] request failed:', err)
    return FAILED_RETRYABLE
  }
}
