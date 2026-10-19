import type { FitLabel, FitScore } from '@/types/demographics'

/**
 * "Whitespace" = badminton demand fit discounted by competitive saturation. A
 * location can have strong demographics but still be a poor bet if existing
 * badminton facilities already serve that population — and vice-versa, a modest
 * market with no competition can be wide-open. Pure functions with eyeball-able
 * constants, mirroring lib/fit-score.ts.
 *
 * Discount model: a market can support ~(reachable demand pool / PER_FACILITY_POP)
 * facilities. `saturation` = existing competitors / that capacity. We scale the
 * demand fit down as saturation climbs (0 competitors → full demand; oversupplied
 * → floored), so the result reads as "underserved badminton demand here".
 */

// East+South Asian population one badminton facility comfortably serves (tunable).
const PER_FACILITY_POP = 120_000

function label(score: number): FitLabel {
  if (score >= 66) return 'Strong'
  if (score >= 40) return 'Moderate'
  return 'Weak'
}

/** 1.0 with no competition, falling toward a 0.35 floor as supply outpaces demand. */
function competitionFactor(pop: number, competitors: number): number {
  const capacity = Math.max(pop / PER_FACILITY_POP, 0.5)
  const saturation = competitors / capacity
  return Math.max(0.35, Math.min(1, 1 - 0.45 * saturation))
}

export interface WhitespaceResult extends FitScore {
  /** Competing badminton facilities counted. */
  competitors: number
  /** The competition discount applied (1 = none). */
  factor: number
}

export interface WhitespaceInputs {
  /** Badminton demand fit score (0–100) from the demographics. */
  badmintonFit: number
  /** Reachable demand pool (East+South Asian population in the trade area). */
  targetPopulation: number
  /** Competing badminton facilities within the trade area. */
  competitors: number
}

export function computeWhitespace(i: WhitespaceInputs): WhitespaceResult {
  const factor = competitionFactor(i.targetPopulation, i.competitors)
  const score = Math.round(i.badmintonFit * factor)
  return { score, label: label(score), competitors: i.competitors, factor }
}
