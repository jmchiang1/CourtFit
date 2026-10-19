import { TRACT, type DemandTract } from '@/lib/demand-tracts-data'
import { haversineMiles } from '@/lib/geo'

/**
 * Greenfield site finder: where would a new badminton facility face the least
 * competition for the most Asian residents? Pure function over the baked Census
 * tracts + the current competitor list, so it re-ranks the moment a reference
 * facility is added or removed.
 *
 * Model (eyeball-able, like lib/whitespace.ts):
 *  1. Bin tracts into ~1-mile cells; each cell's Asian-weighted centroid is a
 *     candidate site.
 *  2. For each candidate, sum the Asian population within `radiusMiles` and
 *     count badminton competitors in the same radius.
 *  3. Score = Asian residents per facility if you opened there:
 *     pop / (competitors + 1). Candidates within `minCompetitorMiles` of an
 *     existing facility are skipped outright — opening next door is never the pick.
 *  4. Greedily take the best, suppressing anything within `minSeparationMiles`
 *     of an earlier pick so the suggestions spread across distinct markets.
 */

export interface OpportunityCompetitor {
  name: string
  lat: number
  lng: number
}

export interface Opportunity {
  /** Stable for a given location (used as a React key / overlay cache key). */
  id: string
  rank: number
  lat: number
  lng: number
  /** Asian residents (non-Hispanic Asian alone, ACS) within the radius. */
  asianPop: number
  /** Badminton facilities within the radius. */
  competitors: number
  nearest: { name: string; miles: number } | null
  /** Asian residents per facility, counting the new one. */
  score: number
}

export interface OpportunityOptions {
  radiusMiles?: number
  count?: number
  minSeparationMiles?: number
  minCompetitorMiles?: number
  cellMiles?: number
}

// Local equirectangular projection (miles) — accurate to well under 1% across
// the NYC metro, and far cheaper than haversine in the O(cells²) scan.
const MI_PER_DEG_LAT = 69.0
const REF_LAT = 40.75
const MI_PER_DEG_LNG = MI_PER_DEG_LAT * Math.cos((REF_LAT * Math.PI) / 180)

interface Cell {
  x: number
  y: number
  lat: number
  lng: number
  asian: number
}

export function findOpportunities(
  tracts: DemandTract[],
  competitors: OpportunityCompetitor[],
  {
    radiusMiles = 5,
    count = 8,
    minSeparationMiles = 5,
    minCompetitorMiles = 2,
    cellMiles = 1,
  }: OpportunityOptions = {},
): Opportunity[] {
  // 1. Bin tracts into cells, keeping an Asian-weighted centroid per cell.
  const bins: Record<string, { sx: number; sy: number; w: number; asian: number }> = {}
  for (const t of tracts) {
    const asian = t[TRACT.asian]
    if (asian <= 0) continue
    const x = t[TRACT.lng] * MI_PER_DEG_LNG
    const y = t[TRACT.lat] * MI_PER_DEG_LAT
    const key = `${Math.floor(x / cellMiles)}:${Math.floor(y / cellMiles)}`
    const b = (bins[key] ??= { sx: 0, sy: 0, w: 0, asian: 0 })
    b.sx += x * asian
    b.sy += y * asian
    b.w += asian
    b.asian += asian
  }
  const cells: Cell[] = Object.values(bins).map((b) => {
    const x = b.sx / b.w
    const y = b.sy / b.w
    return { x, y, lat: y / MI_PER_DEG_LAT, lng: x / MI_PER_DEG_LNG, asian: b.asian }
  })

  const comps = competitors.map((c) => ({
    ...c,
    x: c.lng * MI_PER_DEG_LNG,
    y: c.lat * MI_PER_DEG_LAT,
  }))

  // 2–3. Score every cell as a candidate site.
  const r2 = radiusMiles * radiusMiles
  const scored: Opportunity[] = []
  for (const c of cells) {
    let near: (typeof comps)[number] | null = null
    let nearD = Infinity
    let inRadius = 0
    for (const k of comps) {
      const d = Math.hypot(k.x - c.x, k.y - c.y)
      if (d <= radiusMiles) inRadius++
      if (d < nearD) {
        near = k
        nearD = d
      }
    }
    if (nearD < minCompetitorMiles) continue

    let pop = 0
    for (const o of cells) {
      const dx = o.x - c.x
      const dy = o.y - c.y
      if (dx * dx + dy * dy <= r2) pop += o.asian
    }
    scored.push({
      id: `opp-${c.lat.toFixed(4)},${c.lng.toFixed(4)}`,
      rank: 0,
      lat: c.lat,
      lng: c.lng,
      asianPop: pop,
      competitors: inRadius,
      nearest: near ? { name: near.name, miles: haversineMiles(c.lat, c.lng, near.lat, near.lng) } : null,
      score: pop / (inRadius + 1),
    })
  }

  // 4. Greedy pick with spatial suppression.
  scored.sort((a, b) => b.score - a.score)
  const picks: Opportunity[] = []
  for (const s of scored) {
    if (picks.length >= count) break
    if (picks.some((p) => haversineMiles(p.lat, p.lng, s.lat, s.lng) < minSeparationMiles)) continue
    picks.push({ ...s, rank: picks.length + 1 })
  }
  return picks
}
