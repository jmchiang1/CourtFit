/**
 * AI condition assessment of a property, used to make the renovation estimate
 * reflect the *actual* state of the space (a barebones shell trends toward a
 * full gut; a fitted-out space trends down) and to surface the NYC / Nassau
 * County code due-diligence checklist for an indoor sports facility.
 */

/** Building systems whose per-sqft renovation line item the condition scales. */
export type ConditionSystemKey =
  | 'hvac'
  | 'electrical'
  | 'lighting'
  | 'plumbing'
  | 'flooring'
  | 'walls'
  | 'office'
  | 'bathrooms'
  | 'fireSprinkler'

export type ConditionLevel = 'good' | 'fair' | 'poor' | 'absent'
export type RenovationScope = 'minimal' | 'moderate' | 'heavy' | 'full-gut'

export interface ConditionSystem {
  key: ConditionSystemKey
  /** Observed current state of the system. */
  condition: ConditionLevel
  /**
   * Cost multiplier vs the baseline per-sqft assumption: 0 = already adequate /
   * no work, 1 = a typical full fit-out, up to ~2 = worst-case (rip-out + assembly
   * upsizing). Clamped to 0–2 by the calculator.
   */
  multiplier: number
  /** What was observed in the photos / description that drove the call. */
  note: string
}

export type ComplianceStatus = 'ok' | 'attention' | 'unknown' | 'risk'

export interface ComplianceItem {
  key: string
  label: string
  status: ComplianceStatus
  detail: string
}

export interface ConditionAssessment {
  scope: RenovationScope
  summary: string
  confidence: 'low' | 'medium' | 'high'
  /** How many photos the assessment actually looked at. */
  imageCount: number
  systems: ConditionSystem[]
  compliance: ComplianceItem[]
  /** ISO timestamp the assessment was produced. */
  assessedAt: string
}
