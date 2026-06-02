'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  addReferenceFacility,
  updateReferenceFacility,
} from '@/app/actions/reference-facilities'
import type { ReferenceFacilityRow } from '@/lib/supabase/types'
import type { Sport } from '@/lib/reference-facilities'

const SPORTS: Sport[] = ['Badminton', 'Pickleball']

export function AddFacilityDialog({
  open,
  onOpenChange,
  onSaved,
  editing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (row: ReferenceFacilityRow) => void
  /** When set, the dialog edits this facility instead of adding a new one. */
  editing?: ReferenceFacilityRow | null
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [sports, setSports] = useState<Sport[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const isEdit = !!editing

  // Initialize the fields each time the dialog opens — from the facility being
  // edited, or blank (no sport pre-selected) for a new one.
  useEffect(() => {
    if (!open) return
    setName(editing?.name ?? '')
    setAddress(editing?.address ?? '')
    setSports((editing?.sports as Sport[]) ?? [])
    setError(null)
  }, [open, editing])

  const toggleSport = (s: Sport) =>
    setSports((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))

  const submit = () => {
    setError(null)
    start(async () => {
      const r = editing
        ? await updateReferenceFacility(editing.id, { name, address, sports })
        : await addReferenceFacility({ name, address, sports })
      if ('error' in r) {
        setError(r.error)
        return
      }
      onSaved(r.row)
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="add-facility-dialog sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit reference facility' : 'Add reference facility'}</DialogTitle>
          <DialogDescription>
            A competitor or reference court. We’ll geocode the address and pull its 5-mile demand.
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
            <Label htmlFor="facility-name">Name</Label>
            <Input
              id="facility-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Smash City Badminton"
              disabled={pending}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="facility-address">Address</Label>
            <Input
              id="facility-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, City, ST 10001"
              disabled={pending}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sports</Label>
            <div className="flex gap-2">
              {SPORTS.map((s) => {
                const selected = sports.includes(s)
                return (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    // Cyan (default) = selected; muted (secondary) = not selected.
                    variant={selected ? 'default' : 'secondary'}
                    aria-pressed={selected}
                    onClick={() => toggleSport(s)}
                    disabled={pending}
                  >
                    {s}
                  </Button>
                )
              })}
            </div>
          </div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending
              ? isEdit
                ? 'Saving…'
                : 'Adding…'
              : isEdit
                ? 'Save changes'
                : 'Add facility'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
