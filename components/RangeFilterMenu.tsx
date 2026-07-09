'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SlidersHorizontal } from 'lucide-react'
import {
  EMPTY_RANGES,
  RANGE_FIELDS,
  countActiveRanges,
  type RangeKey,
  type Ranges,
} from '@/lib/property-filters'

/**
 * The "Filters" dropdown of adjustable min/max value ranges (total sqft, clear
 * height, lease price). Shared by the list table and the map so both filter
 * properties by the same criteria. Fully controlled — the parent owns `ranges`.
 */
export function RangeFilterMenu({
  ranges,
  onChange,
  size = 'default',
  align = 'start',
}: {
  ranges: Ranges
  onChange: (next: Ranges) => void
  size?: 'sm' | 'default'
  align?: 'start' | 'end'
}) {
  const active = countActiveRanges(ranges)
  const setRange = (key: RangeKey, side: 'min' | 'max', value: string) =>
    onChange({ ...ranges, [key]: { ...ranges[key], [side]: value } })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size={size} className="gap-1.5">
            <SlidersHorizontal className={size === 'sm' ? 'size-3.5' : 'size-4'} />
            Filters
            {active > 0 && (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold tabular-nums text-primary">
                {active}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align={align} className="w-72 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Filter by value</span>
          {active > 0 && (
            <button
              type="button"
              onClick={() => onChange(EMPTY_RANGES)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="my-2" />
        <div className="space-y-3">
          {RANGE_FIELDS.map((f) => (
            <div key={f.key}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-xs font-medium">{f.label}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {f.unit}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={f.step}
                  placeholder="Min"
                  value={ranges[f.key].min}
                  onChange={(e) => setRange(f.key, 'min', e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="h-8"
                  aria-label={`Minimum ${f.label}`}
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={f.step}
                  placeholder="Max"
                  value={ranges[f.key].max}
                  onChange={(e) => setRange(f.key, 'max', e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="h-8"
                  aria-label={`Maximum ${f.label}`}
                />
              </div>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
