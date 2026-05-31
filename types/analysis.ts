import type { ConditionAssessment } from '@/types/condition'

export interface ExtractedListing {
  address: string | null
  totalSqft: number | null
  warehouseSqft: number | null
  officeSqft: number | null
  clearHeight: number | null
  rentPerSqftYr: number | null
  zoning: string | null
  loading: string | null
  parking: string | null
  locationNotes: string[]
  /** Source listing URL (e.g. LoopNet/Crexi page). */
  sourceUrl: string | null
  /** Image URLs scraped from the listing page (typically via bookmarklet). */
  imageUrls: string[]
}

export interface Assumptions {
  badmintonCourtSqft: number
  pickleballCourtSqft: number
  usableCourtAreaPct: number
  badmintonMixPct: number
  pickleballMixPct: number
  badmintonHourlyRate: number
  pickleballHourlyRate: number
  badmintonReservedHoursPerWeek: number
  pickleballReservedHoursPerWeek: number
  weeksPerYear: number
  otherRevenuePct: number
  payrollHourlyRate: number
  payrollHoursPerWeek: number
  payrollBurden: number
  utilitiesPerSqftYr: number
  insurancePerSqftYr: number
  maintenancePerSqftYr: number
  royaltyPct: number
  marketingPct: number
  miscAdminPct: number

  // Renovation line items
  renovationHvacPerSqft: number
  renovationElectricalPerSqft: number
  renovationCourtLightingPerSqft: number   // applied to warehouseSqft
  renovationPlumbingPerSqft: number
  renovationCourtFlooringPerSqft: number   // applied to warehouseSqft
  renovationWallsPerSqft: number
  renovationOfficeBuildoutPerSqft: number  // applied to officeSqft
  renovationBathroomCost: number           // per bathroom
  renovationBathroomCount: number          // # of bathrooms
  renovationCourtEquipmentPerCourt: number // nets, posts, etc.
  renovationPermitsDesignPct: number       // % of subtotal
  renovationContingencyPct: number         // % of subtotal
  franchiseFee: number
}

export interface StartupCostLineItem {
  label: string
  amount: number
  /** Condition multiplier applied to the baseline (present only when assessed). */
  multiplier?: number
  /** What the condition assessment observed for this line. */
  note?: string
}

export interface AnalysisInput {
  listing: ExtractedListing
  assumptions: Assumptions
  /** Optional AI condition assessment; when present it scales the renovation. */
  condition?: ConditionAssessment | null
}

export type Rating =
  | 'Strong Candidate'
  | 'Worth Investigating'
  | 'Risky'
  | 'Do Not Pursue'
  | 'Incomplete'

export type RiskFlagId =
  | 'low-clear-height'
  | 'missing-rent'
  | 'too-few-courts'
  | 'high-rent-burden'
  | 'office-space'
  | 'zoning'

export interface RiskFlag {
  id: RiskFlagId
  severity: 'high' | 'medium' | 'low'
  title: string
  detail: string
}

export interface AnalysisResult {
  courts: { badminton: number; pickleball: number; total: number }
  revenue: { badminton: number; pickleball: number; other: number; gross: number }
  expenses: {
    rent: number
    payroll: number
    utilities: number
    insurance: number
    maintenance: number
    royalty: number
    marketing: number
    miscAdmin: number
    total: number
  }
  noi: number
  noiMargin: number
  monthlyRent: number
  monthlyRevenue: number
  rentBurden: number
  revenuePerSqft: number
  startupCost: {
    low: number
    mid: number
    high: number
    /** Flat baseline mid (no condition scaling) — shown as a reference. */
    baselineMid: number
    /** True when a condition assessment scaled this estimate. */
    conditionApplied: boolean
    breakdown: StartupCostLineItem[]
  }
  paybackYears: number | null
  rating: Rating
  riskFlags: RiskFlag[]
  summary: string
}
