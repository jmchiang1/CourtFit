export type FitLabel = 'Strong' | 'Moderate' | 'Weak'

export interface FitScore {
  /** 0–100. */
  score: number
  label: FitLabel
}

export interface Ethnicity {
  /** East Asian count (Chinese, Japanese, Korean, Taiwanese, Mongolian, …). */
  eastAsian: number
  /** South Asian count (Asian Indian, Pakistani, Bangladeshi, Nepalese, Sri Lankan, …). */
  southAsian: number
  /** eastAsian + southAsian. The badminton target community. */
  targetAsian: number
  /** eastAsian / totalPopulation (0–1). */
  eastAsianShare: number
  /** southAsian / totalPopulation (0–1). */
  southAsianShare: number
  /** targetAsian / totalPopulation (0–1). */
  targetShare: number
}

export interface AgeBands {
  under18: number
  prime18to44: number
  mature45to64: number
  senior65plus: number
  /** prime18to44 / totalPopulation (0–1). */
  prime18to44Share: number
  /** (prime18to44 + mature45to64) / totalPopulation (0–1). */
  adult18to64Share: number
}

/**
 * A single trade-area catchment — either a straight-line radius or a drive-time
 * isochrone — with the ACS figures aggregated over it and the sport's fit score.
 */
export interface Catchment {
  kind: 'radius' | 'drive'
  /** Set when kind === 'drive'. */
  driveMinutes?: number
  /** Set when kind === 'radius'. */
  radiusMiles?: number
  /** Number of census tracts aggregated. */
  tractCount: number
  totalPopulation: number
  households: number
  /** Mean household income (aggregate income / households). Null if unknown. */
  meanHouseholdIncome: number | null
  ethnicity: Ethnicity
  age: AgeBands
  /** Demand fit for the sport this catchment was computed for. */
  fit: FitScore
  /** Isochrone outer ring as [lng, lat] pairs (drive mode only) for map rendering. */
  ring?: number[][] | null
}

/**
 * Trade-area demographics for a property, aggregated from US Census ACS 5-year
 * estimates. Stored on the property as `demographics_json`.
 *
 * Two modes:
 *  - 'radius' (legacy / fallback): one 5-mile circle feeds both sports.
 *  - 'drive': sport-specific Mapbox driving isochrones — the top-level flat
 *    fields mirror the (wider) badminton catchment, while `catchments` carries
 *    the full per-sport breakdown + isochrone polygons.
 *
 * `mode` is absent on rows written before drive-time existed; treat absent as
 * 'radius'. The flat fields below are always present so every consumer keeps
 * working regardless of mode.
 */
export interface Demographics {
  /** ACS 5-year vintage these figures come from, e.g. "2023". */
  vintage: string
  /** How the catchment was defined. Absent ⇒ legacy 'radius'. */
  mode?: 'radius' | 'drive'
  /** Trade-area radius the flat figures cover, in miles (radius mode). */
  radiusMiles: number
  /** Number of census tracts aggregated into the flat figures. */
  tractCount: number

  totalPopulation: number
  households: number
  /** Mean household income across the area (aggregate income / households). Null if unknown. */
  meanHouseholdIncome: number | null

  ethnicity: Ethnicity
  age: AgeBands

  /** Demand signal for badminton (ethnicity-weighted), over its own catchment. */
  badmintonFit: FitScore
  /** Demand signal for pickleball (broad-demographic), over its own catchment. */
  pickleballFit: FitScore

  /** Sport-specific drive-time catchments. Absent on legacy radius-only rows. */
  catchments?: {
    badminton: Catchment
    pickleball: Catchment
  }

  /** ISO timestamp the data was fetched. */
  fetchedAt: string
}
