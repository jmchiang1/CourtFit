import { describe, it, expect } from 'vitest'
import {
  calculateAnalysis,
  calculateCourts,
  calculateRevenue,
  calculatePaybackYears,
  conditionFactor,
} from '../calculator'
import { DEFAULT_ASSUMPTIONS, EMPTY_LISTING, resolveAssumptions } from '../constants'
import type { ConditionAssessment } from '@/types/condition'

// The reference facility from the owner's workbook (V15_Cash_Flow_Projections):
// 8,000 SF in New Hyde Park at $25 base + $10 NNN, five courts. Expected figures
// are the workbook's Year 3 (stabilized) column.
const WORKBOOK_LISTING = {
  ...EMPTY_LISTING,
  address: 'New Hyde Park reference site',
  totalSqft: 8_000,
  warehouseSqft: 8_000,
  clearHeight: 28,
  rentPerSqftYr: 25,
}

describe('calculateCourts', () => {
  it('fits 5 courts in 8,000 SF (80% usable ÷ 1,200 SF per court)', () => {
    expect(calculateCourts(8_000, DEFAULT_ASSUMPTIONS)).toEqual({ badminton: 5, total: 5 })
  })

  it('rounds down partial courts', () => {
    // 16,000 × 0.8 = 12,800 ÷ 1,200 = 10.67
    expect(calculateCourts(16_000, DEFAULT_ASSUMPTIONS).total).toBe(10)
  })

  it('returns zero for an empty floor', () => {
    expect(calculateCourts(0, DEFAULT_ASSUMPTIONS)).toEqual({ badminton: 0, total: 0 })
  })
})

describe('calculateRevenue (workbook year 3)', () => {
  const r = calculateRevenue(5, DEFAULT_ASSUMPTIONS)

  it('matches each revenue line', () => {
    expect(r.courtRental).toBeCloseTo(694_200, 0)
    expect(r.openPlay).toBeCloseTo(30_888 + 86_486, -1) // passes + drop-ins
    expect(r.coaching).toBeCloseTo(46_800, 0)
    expect(r.proShop).toBeCloseTo(24_347, 0)
    expect(r.foodBeverage).toBeCloseTo(24_347, 0)
    expect(r.cardSurcharge).toBeCloseTo(27_212, 0)
    expect(r.gross).toBeCloseTo(934_281, 0)
  })

  it('scales every line with the booking ramp', () => {
    const half = calculateRevenue(5, DEFAULT_ASSUMPTIONS, 0.5)
    expect(half.gross).toBeCloseTo(r.gross / 2, 6)
  })
})

describe('calculateAnalysis against the workbook', () => {
  const result = calculateAnalysis({ listing: WORKBOOK_LISTING, assumptions: DEFAULT_ASSUMPTIONS })

  it('matches cost of sales and operating expenses', () => {
    expect(result.costOfSales.total).toBeCloseTo(17_043 + 12_174, -1)
    expect(result.expenses.rent).toBe(280_000)
    expect(result.expenses.coach).toBeCloseTo(28_080, 0)
    expect(result.expenses.utilities).toBeCloseTo(24_000 + 4_800 + 1_200 + 1_680, 0)
    expect(result.expenses.repairs).toBeCloseTo(8_800 + 4_671, 0)
    expect(result.expenses.insurance).toBeCloseTo(6_500 + 3_600, 0)
    expect(result.expenses.admin).toBeCloseTo(11_837 + 8_640, 0)
    expect(result.expenses.marketing).toBe(6_000)
    expect(result.expenses.cardProcessing).toBeCloseTo(28_028, 0)
    expect(result.expenses.contingency).toBeCloseTo(9_343, 0)
  })

  it('lands within the 3% salary escalation of the workbook year-3 income before debt service', () => {
    // Workbook Y3: gross profit $905,064 − opex excl. SBA ($587,255 − $100,916)
    // = $418,725. The model holds salary at year-one dollars ($3,310 lower).
    expect(result.noi).toBeCloseTo(418_725 + 3_310, -2)
  })

  it('matches the total cost to open (~$1.01M)', () => {
    expect(result.startupCost.mid).toBeGreaterThan(1_005_000)
    expect(result.startupCost.mid).toBeLessThan(1_015_000)
    const line = (l: string) => result.startupCost.breakdown.find((b) => b.label === l)?.amount
    expect(line('Buildout')).toBe(480_000)
    expect(line('Permits & architecture')).toBe(70_000)
    expect(line('Court equipment')).toBe(30_000)
    expect(line('Security deposit')).toBe(70_000)
  })

  it('pays back in about 2.4 years and rates as a strong candidate', () => {
    expect(result.paybackYears).toBeCloseTo(2.4, 1)
    expect(result.rating).toBe('Strong Candidate')
  })

  it('projects a thinner year one at the 65% ramp with launch marketing', () => {
    expect(result.yearOne.revenue).toBeCloseTo(result.revenue.gross * 0.65, 0)
    expect(result.yearOne.noi).toBeLessThan(result.noi)
  })
})

describe('scaling to other buildings', () => {
  it('doubles per-court and per-SF lines for a building twice the size', () => {
    const small = calculateAnalysis({ listing: WORKBOOK_LISTING, assumptions: DEFAULT_ASSUMPTIONS })
    const big = calculateAnalysis({
      listing: { ...WORKBOOK_LISTING, totalSqft: 16_000, warehouseSqft: 16_000 },
      assumptions: DEFAULT_ASSUMPTIONS,
    })
    expect(big.courts.total).toBe(10)
    expect(big.revenue.gross).toBeCloseTo(small.revenue.gross * 2, 0)
    expect(big.expenses.rent).toBe(small.expenses.rent * 2)
    expect(big.expenses.utilities).toBeCloseTo(small.expenses.utilities * 2, 6)
    // Owner salary and admin stay fixed, so margin improves with size.
    expect(big.expenses.payroll).toBe(small.expenses.payroll)
    expect(big.noiMargin).toBeGreaterThan(small.noiMargin)
  })

  it('uses the estimated base rent when the listing has none', () => {
    const r = calculateAnalysis({
      listing: { ...WORKBOOK_LISTING, rentPerSqftYr: null },
      assumptions: DEFAULT_ASSUMPTIONS,
    })
    expect(r.expenses.rent).toBe(280_000) // $25 estimate + $10 NNN
  })

  it('returns zero revenue and no payback for an empty listing', () => {
    const r = calculateAnalysis({ listing: EMPTY_LISTING, assumptions: DEFAULT_ASSUMPTIONS })
    expect(r.revenue.gross).toBe(0)
    expect(r.paybackYears).toBeNull()
    expect(r.rating).toBe('Incomplete')
  })
})

describe('condition-adjusted buildout', () => {
  const systems = (multiplier: number): ConditionAssessment => ({
    scope: 'heavy',
    summary: '',
    confidence: 'medium',
    imageCount: 3,
    systems: (
      ['hvac', 'electrical', 'lighting', 'plumbing', 'flooring', 'walls', 'office', 'bathrooms', 'fireSprinkler'] as const
    ).map((key) => ({ key, condition: 'poor', multiplier, note: '' })),
    compliance: [],
    assessedAt: '2026-10-19T00:00:00Z',
  })

  it('is neutral without an assessment and scales with the systems', () => {
    expect(conditionFactor(null)).toBe(1)
    expect(conditionFactor(systems(1.5))).toBeCloseTo(1.5, 6)
    const r = calculateAnalysis({
      listing: WORKBOOK_LISTING,
      assumptions: DEFAULT_ASSUMPTIONS,
      condition: systems(1.5),
    })
    expect(r.startupCost.breakdown.find((b) => b.label === 'Buildout')?.amount).toBeCloseTo(720_000, 0)
    expect(r.startupCost.baselineMid).toBeLessThan(r.startupCost.mid)
  })
})

describe('resolveAssumptions', () => {
  it('ignores assumptions saved under the old badminton + pickleball model', () => {
    const legacy = { badmintonCourtSqft: 1250, pickleballMixPct: 0.4, usableCourtAreaPct: 0.5 }
    expect(resolveAssumptions(legacy)).toEqual(DEFAULT_ASSUMPTIONS)
  })

  it('keeps edits saved under the current model', () => {
    expect(resolveAssumptions({ ...DEFAULT_ASSUMPTIONS, peakRate: 80 }).peakRate).toBe(80)
  })
})

describe('calculatePaybackYears', () => {
  it('divides cost to open by income', () => {
    expect(calculatePaybackYears(390_000, 100_000)).toBe(3.9)
  })
  it('is null when income is zero or negative', () => {
    expect(calculatePaybackYears(390_000, 0)).toBeNull()
    expect(calculatePaybackYears(390_000, -1)).toBeNull()
  })
})
