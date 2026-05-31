import type { Assumptions, ExtractedListing, Rating } from '@/types/analysis'
import type { Demographics } from '@/types/demographics'

export interface PropertyRow {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  label: string | null
  address: string | null
  listing_json: ExtractedListing
  assumptions_json: Assumptions
  rating: Rating | null
  noi: number | null
  total_courts: number | null
  payback_years: number | null
  /** Cached geocode of `address` (null until geocoded). */
  latitude: number | null
  longitude: number | null
  geocoded_at: string | null
  /** Cached 5-mile trade-area demographics (null until fetched). */
  demographics_json: Demographics | null
  demographics_at: string | null
}

/** A competitor/reference facility the user added from the map. */
export interface ReferenceFacilityRow {
  id: string
  user_id: string
  created_at: string
  name: string
  address: string
  /** Sport tags; values match the `Sport` union ('Badminton' | 'Pickleball'). */
  sports: string[]
  latitude: number | null
  longitude: number | null
  geocoded_at: string | null
  demographics_json: Demographics | null
  demographics_at: string | null
}
