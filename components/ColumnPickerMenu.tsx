'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Columns3 } from 'lucide-react'
import {
  COLUMNS,
  DEFAULT_COLUMN_PREFS,
  type ColumnKey,
  type ColumnPrefs,
} from '@/lib/table-columns'

/**
 * "Columns" dropdown — toggles which table headers the list view shows, and
 * lists them in their current left-to-right order (which the user changes by
 * dragging the headers themselves). Fully controlled; the parent persists.
 * Locked columns render disabled so a row always keeps its identity column.
 */
export function ColumnPickerMenu({
  prefs,
  onChange,
  size = 'default',
  align = 'end',
}: {
  prefs: ColumnPrefs
  onChange: (next: ColumnPrefs) => void
  size?: 'sm' | 'default'
  align?: 'start' | 'end'
}) {
  const hiddenCount = COLUMNS.length - prefs.visible.length
  const isDefault =
    prefs.order.join() === DEFAULT_COLUMN_PREFS.order.join() &&
    prefs.visible.length === DEFAULT_COLUMN_PREFS.visible.length &&
    DEFAULT_COLUMN_PREFS.visible.every((k) => prefs.visible.includes(k))

  // Listed in display order, so the menu mirrors the table.
  const ordered = prefs.order.map((k) => COLUMNS.find((c) => c.key === k)!)

  const toggle = (key: ColumnKey, checked: boolean) => {
    const next = new Set(prefs.visible)
    if (checked) next.add(key)
    else next.delete(key)
    onChange({
      ...prefs,
      visible: COLUMNS.filter((c) => c.locked || next.has(c.key)).map((c) => c.key),
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size={size} className="gap-1.5">
            <Columns3 className={size === 'sm' ? 'size-3.5' : 'size-4'} />
            Columns
            {hiddenCount > 0 && (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold tabular-nums text-primary">
                {hiddenCount}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align={align} className="w-60 p-1.5">
        <div className="flex items-center justify-between px-1.5 py-1">
          <span className="text-xs font-medium text-muted-foreground">Show columns</span>
          {!isDefault && (
            <button
              type="button"
              onClick={() => onChange(DEFAULT_COLUMN_PREFS)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Reset
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="my-1" />
        {ordered.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.key}
            checked={prefs.visible.includes(c.key)}
            disabled={c.locked}
            closeOnClick={false}
            onCheckedChange={(checked) => toggle(c.key, checked)}
          >
            {c.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator className="my-1" />
        <p className="px-1.5 py-1 text-[11px] leading-snug text-muted-foreground">
          Drag a column header to reorder, or focus one and press Alt+←/→.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
