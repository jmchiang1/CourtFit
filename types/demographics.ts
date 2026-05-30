export type FitLabel = 'Strong' | 'Moderate' | 'Weak'

export interface FitScore {
  /** 0–100. */
  score: number
  label: FitLabel
}

/**
 * Demographics of the trade area within `radiusMiles` of a property, aggregated
 * from the US Census ACS 5-year estimates over every census tract intersecting
 * the radius. Stored on the property as `demographics_json`.
 */
export interface Demographics {
  /** ACS 5-year vintage these figures come from, e.g. "2023". */
  vintage: string
  /** Trade-area radius the figures cover, in miles. */
  radiusMiles: number
  /** Number of census tracts aggregated. */
  tractCount: number

  totalPopulation: number
  households: number
  /** Mean household income across the radius (aggregate income / households). Null if unknown. */
  meanHouseholdIncome: number | null

  ethnicity: {
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

  age: {
    under18: number
    prime18to44: number
    mature45to64: number
    senior65plus: number
    /** prime18to44 / totalPopulation (0–1). */
    prime18to44Share: number
    /** (prime18to44 + mature45to64) / totalPopulation (0–1). */
    adult18to64Share: number
  }

  /** Demand signal for badminton (ethnicity-weighted). */
  badmintonFit: FitScore
  /** Demand signal for pickleball (broad-demographic). */
  pickleballFit: FitScore

  /** ISO timestamp the data was fetched. */
  fetchedAt: string
}
