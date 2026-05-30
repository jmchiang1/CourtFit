import type { FitScore, FitLabel } from '@/types/demographics'

/**
 * Demand fit scoring for a trade area. Pure functions — no I/O — so the weights
 * are easy to eyeball and tune. Every input share is 0–1; income is in dollars.
 *
 * Badminton skews heavily toward East + South Asian communities, so its score is
 * dominated by the target-Asian share. Pickleball is broad-demographic, so it
 * ignores ethnicity and leans on population, income, and adult age mix.
 */

export interface FitInputs {
  /** East+South Asian share of population, 0–1. */
  targetShare: number
  /** Mean household income in dollars, or null if unknown. */
  meanHouseholdIncome: number | null
  /** Share of population aged 18–44, 0–1. */
  prime18to44Share: number
  /** Share of population aged 18–64, 0–1. */
  adult18to64Share: number
  /** Total population within the radius. */
  totalPopulation: number
}

// --- tunable thresholds (a sub-score hits 1.0 at its "full marks" value) ---
const TARGET_SHARE_FULL = 0.2 // 20%+ East+South Asian = max ethnicity signal
const INCOME_FLOOR = 40_000 // below this contributes ~0
const INCOME_FULL = 130_000 // at/above this = max income signal
const PRIME_AGE_FULL = 0.45 // 45%+ of pop aged 18–44 = max
const ADULT_AGE_FULL = 0.62 // 62%+ of pop aged 18–64 = max
const POP_FULL = 150_000 // 5-mi-radius population for max density signal

// weights per sport (each set sums to 1)
const BADMINTON_WEIGHTS = { ethnicity: 0.55, age: 0.15, income: 0.15, population: 0.15 }
const PICKLEBALL_WEIGHTS = { population: 0.45, income: 0.3, age: 0.25 }

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

function incomeScore(income: number | null): number {
  if (income == null) return 0.5 // unknown → neutral, don't punish
  return clamp01((income - INCOME_FLOOR) / (INCOME_FULL - INCOME_FLOOR))
}

function label(score: number): FitLabel {
  if (score >= 66) return 'Strong'
  if (score >= 40) return 'Moderate'
  return 'Weak'
}

function toFit(fraction: number): FitScore {
  const score = Math.round(clamp01(fraction) * 100)
  return { score, label: label(score) }
}

export function badmintonFit(i: FitInputs): FitScore {
  const w = BADMINTON_WEIGHTS
  const fraction =
    w.ethnicity * clamp01(i.targetShare / TARGET_SHARE_FULL) +
    w.age * clamp01(i.prime18to44Share / PRIME_AGE_FULL) +
    w.income * incomeScore(i.meanHouseholdIncome) +
    w.population * clamp01(i.totalPopulation / POP_FULL)
  return toFit(fraction)
}

export function pickleballFit(i: FitInputs): FitScore {
  const w = PICKLEBALL_WEIGHTS
  const fraction =
    w.population * clamp01(i.totalPopulation / POP_FULL) +
    w.income * incomeScore(i.meanHouseholdIncome) +
    w.age * clamp01(i.adult18to64Share / ADULT_AGE_FULL)
  return toFit(fraction)
}
