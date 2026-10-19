'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { emptyLayout, seedLayoutFromListing } from '@/lib/floor-planner/seed'
import type { FloorPlanLayout } from '@/lib/floor-planner/types'
import type { PropertyRow } from '@/lib/supabase/types'

/** Sentinel for "don't seed from a listing" in the property <Select>. */
const BLANK = '__blank__'

/**
 * Names the plan and, optionally, picks a saved property to seed the building
 * envelope from (square footage → length × width, clear height → ceiling). The
 * plan isn't persisted here — it opens in the planner and saves from there.
 */
export function NewFloorPlanDialog({
  open,
  onOpenChange,
  properties,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  properties: PropertyRow[]
  onCreate: (input: { name: string; layout: FloorPlanLayout; propertyId: string | null }) => void
}) {
  const [name, setName] = useState('')
  const [propertyId, setPropertyId] = useState<string>(BLANK)

  useEffect(() => {
    if (!open) return
    setName('')
    setPropertyId(BLANK)
  }, [open])

  const selected = properties.find((p) => p.id === propertyId) ?? null

  // Fall back to the seeded layout's own name (the property label/address) so
  // an unnamed plan still reads as something.
  const submit = () => {
    const layout = selected
      ? seedLayoutFromListing(selected.listing_json, selected.label)
      : emptyLayout()
    const finalName = name.trim() || layout.name || 'Untitled floor plan'
    onCreate({
      name: finalName,
      layout: { ...layout, name: finalName, building: { ...layout.building, name: finalName } },
      propertyId: selected?.id ?? null,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New floor plan</DialogTitle>
          <DialogDescription>
            Start from a blank building, or size the envelope from one of your saved listings.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">Name</Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={selected ? (selected.label ?? selected.address ?? '') : 'e.g. Main hall — 16 courts'}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-property">Size from a listing</Label>
            <Select value={propertyId} onValueChange={(v) => setPropertyId(v ?? BLANK)}>
              <SelectTrigger id="plan-property" className="w-full">
                {/* Base UI shows the raw value unless told how to label it. */}
                <SelectValue>
                  {(v: string) => {
                    if (v === BLANK) return 'Blank building (150′ × 100′)'
                    const p = properties.find((x) => x.id === v)
                    return p ? p.label || p.address || 'Untitled property' : v
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={BLANK}>Blank building (150′ × 100′)</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label || p.address || 'Untitled property'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <p className="text-xs text-muted-foreground">
                {selected.listing_json.warehouseSqft ?? selected.listing_json.totalSqft
                  ? `${(
                      selected.listing_json.warehouseSqft ?? selected.listing_json.totalSqft
                    )?.toLocaleString()} sqft`
                  : 'No square footage on this listing'}
                {selected.listing_json.clearHeight
                  ? ` · ${selected.listing_json.clearHeight}′ clear`
                  : ''}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full">
            Open planner
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
