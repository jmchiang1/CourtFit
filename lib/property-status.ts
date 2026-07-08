// A property's outreach / viability state, set manually by the user from the
// verdict modal. Independent of the computed `rating` — a Strong Candidate can
// still be marked "Not viable" once a call reveals the sports complex isn't
// possible there. Persisted per-row (see supabase/migrations/0006_status.sql).

export type PropertyStatus = 'active' | 'contacted' | 'not_viable' | 'leased' | 'passed'

/** Menu / filter order. `active` is the implicit default for every property. */
export const PROPERTY_STATUSES: PropertyStatus[] = [
  'active',
  'contacted',
  'not_viable',
  'leased',
  'passed',
]

export interface StatusMeta {
  label: string
  /** Badge classes (chip bg + text + ring), matching the RatingBadge palette. */
  badge: string
  /** True for states that take the property "out of play" (dim it in lists). */
  inactive: boolean
}

export const STATUS_META: Record<PropertyStatus, StatusMeta> = {
  active: {
    label: 'Active',
    badge: 'bg-white/10 text-muted-foreground ring-1 ring-white/15',
    inactive: false,
  },
  contacted: {
    label: 'Contacted',
    badge: 'bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30',
    inactive: false,
  },
  not_viable: {
    label: 'Not viable',
    badge: 'bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30',
    inactive: true,
  },
  leased: {
    label: 'Leased out',
    badge: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30',
    inactive: true,
  },
  passed: {
    label: 'Passed',
    badge: 'bg-white/10 text-muted-foreground ring-1 ring-white/15',
    inactive: true,
  },
}

/** Normalize a raw DB value (may be null / missing pre-migration) to a status. */
export function normalizeStatus(value: string | null | undefined): PropertyStatus {
  return value && value in STATUS_META ? (value as PropertyStatus) : 'active'
}
