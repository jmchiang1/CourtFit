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
 * isochrone — with the ACS figures aggregated over it and the badminton fit score.
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
  /** Badminton demand fit over this catchment. */
  fit: FitScore
  /** Isochrone outer ring as [lng, lat] pairs (drive mode only) for map rendering. */
  ring?: number[][] | null
}

/**
 * Trade-area demographics for a property, aggregated from US Census ACS 5-year
 * estimates. Stored on the property as `demographics_json`.
 *
 * Two modes:
 *  - 'radius' (legacy / fallback): one 5-mile circle.
 *  - 'drive': a Mapbox driving isochrone for badminton — the top-level flat
 *    fields mirror `catchments.badminton`, which also carries the polygon.
 *
 * Rows written before the app went badminton-only also carry `pickleballFit`
 * and `catchments.pickleball`. They're kept as optional, deprecated fields so
 * those rows still type-check; nothing writes or reads them any more.
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

  /** Demand signal for badminton (ethnicity-weighted), over its catchment. */
  badmintonFit: FitScore
  /** @deprecated Legacy rows only (pre badminton-only). Never written; don't read. */
  pickleballFit?: FitScore

  /** Drive-time catchment. Absent on legacy radius-only rows. */
  catchments?: {
    badminton: Catchment
    /** @deprecated Legacy rows only (pre badminton-only). Never written; don't read. */
    pickleball?: Catchment
  }

  /** ISO timestamp the data was fetched. */
  fetchedAt: string
}
