import type { Assumptions, ExtractedListing, Rating } from '@/types/analysis'
import type { Demographics } from '@/types/demographics'
import type { ConditionAssessment } from '@/types/condition'
import type { PropertyStatus } from '@/lib/property-status'

export interface PropertyRow {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  label: string | null
  address: string | null
  listing_json: ExtractedListing
  assumptions_json: Assumptions
  /**
   * Manual outreach / viability state. Optional so demo rows and any row read
   * before the 0006_status migration is applied fall back to 'active' via
   * `normalizeStatus`.
   */
  status?: PropertyStatus | null
  /**
   * Manual "interested" star, set by the user. Orthogonal to `status`. Optional
   * so demo rows and any row read before the 0007_interested migration is
   * applied fall back to false.
   */
  interested?: boolean | null
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
  /** Cached AI condition assessment (null until assessed). */
  condition_json: ConditionAssessment | null
  condition_at: string | null
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
