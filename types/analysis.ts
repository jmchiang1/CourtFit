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

/**
 * Operating model inputs, taken from the owner's cash-flow workbook
 * (V15_Cash_Flow_Projections, an 8,000 SF / 5-court badminton club). Every
 * figure is expressed per square foot, per court, as a share of sales, or as a
 * fixed amount, so the model scales to any building size.
 *
 * Per-court figures for open play, coaching and booking software are the
 * workbook's 5-court totals divided by 5.
 */
export interface Assumptions {
  /** Bumped when the model changes; saved assumptions from older models are ignored. */
  modelVersion: 2

  // Facility
  usableCourtAreaPct: number        // share of warehouse floor that can hold courts
  courtSqft: number                 // one court incl. buffer (24 × 50 ft)

  // Private court bookings (open 8 AM to midnight, 7 days)
  peakRate: number                  // $/hr, weekday evenings + weekends
  offPeakRate: number               // $/hr, weekday daytime
  peakHoursPerWeek: number          // per court
  offPeakHoursPerWeek: number       // per court
  peakBookingPct: number            // at stabilization
  offPeakBookingPct: number         // at stabilization
  weeksPerYear: number

  // Open play (sold per person per session)
  openPlayCourtSessionsPerCourtWeek: number
  openPlayPlayersPerCourt: number
  openPlayFillPct: number
  dropInPrice: number               // $/session
  pass10PricePerCheckIn: number
  pass20PricePerCheckIn: number
  dropInSharePct: number
  pass10SharePct: number
  pass20SharePct: number

  // Coaching
  groupSessionsPerCourtWeek: number
  studentsPerGroupSession: number
  groupPricePerStudent: number
  privateLessonHoursPerCourtWeek: number
  privateLessonRate: number
  coachSharePct: number             // coach's cut of coaching revenue

  // Pro shop, food & beverage, card surcharge
  proShopPctOfCourtRevenue: number
  proShopMarginPct: number
  foodBeveragePctOfCourtRevenue: number
  foodBeverageMarginPct: number
  cardSurchargePct: number          // passed to customers

  // Staff
  ownerSalaryPerYr: number
  staffWagesPerYr: number
  payrollTaxPct: number
  workersCompPerYr: number

  // Running the building
  nnnPerSqftYr: number              // added on top of the listing's base rent
  electricityPerSqftYr: number
  gasPerSqftYr: number
  waterPerSqftYr: number
  trashPerSqftYr: number
  repairsPerSqftYr: number
  replacementReservePct: number     // of sales
  liabilityInsurancePerCourtYr: number
  propertyInsurancePerSqftYr: number

  // Administration, marketing, fees
  adminPerYr: number                // bookkeeping, CPA, legal, licenses, phone, internet, supplies, bank
  bookingSoftwarePerCourtYr: number
  marketingPerYr: number            // stabilized (year 3) level
  cardProcessingPct: number         // of sales
  contingencyPct: number            // of sales

  // Ramp-up (year 1)
  yearOneBookingPct: number         // average of the monthly ramp, as a share of stabilized
  yearOneMarketingPerYr: number

  // What it costs to open
  permitsArchitecturePerSqft: number
  buildoutPerSqft: number
  equipmentPerCourt: number
  furniturePerSqft: number
  signage: number
  proShopInventoryPerCourt: number
  coolersShelving: number
  foodBeverageInventory: number
  legalStartup: number
  suppliesWebsite: number
  securityDepositMonths: number     // months of rent
  workingCapitalMonths: number      // months of operating expenses held in reserve
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
  courts: { badminton: number; total: number }
  /** Stabilized year (full ramp, year 3 onward). */
  revenue: {
    courtRental: number
    openPlay: number
    coaching: number
    proShop: number
    foodBeverage: number
    cardSurcharge: number
    gross: number
  }
  costOfSales: { proShop: number; foodBeverage: number; total: number }
  expenses: {
    rent: number
    payroll: number
    coach: number
    utilities: number
    repairs: number
    insurance: number
    admin: number
    marketing: number
    cardProcessing: number
    contingency: number
    total: number
  }
  /** Year one at the ramp-up booking level. */
  yearOne: { revenue: number; noi: number }
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
