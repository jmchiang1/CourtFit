import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { fetchIsochrone } from '../isochrone'

const RING = [
  [-73.9, 40.7],
  [-73.8, 40.7],
  [-73.8, 40.8],
  [-73.9, 40.8],
  [-73.9, 40.7],
]

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as Response)
}

describe('fetchIsochrone', () => {
  beforeEach(() => {
    process.env.MAPBOX_TOKEN = 'test-token'
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.MAPBOX_TOKEN
  })

  it('returns the outer ring of the first polygon feature', async () => {
    vi.stubGlobal('fetch', mockFetch({ features: [{ geometry: { type: 'Polygon', coordinates: [RING] } }] }))
    const ring = await fetchIsochrone(40.75, -73.85, 15)
    expect(ring).toEqual(RING)
  })

  it('returns null when no token is set', async () => {
    delete process.env.MAPBOX_TOKEN
    const spy = mockFetch({})
    vi.stubGlobal('fetch', spy)
    const ring = await fetchIsochrone(40.75, -73.85, 15)
    expect(ring).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns null on a non-OK response', async () => {
    vi.stubGlobal('fetch', mockFetch({}, false, 422))
    expect(await fetchIsochrone(40.75, -73.85, 15)).toBeNull()
  })

  it('returns null when the polygon has too few points', async () => {
    vi.stubGlobal('fetch', mockFetch({ features: [{ geometry: { coordinates: [[[0, 0], [1, 1]]] } }] }))
    expect(await fetchIsochrone(40.75, -73.85, 15)).toBeNull()
  })

  it('passes driving profile + minutes in the request URL', async () => {
    const spy = mockFetch({ features: [{ geometry: { coordinates: [RING] } }] })
    vi.stubGlobal('fetch', spy)
    await fetchIsochrone(40.75, -73.85, 20)
    const url = String((spy.mock.calls[0] as unknown[])[0])
    expect(url).toContain('/isochrone/v1/mapbox/driving/-73.85,40.75')
    expect(url).toContain('contours_minutes=20')
    expect(url).toContain('polygons=true')
  })
})
