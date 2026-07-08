import { STATUS_META, type PropertyStatus } from '@/lib/property-status'

/** Small pill mirroring RatingBadge, colored by the property's status. */
export function StatusBadge({ status }: { status: PropertyStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${meta.badge}`}
    >
      {meta.label}
    </span>
  )
}
