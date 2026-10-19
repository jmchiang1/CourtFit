import type { Assumptions, ExtractedListing } from '@/types/analysis'

/**
 * Defaults from the owner's cash-flow workbook (V15_Cash_Flow_Projections:
 * 8,000 SF, 5 badminton courts, New Hyde Park). Workbook 5-court totals are
 * divided by 5 where the model needs a per-court figure.
 */
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  modelVersion: 2,

  usableCourtAreaPct: 0.8,
  courtSqft: 1_200,

  peakRate: 70,
  offPeakRate: 50,
  peakHoursPerWeek: 62,
  offPeakHoursPerWeek: 50,
  peakBookingPct: 0.5,
  offPeakBookingPct: 0.2,
  weeksPerYear: 52,

  openPlayCourtSessionsPerCourtWeek: 7.2, // 18 sessions × 2 courts ÷ 5 courts
  openPlayPlayersPerCourt: 6,
  openPlayFillPct: 0.5,
  dropInPrice: 22,
  pass10PricePerCheckIn: 20,
  pass20PricePerCheckIn: 15,
  dropInSharePct: 0.7,
  pass10SharePct: 0.2,
  pass20SharePct: 0.1,

  groupSessionsPerCourtWeek: 0.8, // 4 a week ÷ 5 courts
  studentsPerGroupSession: 5,
  groupPricePerStudent: 25,
  privateLessonHoursPerCourtWeek: 0.8, // 4 a week ÷ 5 courts
  privateLessonRate: 100,
  coachSharePct: 0.6,

  proShopPctOfCourtRevenue: 0.03,
  proShopMarginPct: 0.3,
  foodBeveragePctOfCourtRevenue: 0.03,
  foodBeverageMarginPct: 0.5,
  cardSurchargePct: 0.03,

  ownerSalaryPerYr: 50_000,
  staffWagesPerYr: 0,
  payrollTaxPct: 0.087,
  workersCompPerYr: 1_500,

  nnnPerSqftYr: 10,
  electricityPerSqftYr: 3,
  gasPerSqftYr: 0.6,
  waterPerSqftYr: 0.15,
  trashPerSqftYr: 0.21,
  repairsPerSqftYr: 1.1,
  replacementReservePct: 0.005,
  liabilityInsurancePerCourtYr: 1_300,
  propertyInsurancePerSqftYr: 0.45,

  adminPerYr: 11_837,
  bookingSoftwarePerCourtYr: 1_728, // $8,640 ÷ 5 courts
  marketingPerYr: 6_000,
  cardProcessingPct: 0.03,
  contingencyPct: 0.01,

  yearOneBookingPct: 0.65, // average of the 35% → 86% monthly ramp
  yearOneMarketingPerYr: 30_000,

  permitsArchitecturePerSqft: 8.75, // $70,000 ÷ 8,000 SF
  buildoutPerSqft: 60,
  equipmentPerCourt: 6_000,
  furniturePerSqft: 1,
  signage: 5_000,
  proShopInventoryPerCourt: 1_000,
  coolersShelving: 5_000,
  foodBeverageInventory: 1_500,
  legalStartup: 15_000,
  suppliesWebsite: 1_000,
  securityDepositMonths: 3,
  workingCapitalMonths: 8, // the workbook's $320K reserve ≈ 8 months of operating expenses
}

/**
 * Merge a property's saved assumptions over the defaults. Assumptions saved
 * under an older model (no matching `modelVersion`) describe different inputs
 * — e.g. the old badminton + pickleball mix — so they're dropped.
 */
export function resolveAssumptions(saved: unknown): Assumptions {
  if (
    saved &&
    typeof saved === 'object' &&
    (saved as Partial<Assumptions>).modelVersion === DEFAULT_ASSUMPTIONS.modelVersion
  ) {
    return { ...DEFAULT_ASSUMPTIONS, ...(saved as Partial<Assumptions>) }
  }
  return DEFAULT_ASSUMPTIONS
}

export const EMPTY_LISTING: ExtractedListing = {
  address: null,
  totalSqft: null,
  warehouseSqft: null,
  officeSqft: null,
  clearHeight: null,
  rentPerSqftYr: null,
  zoning: null,
  loading: null,
  parking: null,
  locationNotes: [],
  sourceUrl: null,
  imageUrls: [],
}
