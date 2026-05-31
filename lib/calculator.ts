import type { Assumptions, StartupCostLineItem } from '@/types/analysis'
import type { ConditionAssessment, ConditionSystemKey } from '@/types/condition'

export function calculateCourts(warehouseSqft: number, a: Assumptions) {
  const usable = warehouseSqft * a.usableCourtAreaPct
  const badmintonArea = usable * a.badmintonMixPct
  const pickleballArea = usable * a.pickleballMixPct
  const badminton = Math.floor(badmintonArea / a.badmintonCourtSqft)
  const pickleball = Math.floor(pickleballArea / a.pickleballCourtSqft)
  return { badminton, pickleball, total: badminton + pickleball }
}

export function calculateRevenue(
  courts: { badminton: number; pickleball: number; total: number },
  a: Assumptions,
) {
  const badminton =
    courts.badminton * a.badmintonHourlyRate * a.badmintonReservedHoursPerWeek * a.weeksPerYear
  const pickleball =
    courts.pickleball * a.pickleballHourlyRate * a.pickleballReservedHoursPerWeek * a.weeksPerYear
  const courtRevenue = badminton + pickleball
  const other = courtRevenue * a.otherRevenuePct
  const gross = courtRevenue + other
  return { badminton, pickleball, other, gross }
}

export function calculateExpenses(input: {
  totalSqft: number
  rentPerSqftYr: number | null
  grossRevenue: number
  assumptions: Assumptions
}) {
  const { totalSqft, rentPerSqftYr, grossRevenue, assumptions: a } = input
  const rent = (rentPerSqftYr ?? 0) * totalSqft
  const payroll = a.payrollHourlyRate * a.payrollHoursPerWeek * a.weeksPerYear * a.payrollBurden
  const utilities = totalSqft * a.utilitiesPerSqftYr
  const insurance = totalSqft * a.insurancePerSqftYr
  const maintenance = totalSqft * a.maintenancePerSqftYr
  const royalty = grossRevenue * a.royaltyPct
  const marketing = grossRevenue * a.marketingPct
  const miscAdmin = grossRevenue * a.miscAdminPct
  const total = rent + payroll + utilities + insurance + maintenance + royalty + marketing + miscAdmin
  return { rent, payroll, utilities, insurance, maintenance, royalty, marketing, miscAdmin, total }
}

// Fire / life-safety (sprinklers, alarm, egress, ADA) for assembly occupancy
// (NYC BC Group A-3). Only priced when a condition assessment is present, since
// the original flat baseline didn't carry a dedicated line for it.
const FIRE_LIFE_SAFETY_PER_SQFT = 4

const clampMult = (n: number) => Math.max(0, Math.min(2, n))

export function calculateStartupCost(input: {
  totalSqft: number
  warehouseSqft: number
  officeSqft: number
  totalCourts: number
  a: Assumptions
  condition?: ConditionAssessment | null
}) {
  const { totalSqft, warehouseSqft, officeSqft, totalCourts, a, condition } = input

  // Per-system condition multiplier (1 = baseline when not assessed / absent).
  const sys = (key: ConditionSystemKey) => condition?.systems.find((s) => s.key === key) ?? null
  const mult = (key: ConditionSystemKey) => (condition ? clampMult(sys(key)?.multiplier ?? 1) : 1)
  const note = (key: ConditionSystemKey) => sys(key)?.note || undefined

  // Baseline (un-scaled) amounts — also the reference total shown in the UI.
  const base = {
    hvac: totalSqft * a.renovationHvacPerSqft,
    electrical: totalSqft * a.renovationElectricalPerSqft,
    courtLighting: warehouseSqft * a.renovationCourtLightingPerSqft,
    plumbing: totalSqft * a.renovationPlumbingPerSqft,
    courtFlooring: warehouseSqft * a.renovationCourtFlooringPerSqft,
    walls: totalSqft * a.renovationWallsPerSqft,
    officeBuildout: officeSqft * a.renovationOfficeBuildoutPerSqft,
    bathrooms: a.renovationBathroomCost * a.renovationBathroomCount,
    courtEquipment: totalCourts * a.renovationCourtEquipmentPerCourt,
  }

  const baselineSubtotal =
    base.hvac + base.electrical + base.courtLighting + base.plumbing + base.courtFlooring +
    base.walls + base.officeBuildout + base.bathrooms + base.courtEquipment
  const baselineMid =
    baselineSubtotal * (1 + a.renovationPermitsDesignPct + a.renovationContingencyPct) + a.franchiseFee

  // Condition-scaled amounts. Court equipment is new regardless, so unscaled.
  const hvac = base.hvac * mult('hvac')
  const electrical = base.electrical * mult('electrical')
  const courtLighting = base.courtLighting * mult('lighting')
  const plumbing = base.plumbing * mult('plumbing')
  const courtFlooring = base.courtFlooring * mult('flooring')
  const walls = base.walls * mult('walls')
  const officeBuildout = base.officeBuildout * mult('office')
  const bathrooms = base.bathrooms * mult('bathrooms')
  const courtEquipment = base.courtEquipment
  const fireLifeSafety = condition ? totalSqft * FIRE_LIFE_SAFETY_PER_SQFT * mult('fireSprinkler') : 0

  const subtotal =
    hvac + electrical + courtLighting + plumbing + courtFlooring +
    walls + officeBuildout + bathrooms + courtEquipment + fireLifeSafety

  const permitsDesign = subtotal * a.renovationPermitsDesignPct
  const contingency = subtotal * a.renovationContingencyPct

  const mid = subtotal + permitsDesign + contingency + a.franchiseFee

  const line = (label: string, amount: number, key?: ConditionSystemKey): StartupCostLineItem =>
    key && condition
      ? { label, amount, multiplier: mult(key), note: note(key) }
      : { label, amount }

  const breakdown: StartupCostLineItem[] = [
    line('HVAC', hvac, 'hvac'),
    line('Electrical', electrical, 'electrical'),
    line('Court lighting', courtLighting, 'lighting'),
    line('Plumbing', plumbing, 'plumbing'),
    line('Court flooring', courtFlooring, 'flooring'),
    line('Walls & finishes', walls, 'walls'),
    line('Office buildout', officeBuildout, 'office'),
    line('Bathrooms', bathrooms, 'bathrooms'),
    ...(condition ? [line('Fire & life-safety (assembly)', fireLifeSafety, 'fireSprinkler')] : []),
    line('Court equipment', courtEquipment),
    line('Permits & design', permitsDesign),
    line('Contingency', contingency),
    line('Franchise fee', a.franchiseFee),
  ]

  return {
    low: mid * 0.85,
    mid,
    high: mid * 1.30,
    baselineMid,
    conditionApplied: !!condition,
    breakdown,
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

/** Placeholder rent used when the listing has no rent stated. The user is
 * told this via the form hint + the missing-rent risk flag. */
export const ESTIMATED_RENT_PER_SQFT_YR = 24

export function calculateAnalysis(input: AnalysisInput): AnalysisResult {
  const { listing, assumptions, condition } = input
  const totalSqft = listing.totalSqft ?? 0
  const warehouseSqft = listing.warehouseSqft ?? totalSqft
  const effectiveRent = listing.rentPerSqftYr ?? ESTIMATED_RENT_PER_SQFT_YR

  const courts = calculateCourts(warehouseSqft, assumptions)
  const revenue = calculateRevenue(courts, assumptions)
  const expenses = calculateExpenses({
    totalSqft,
    rentPerSqftYr: effectiveRent,
    grossRevenue: revenue.gross,
    assumptions,
  })

  const noi = revenue.gross - expenses.total
  const noiMargin = revenue.gross > 0 ? noi / revenue.gross : 0
  const monthlyRent = expenses.rent / 12
  const monthlyRevenue = revenue.gross / 12
  const rentBurden = revenue.gross > 0 ? expenses.rent / revenue.gross : 0
  const revenuePerSqft = totalSqft > 0 ? revenue.gross / totalSqft : 0

  const officeSqft = listing.officeSqft ?? 0
  const startupCost = calculateStartupCost({
    totalSqft,
    warehouseSqft,
    officeSqft,
    totalCourts: courts.total,
    a: assumptions,
    condition,
  })
  const paybackYears = calculatePaybackYears(startupCost.mid, noi)

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
    expenses,
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
