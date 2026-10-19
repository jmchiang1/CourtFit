import type { Assumptions, StartupCostLineItem } from '@/types/analysis'
import type { ConditionAssessment, ConditionSystemKey } from '@/types/condition'

/**
 * Badminton facility model, mirroring the owner's cash-flow workbook. Revenue
 * and costs are built from per-court, per-square-foot and share-of-sales
 * drivers so any building size scales the same way. Figures are the
 * stabilized year (full booking ramp) unless noted.
 */

export function calculateCourts(warehouseSqft: number, a: Assumptions) {
  const usable = warehouseSqft * a.usableCourtAreaPct
  const badminton = a.courtSqft > 0 ? Math.floor(usable / a.courtSqft) : 0
  return { badminton, total: badminton }
}

/** Revenue at a given booking level (1 = stabilized, 0.65 ≈ year one). */
export function calculateRevenue(courts: number, a: Assumptions, ramp = 1) {
  const w = a.weeksPerYear
  const courtRental =
    courts *
    w *
    (a.peakHoursPerWeek * a.peakBookingPct * a.peakRate +
      a.offPeakHoursPerWeek * a.offPeakBookingPct * a.offPeakRate) *
    ramp

  const checkIns =
    courts * a.openPlayCourtSessionsPerCourtWeek * a.openPlayPlayersPerCourt * a.openPlayFillPct * w
  const pricePerCheckIn =
    a.dropInSharePct * a.dropInPrice +
    a.pass10SharePct * a.pass10PricePerCheckIn +
    a.pass20SharePct * a.pass20PricePerCheckIn
  const openPlay = checkIns * pricePerCheckIn * ramp

  const coaching =
    courts *
    w *
    (a.groupSessionsPerCourtWeek * a.studentsPerGroupSession * a.groupPricePerStudent +
      a.privateLessonHoursPerCourtWeek * a.privateLessonRate) *
    ramp

  // Pro shop and F&B run as a share of court revenue (private bookings + open play).
  const proShop = (courtRental + openPlay) * a.proShopPctOfCourtRevenue
  const foodBeverage = (courtRental + openPlay) * a.foodBeveragePctOfCourtRevenue

  const sales = courtRental + openPlay + coaching + proShop + foodBeverage
  const cardSurcharge = sales * a.cardSurchargePct
  const gross = sales + cardSurcharge

  return { courtRental, openPlay, coaching, proShop, foodBeverage, cardSurcharge, gross }
}

export function calculateCostOfSales(
  revenue: { proShop: number; foodBeverage: number },
  a: Assumptions,
) {
  const proShop = revenue.proShop * (1 - a.proShopMarginPct)
  const foodBeverage = revenue.foodBeverage * (1 - a.foodBeverageMarginPct)
  return { proShop, foodBeverage, total: proShop + foodBeverage }
}

export function calculateExpenses(input: {
  totalSqft: number
  courts: number
  /** Base rent from the listing; NNN is added on top from the assumptions. */
  rentPerSqftYr: number | null
  grossRevenue: number
  coachingRevenue: number
  assumptions: Assumptions
  marketingPerYr?: number
}) {
  const { totalSqft: sf, courts, rentPerSqftYr, grossRevenue, coachingRevenue, assumptions: a } = input
  const rent = rentPerSqftYr == null ? 0 : (rentPerSqftYr + a.nnnPerSqftYr) * sf
  const wages = a.ownerSalaryPerYr + a.staffWagesPerYr
  const payroll = wages * (1 + a.payrollTaxPct) + a.workersCompPerYr
  const coach = coachingRevenue * a.coachSharePct
  const utilities = sf * (a.electricityPerSqftYr + a.gasPerSqftYr + a.waterPerSqftYr + a.trashPerSqftYr)
  const repairs = sf * a.repairsPerSqftYr + grossRevenue * a.replacementReservePct
  const insurance = courts * a.liabilityInsurancePerCourtYr + sf * a.propertyInsurancePerSqftYr
  const admin = a.adminPerYr + courts * a.bookingSoftwarePerCourtYr
  const marketing = input.marketingPerYr ?? a.marketingPerYr
  const cardProcessing = grossRevenue * a.cardProcessingPct
  const contingency = grossRevenue * a.contingencyPct
  const total =
    rent + payroll + coach + utilities + repairs + insurance + admin + marketing + cardProcessing + contingency
  return {
    rent,
    payroll,
    coach,
    utilities,
    repairs,
    insurance,
    admin,
    marketing,
    cardProcessing,
    contingency,
    total,
  }
}

// How much of a typical conversion each building system accounts for, used to
// blend the AI condition assessment's per-system multipliers into one factor
// on the $/SF buildout figure. Relative weights only.
const SYSTEM_WEIGHTS: Record<ConditionSystemKey, number> = {
  hvac: 8,
  electrical: 5,
  lighting: 4,
  flooring: 5,
  fireSprinkler: 4,
  plumbing: 3,
  walls: 3,
  office: 2,
  bathrooms: 2,
}

const clampMult = (n: number) => Math.max(0, Math.min(2, n))

/** Weighted condition factor for the buildout (1 = typical conversion). */
export function conditionFactor(condition?: ConditionAssessment | null): number {
  if (!condition) return 1
  let weighted = 0
  let total = 0
  for (const [key, w] of Object.entries(SYSTEM_WEIGHTS) as [ConditionSystemKey, number][]) {
    const m = condition.systems.find((s) => s.key === key)?.multiplier ?? 1
    weighted += w * clampMult(m)
    total += w
  }
  return weighted / total
}

export function calculateStartupCost(input: {
  totalSqft: number
  courts: number
  annualRent: number
  annualOperatingExpenses: number
  a: Assumptions
  condition?: ConditionAssessment | null
}) {
  const { totalSqft: sf, courts, annualRent, annualOperatingExpenses, a, condition } = input
  const factor = conditionFactor(condition)
  const baseBuildout = sf * a.buildoutPerSqft
  const buildout = baseBuildout * factor

  const lines: StartupCostLineItem[] = [
    { label: 'Permits & architecture', amount: sf * a.permitsArchitecturePerSqft },
    condition
      ? {
          label: 'Buildout',
          amount: buildout,
          multiplier: factor,
          note: `Adjusted for the space's condition (${condition.scope.replace('-', ' ')})`,
        }
      : { label: 'Buildout', amount: buildout },
    { label: 'Court equipment', amount: courts * a.equipmentPerCourt },
    { label: 'Office & lounge furniture', amount: sf * a.furniturePerSqft },
    { label: 'Signage & wayfinding', amount: a.signage },
    { label: 'Pro shop opening inventory', amount: courts * a.proShopInventoryPerCourt },
    { label: 'Coolers & shelving', amount: a.coolersShelving },
    { label: 'F&B opening inventory', amount: a.foodBeverageInventory },
    { label: 'Legal (one-time)', amount: a.legalStartup },
    { label: 'Supplies & website', amount: a.suppliesWebsite },
    { label: 'Security deposit', amount: (annualRent / 12) * a.securityDepositMonths },
    {
      label: 'Working capital reserve',
      amount: (annualOperatingExpenses / 12) * a.workingCapitalMonths,
    },
  ]

  const mid = lines.reduce((sum, l) => sum + l.amount, 0)
  const baselineMid = mid - buildout + baseBuildout

  return {
    low: mid * 0.85,
    mid,
    high: mid * 1.3,
    baselineMid,
    conditionApplied: !!condition,
    breakdown: lines,
  }
}

export function calculatePaybackYears(startupMid: number, noi: number): number | null {
  if (noi <= 0) return null
  return startupMid / noi
}

import type { AnalysisInput, AnalysisResult } from '@/types/analysis'
import { rateAnalysis } from './rating'
import { generateRiskFlags } from './risk-flags'
import { generateFallbackSummary } from './summary-fallback'

/** Placeholder base rent used when the listing has no rent stated (the
 * workbook's average NYC base rent). The user is told this via the form hint +
 * the missing-rent risk flag. NNN is added on top from the assumptions. */
export const ESTIMATED_RENT_PER_SQFT_YR = 25

export function calculateAnalysis(input: AnalysisInput): AnalysisResult {
  const { listing, assumptions: a, condition } = input
  const totalSqft = listing.totalSqft ?? 0
  const warehouseSqft = listing.warehouseSqft ?? totalSqft
  const effectiveRent = listing.rentPerSqftYr ?? ESTIMATED_RENT_PER_SQFT_YR

  const courts = calculateCourts(warehouseSqft, a)

  const project = (ramp: number, marketingPerYr: number) => {
    const revenue = calculateRevenue(courts.total, a, ramp)
    const costOfSales = calculateCostOfSales(revenue, a)
    const expenses = calculateExpenses({
      totalSqft,
      courts: courts.total,
      rentPerSqftYr: effectiveRent,
      grossRevenue: revenue.gross,
      coachingRevenue: revenue.coaching,
      assumptions: a,
      marketingPerYr,
    })
    const noi = revenue.gross - costOfSales.total - expenses.total
    return { revenue, costOfSales, expenses, noi }
  }

  const { revenue, costOfSales, expenses, noi } = project(1, a.marketingPerYr)
  const y1 = project(a.yearOneBookingPct, a.yearOneMarketingPerYr)

  const noiMargin = revenue.gross > 0 ? noi / revenue.gross : 0
  const monthlyRent = expenses.rent / 12
  const monthlyRevenue = revenue.gross / 12
  const rentBurden = revenue.gross > 0 ? expenses.rent / revenue.gross : 0
  const revenuePerSqft = totalSqft > 0 ? revenue.gross / totalSqft : 0

  const startupCost = calculateStartupCost({
    totalSqft,
    courts: courts.total,
    annualRent: expenses.rent,
    annualOperatingExpenses: expenses.total,
    a,
    condition,
  })
  const paybackYears = totalSqft > 0 ? calculatePaybackYears(startupCost.mid, noi) : null

  const rating = rateAnalysis({
    totalSqft: listing.totalSqft,
    // We always have an effective rent (estimate if not stated), so pass it
    // along so the rating doesn't fall through to "Incomplete" just because
    // the user hasn't entered rent yet.
    rentPerSqftYr: effectiveRent,
    totalCourts: courts.total,
    noi,
    noiMargin,
    paybackYears,
  })

  const riskFlags = generateRiskFlags({ listing, totalCourts: courts.total, rentBurden })

  const summary = generateFallbackSummary({
    address: listing.address,
    rating,
    courts,
    grossRevenue: revenue.gross,
    noi,
    paybackYears,
    flags: riskFlags,
  })

  return {
    courts,
    revenue,
    costOfSales,
    expenses,
    yearOne: { revenue: y1.revenue.gross, noi: y1.noi },
    noi,
    noiMargin,
    monthlyRent,
    monthlyRevenue,
    rentBurden,
    revenuePerSqft,
    startupCost,
    paybackYears,
    rating,
    riskFlags,
    summary,
  }
}
