import type { FitLabel, FitScore } from '@/types/demographics'

/**
 * "Whitespace" = demand fit discounted by competitive saturation. A location can
 * have strong demographics but still be a poor bet if existing facilities already
 * serve that population — and vice-versa, a modest market with no competition can
 * be wide-open. These are pure functions with eyeball-able constants, mirroring
 * lib/fit-score.ts.
 *
 * Discount model: a market can support ~(reachable demand pool / PER_FACILITY_POP)
 * facilities. `saturation` = existing competitors / that capacity. We scale the
 * demand fit down as saturation climbs (0 competitors → full demand; oversupplied
 * → floored), so the result reads as "underserved demand for this sport here".
 */

// Population one facility comfortably serves (tunable). Badminton leans on the
// East+South Asian community; pickleball on the broad adult population.
const PER_FACILITY_BADMINTON_POP = 120_000
const PER_FACILITY_PICKLEBALL_POP = 300_000

function label(score: number): FitLabel {
  if (score >= 66) return 'Strong'
  if (score >= 40) return 'Moderate'
  return 'Weak'
}

/** 1.0 with no competition, falling toward a 0.35 floor as supply outpaces demand. */
function competitionFactor(pop: number, competitors: number, perFacilityPop: number): number {
  const capacity = Math.max(pop / perFacilityPop, 0.5)
  const saturation = competitors / capacity
  return Math.max(0.35, Math.min(1, 1 - 0.45 * saturation))
}

export interface WhitespaceSport extends FitScore {
  competitors: number
  /** The competition discount applied (1 = none). */
  factor: number
}

export interface WhitespaceResult {
  badminton: WhitespaceSport
  pickleball: WhitespaceSport
  /** Court-mix-weighted blend of the two. */
  overall: FitScore
}

export interface WhitespaceInputs {
  /** Demand fit scores (0–100) from the demographics. */
  badmintonFit: number
  pickleballFit: number
  /** Reachable demand pools. */
  targetPopulation: number
  adultPopulation: number
  /** Competing facilities within the trade area, by sport. */
  badmintonCompetitors: number
  pickleballCompetitors: number
  /** Court mix from the assumptions, used to blend the overall score. */
  badmintonMixPct: number
  pickleballMixPct: number
}

export function computeWhitespace(i: WhitespaceInputs): WhitespaceResult {
  const bFactor = competitionFactor(i.targetPopulation, i.badmintonCompetitors, PER_FACILITY_BADMINTON_POP)
  const pFactor = competitionFactor(i.adultPopulation, i.pickleballCompetitors, PER_FACILITY_PICKLEBALL_POP)
  const bScore = Math.round(i.badmintonFit * bFactor)
  const pScore = Math.round(i.pickleballFit * pFactor)

  const mixTotal = i.badmintonMixPct + i.pickleballMixPct || 1
  const overall = Math.round((bScore * i.badmintonMixPct + pScore * i.pickleballMixPct) / mixTotal)

  return {
    badminton: { score: bScore, label: label(bScore), competitors: i.badmintonCompetitors, factor: bFactor },
    pickleball: { score: pScore, label: label(pScore), competitors: i.pickleballCompetitors, factor: pFactor },
    overall: { score: overall, label: label(overall) },
  }
}
