/**
 * Column metadata for the dashboard list table.
 *
 * The table renders whatever `COLUMNS` entries are currently visible, in this
 * declared order — so adding a column here plus a `case` in DashboardTable's
 * cell renderer is all it takes. Visibility is user-controlled via
 * ColumnPickerMenu and persisted to localStorage.
 */

export type ColumnKey =
  | 'label'
  | 'rating'
  | 'status'
  | 'noi'
  | 'courts'
  | 'payback'
  | 'sqft'
  | 'height'
  | 'rent'
  | 'region'
  | 'created'

export type SortKey =
  | 'label'
  | 'rating'
  | 'status'
  | 'noi'
  | 'total_courts'
  | 'payback_years'
  | 'total_sqft'
  | 'clear_height'
  | 'rent_per_sqft'
  | 'region'
  | 'created_at'

export interface ColumnDef {
  key: ColumnKey
  label: string
  sortKey: SortKey
  align?: 'left' | 'right'
  /** Locked columns can't be hidden — without them a row has no identity. */
  locked?: boolean
  /** Shown by default for users who've never touched the column picker. */
  defaultVisible: boolean
}

export const COLUMNS: ColumnDef[] = [
  { key: 'label', label: 'Address / Label', sortKey: 'label', locked: true, defaultVisible: true },
  { key: 'rating', label: 'Rating', sortKey: 'rating', defaultVisible: true },
  { key: 'status', label: 'Status', sortKey: 'status', defaultVisible: false },
  { key: 'noi', label: 'NOI', sortKey: 'noi', align: 'right', defaultVisible: true },
  { key: 'courts', label: 'Courts', sortKey: 'total_courts', align: 'right', defaultVisible: true },
  { key: 'payback', label: 'Payback', sortKey: 'payback_years', align: 'right', defaultVisible: true },
  { key: 'sqft', label: 'Total Sqft', sortKey: 'total_sqft', align: 'right', defaultVisible: false },
  { key: 'height', label: 'Clear Height', sortKey: 'clear_height', align: 'right', defaultVisible: false },
  { key: 'rent', label: 'Rent $/sqft', sortKey: 'rent_per_sqft', align: 'right', defaultVisible: false },
  { key: 'region', label: 'Region', sortKey: 'region', defaultVisible: false },
  { key: 'created', label: 'Added', sortKey: 'created_at', align: 'right', defaultVisible: true },
]

export const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = COLUMNS.filter((c) => c.defaultVisible).map(
  (c) => c.key,
)

export const DEFAULT_COLUMN_ORDER: ColumnKey[] = COLUMNS.map((c) => c.key)

/** User's table layout: left-to-right order, plus which columns are shown. */
export interface ColumnPrefs {
  order: ColumnKey[]
  visible: ColumnKey[]
}

export const DEFAULT_COLUMN_PREFS: ColumnPrefs = {
  order: DEFAULT_COLUMN_ORDER,
  visible: DEFAULT_VISIBLE_COLUMNS,
}

/** Resolves prefs to the ColumnDefs actually rendered, left to right. */
export function orderedVisibleColumns(prefs: ColumnPrefs): ColumnDef[] {
  return prefs.order
    .filter((k) => prefs.visible.includes(k))
    .map((k) => COLUMNS.find((c) => c.key === k)!)
}

/**
 * Moves `key` to sit immediately before or after `targetKey` in `order`.
 * Operates on the full order (hidden columns included) so hiding and
 * re-showing a column brings it back where the user left it.
 */
export function moveColumn(
  order: ColumnKey[],
  key: ColumnKey,
  targetKey: ColumnKey,
  side: 'before' | 'after',
): ColumnKey[] {
  if (key === targetKey) return order
  const without = order.filter((k) => k !== key)
  const at = without.indexOf(targetKey)
  if (at === -1) return order
  without.splice(side === 'before' ? at : at + 1, 0, key)
  return without
}

const STORAGE_KEY = 'dashboard-table-columns'

/**
 * Reads saved prefs, dropping keys that no longer exist, appending columns
 * added since the prefs were written, and always re-adding locked ones — so a
 * stale saved value can never strand the user with a broken table.
 */
export function loadColumnPrefs(): ColumnPrefs | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    // Prefs used to be a bare array of visible keys, before ordering existed.
    const saved: { order?: unknown; visible?: unknown } = Array.isArray(parsed)
      ? { visible: parsed }
      : (parsed as object)
    if (!saved || typeof saved !== 'object') return null

    const savedOrder = Array.isArray(saved.order) ? (saved.order as ColumnKey[]) : []
    const known = savedOrder.filter((k) => COLUMNS.some((c) => c.key === k))
    // Columns introduced after this pref was written land in their default spot.
    const order = [...known, ...DEFAULT_COLUMN_ORDER.filter((k) => !known.includes(k))]

    if (!Array.isArray(saved.visible)) return null
    const savedVisible = saved.visible as ColumnKey[]
    const visible = COLUMNS.filter((c) => c.locked || savedVisible.includes(c.key)).map(
      (c) => c.key,
    )
    return { order, visible }
  } catch {
    return null
  }
}

export function saveColumnPrefs(prefs: ColumnPrefs): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Private browsing / quota — the layout just won't persist.
  }
}
