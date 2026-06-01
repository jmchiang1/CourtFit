import { REFERENCE_FACILITIES, type Sport } from '@/lib/reference-facilities'
import type { ReferenceFacilityRow } from '@/lib/supabase/types'
import { haversineMiles } from '@/lib/geo'

/** A competing facility reduced to what the competition math needs. */
export interface CompetitorSite {
  name: string
  lat: number
  lng: number
  sports: Sport[]
}

/** Trade-area radius the competition scan uses — matches the demographics radius. */
export const COMPETITION_RADIUS_MILES = 5

/** Merge the curated built-in facilities with the user's added ones. */
export function buildCompetitorSites(custom: ReferenceFacilityRow[] = []): CompetitorSite[] {
  const builtin: CompetitorSite[] = REFERENCE_FACILITIES.map((f) => ({
    name: f.name,
    lat: f.lat,
    lng: f.lng,
    sports: f.sports,
  }))
  const added: CompetitorSite[] = custom
    .filter((r) => r.latitude != null && r.longitude != null)
    .map((r) => ({
      name: r.name,
      lat: r.latitude as number,
      lng: r.longitude as number,
      sports: r.sports as Sport[],
    }))
  return [...builtin, ...added]
}

export interface NearbyFacility {
  name: string
  miles: number
  sports: Sport[]
}

export interface CompetitionResult {
  radiusMiles: number
  badmintonCompetitors: number
  pickleballCompetitors: number
  totalWithin: number
  /** Facilities within the radius, nearest first. */
  nearby: NearbyFacility[]
  nearest: NearbyFacility | null
}

/** Count competing facilities (by sport) within the trade-area radius. */
export function analyzeCompetition(
  lat: number,
  lng: number,
  sites: CompetitorSite[],
  radiusMiles = COMPETITION_RADIUS_MILES,
): CompetitionResult {
  const nearby: NearbyFacility[] = []
  for (const s of sites) {
    const miles = haversineMiles(lat, lng, s.lat, s.lng)
    if (miles <= radiusMiles) nearby.push({ name: s.name, miles, sports: s.sports })
  }
  nearby.sort((a, b) => a.miles - b.miles)
  return {
    radiusMiles,
    badmintonCompetitors: nearby.filter((n) => n.sports.includes('Badminton')).length,
    pickleballCompetitors: nearby.filter((n) => n.sports.includes('Pickleball')).length,
    totalWithin: nearby.length,
    nearby,
    nearest: nearby[0] ?? null,
  }
}
