import type { ExtractedListing, RiskFlag } from '@/types/analysis'

export interface RiskFlagInput {
  listing: ExtractedListing
  totalCourts: number
  rentBurden: number
}

export function generateRiskFlags(i: RiskFlagInput): RiskFlag[] {
  const flags: RiskFlag[] = []
  const { listing } = i

  if (listing.clearHeight !== null && listing.clearHeight < 24) {
    flags.push({
      id: 'low-clear-height',
      severity: 'high',
      title: 'Low ceiling',
      detail:
        'Clear height is below the preferred 24–30 ft range for badminton. Verify ceiling obstructions, lighting, ducts, beams, and actual playable height.',
    })
  }

  if (listing.rentPerSqftYr == null) {
    flags.push({
      id: 'missing-rent',
      severity: 'high',
      title: 'Rent estimated',
      detail:
        'No rental rate stated — using $25/sf/yr base rent (plus NNN) as an estimate. Contact broker for the actual rate before relying on the financial model.',
    })
  }

  if (i.totalCourts > 0 && i.totalCourts < 5) {
    flags.push({
      id: 'too-few-courts',
      severity: 'medium',
      title: 'Below 5-court target',
      detail: 'This property may be too small for the 5-court model the financials are based on.',
    })
  }

  if (i.rentBurden > 0.30) {
    flags.push({
      id: 'high-rent-burden',
      severity: 'medium',
      title: 'High rent burden',
      detail:
        'Rent burden is high. This may put pressure on profitability unless revenue assumptions are conservative.',
    })
  }

  if (listing.officeSqft != null && listing.officeSqft > 0) {
    flags.push({
      id: 'office-space',
      severity: 'low',
      title: 'Includes office area',
      detail:
        'Listing includes office area. Court layout should be based on clear-span warehouse area, not total square footage.',
    })
  }

  if (listing.zoning) {
    flags.push({
      id: 'zoning',
      severity: 'low',
      title: 'Confirm zoning',
      detail: 'Zoning must be confirmed for recreational/sports facility use before lease signing.',
    })
  }

  return flags
}
