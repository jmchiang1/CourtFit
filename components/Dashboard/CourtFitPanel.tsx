import type { AnalysisResult, ExtractedListing, Assumptions } from '@/types/analysis'

interface Props {
  result: AnalysisResult
  listing: ExtractedListing
  assumptions: Assumptions
}

/** Court count of the reference club the financial model is built on. */
const REFERENCE_COURTS = 5

export function CourtFitPanel({ result, listing, assumptions: a }: Props) {
  const warehouseSqft = listing.warehouseSqft ?? listing.totalSqft ?? 0
  const usable = warehouseSqft * a.usableCourtAreaPct
  const total = result.courts.total
  const diff = total - REFERENCE_COURTS
  const comparison =
    total === 0
      ? 'Add the warehouse size to fit courts'
      : diff === 0
        ? `Same as your ${REFERENCE_COURTS}-court reference club`
        : `${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} than your ${REFERENCE_COURTS}-court reference club`

  return (
    <div className="court-fit-card surface p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-sm font-semibold text-foreground">Court fit</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.round(usable).toLocaleString()} sf usable
        </span>
      </div>

      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-semibold tabular-nums text-foreground">
            {total}
          </span>
          <span className="text-sm text-foreground">
            badminton court{total === 1 ? '' : 's'}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{comparison}</p>
      </div>

      <dl className="divide-y divide-border border-t text-sm">
        <Row
          label="Court footprint"
          value={`${a.courtSqft.toLocaleString()} sf`}
          sub="24 × 50 ft with buffer"
        />
        <Row
          label="Floor used for courts"
          value={`${Math.round(a.usableCourtAreaPct * 100)}%`}
          sub="The rest is reception, lounge, bathrooms and egress"
        />
      </dl>
    </div>
  )
}

function Row({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 last:pb-0">
      <div className="min-w-0">
        <dt className="text-foreground">{label}</dt>
        <dd className="text-xs text-muted-foreground">{sub}</dd>
      </div>
      <dd className="font-display text-base font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  )
}
