import type { ConditionAssessment, RenovationScope } from '@/types/condition'

/**
 * Weighted ranking of candidate properties. Each dimension is min–max normalized
 * *within the current set* (so the leaderboard answers "best among my candidates"),
 * then blended by user-tunable weights into a 0–100 composite. Pure functions —
 * the weights live in the UI.
 */

export type RankDimension =
  | 'whitespace'
  | 'profitability'
  | 'payback'
  | 'capacity'
  | 'readiness'
  | 'coderisk'

export type RankWeights = Record<RankDimension, number>

export const DIMENSION_LABEL: Record<RankDimension, string> = {
  whitespace: 'Whitespace',
  profitability: 'Profitability',
  payback: 'Payback speed',
  capacity: 'Court capacity',
  readiness: 'Build readiness',
  coderisk: 'Code safety',
}

export const DEFAULT_WEIGHTS: RankWeights = {
  whitespace: 30,
  profitability: 20,
  payback: 20,
  capacity: 10,
  readiness: 10,
  coderisk: 10,
}

const SCOPE_READINESS: Record<RenovationScope, number> = {
  minimal: 100,
  moderate: 70,
  heavy: 45,
  'full-gut': 20,
}

/** Build-readiness (0–100) from the condition scope; null when not assessed. */
export function readinessFromCondition(condition: ConditionAssessment | null): number | null {
  return condition ? SCOPE_READINESS[condition.scope] : null
}

/** Code safety (0–100): start at 100, dock for each risk / attention item. */
export function codeSafetyFromCondition(condition: ConditionAssessment | null): number | null {
  if (!condition) return null
  let s = 100
  for (const item of condition.compliance) {
    if (item.status === 'risk') s -= 30
    else if (item.status === 'attention') s -= 10
  }
  return Math.max(0, Math.min(100, s))
}

export interface CandidateMetrics {
  id: string
  label: string
  /** Demand net of competition (0–100); null when not yet assessable. */
  whitespace: number | null
  /** Annual NOI in dollars (higher better). */
  noi: number
  /** Payback in years (lower better); null = unprofitable / no payback. */
  paybackYears: number | null
  /** Total courts (higher better). */
  courts: number
  /** Build readiness 0–100 (higher better); null when not assessed. */
  readiness: number | null
  /** Code safety 0–100 (higher better); null when not assessed. */
  coderisk: number | null
}

export interface RankedCandidate extends CandidateMetrics {
  /** 0–100 weighted composite. */
  score: number
  /** Per-dimension normalized 0–100 (for the breakdown bars). */
  normalized: Record<RankDimension, number>
  rank: number
}

/** Min–max normalize to 0–100; degenerate sets (all equal / empty) → 50. */
function normalize(values: number[]): (v: number) => number {
  const finite = values.filter((v) => Number.isFinite(v))
  if (finite.length === 0) return () => 50
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  if (max === min) return () => 50
  return (v) => ((v - min) / (max - min)) * 100
}

export function rankCandidates(items: CandidateMetrics[], weights: RankWeights): RankedCandidate[] {
  if (items.length === 0) return []

  // Build per-dimension normalizers. Nulls are treated as the worst case for
  // payback (unprofitable) and neutral (50) for not-yet-assessed signals.
  const normWhitespace = normalize(items.map((i) => i.whitespace ?? 50))
  const normNoi = normalize(items.map((i) => i.noi))
  const normCourts = normalize(items.map((i) => i.courts))
  // Payback: lower is better → normalize then invert; null = no payback = worst.
  const paybackVals = items.map((i) => i.paybackYears)
  const finitePayback = paybackVals.filter((v): v is number => v != null && Number.isFinite(v))
  const worstPayback = finitePayback.length ? Math.max(...finitePayback) : 0
  const normPaybackRaw = normalize(items.map((i) => i.paybackYears ?? worstPayback + 1))

  const ranked = items.map((i): Omit<RankedCandidate, 'rank'> => {
    const normalized: Record<RankDimension, number> = {
      whitespace: normWhitespace(i.whitespace ?? 50),
      profitability: normNoi(i.noi),
      payback: 100 - normPaybackRaw(i.paybackYears ?? worstPayback + 1),
      capacity: normCourts(i.courts),
      readiness: i.readiness ?? 50,
      coderisk: i.coderisk ?? 50,
    }
    const totalWeight =
      weights.whitespace + weights.profitability + weights.payback +
      weights.capacity + weights.readiness + weights.coderisk || 1
    const score =
      (normalized.whitespace * weights.whitespace +
        normalized.profitability * weights.profitability +
        normalized.payback * weights.payback +
        normalized.capacity * weights.capacity +
        normalized.readiness * weights.readiness +
        normalized.coderisk * weights.coderisk) /
      totalWeight
    return { ...i, normalized, score: Math.round(score) }
  })

  ranked.sort((a, b) => b.score - a.score)
  return ranked.map((r, idx) => ({ ...r, rank: idx + 1 }))
}
