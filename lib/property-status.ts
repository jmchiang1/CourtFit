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
    badge: 'bg-muted text-muted-foreground',
    inactive: false,
  },
  contacted: {
    label: 'Contacted',
    badge: 'bg-info/10 text-info',
    inactive: false,
  },
  not_viable: {
    label: 'Not viable',
    badge: 'bg-risk/10 text-risk',
    inactive: true,
  },
  leased: {
    label: 'Leased out',
    badge: 'bg-caution/10 text-caution',
    inactive: true,
  },
  passed: {
    label: 'Passed',
    badge: 'bg-muted text-muted-foreground',
    inactive: true,
  },
}

/** Normalize a raw DB value (may be null / missing pre-migration) to a status. */
export function normalizeStatus(value: string | null | undefined): PropertyStatus {
  return value && value in STATUS_META ? (value as PropertyStatus) : 'active'
}
