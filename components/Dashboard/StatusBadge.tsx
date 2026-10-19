import { STATUS_META, type PropertyStatus } from '@/lib/property-status'

/** Small tag for the property's outreach status. Squarer than RatingBadge so
 *  the two never read as the same kind of thing. */
export function StatusBadge({ status }: { status: PropertyStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight whitespace-nowrap ${meta.badge}`}
    >
      {meta.label}
    </span>
  )
}
