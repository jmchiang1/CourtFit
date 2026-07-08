import { fmtMoney } from '@/lib/format'
import type { ExtractedListing } from '@/types/analysis'

const fmtSqft = (n: number | null) =>
  n != null && isFinite(n) ? `${Math.round(n).toLocaleString()} sf` : '—'

/**
 * The at-a-glance listing facts — the "general property details" the user wants
 * up front: total size, clear height, and lease price, plus the supporting
 * space split, zoning, and access notes when the listing carries them.
 */
export function PropertyDetailsPanel({ listing }: { listing: ExtractedListing }) {
  const { totalSqft, warehouseSqft, officeSqft, clearHeight, rentPerSqftYr } = listing
  // Annual rent = $/sf/yr × total sf (only when both are known).
  const annualRent =
    rentPerSqftYr != null && totalSqft != null ? rentPerSqftYr * totalSqft : null

  return (
    <div className="property-details-card surface p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-semibold tracking-tight">Property details</h3>
        {clearHeight != null && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {clearHeight}&prime; clear
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Detail label="Total size" value={fmtSqft(totalSqft)} strong />
        <Detail label="Clear height" value={clearHeight != null ? `${clearHeight} ft` : '—'} strong />
        <Detail label="Warehouse" value={fmtSqft(warehouseSqft)} />
        <Detail label="Office" value={fmtSqft(officeSqft)} />
        <Detail
          label="Lease price"
          value={rentPerSqftYr != null ? `${fmtMoney(rentPerSqftYr)}/sf/yr` : '—'}
          strong
        />
        <Detail
          label="Annual rent"
          value={annualRent != null ? `${fmtMoney(annualRent)}/yr` : '—'}
        />
        {listing.zoning && <Detail label="Zoning" value={listing.zoning} />}
        {listing.parking && <Detail label="Parking" value={listing.parking} />}
        {listing.loading && <Detail label="Loading" value={listing.loading} full />}
      </div>
    </div>
  )
}

function Detail({
  label,
  value,
  strong,
  full,
}: {
  label: string
  value: string
  strong?: boolean
  full?: boolean
}) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 tabular-nums ${
          strong ? 'text-base font-semibold text-foreground' : 'text-foreground/90'
        }`}
      >
        {value}
      </div>
    </div>
  )
}
