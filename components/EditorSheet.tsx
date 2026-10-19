'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ListingInput } from '@/components/ListingInput'
import { PhotoStrip } from '@/components/PhotoStrip'
import { PropertyForm } from '@/components/PropertyForm'
import { AssumptionsPanel } from '@/components/AssumptionsPanel'
import { RatingBadge } from '@/components/Dashboard/RatingBadge'
import { fmtMoney, fmtYears } from '@/lib/format'
import { calculateAnalysis } from '@/lib/calculator'
import { DEFAULT_ASSUMPTIONS, resolveAssumptions, EMPTY_LISTING } from '@/lib/constants'
import { saveProperty } from '@/app/actions/save-property'
import type { Assumptions, ExtractedListing } from '@/types/analysis'
import type { PropertyRow } from '@/lib/supabase/types'

interface Props {
  /** When non-null, sheet is open. `null` = closed. */
  initial: { row?: PropertyRow; importedText?: string } | null
  onClose: () => void
  onSaved: () => void
}

export function EditorSheet({ initial, onClose, onSaved }: Props) {
  const [listing, setListing] = useState<ExtractedListing>({ ...EMPTY_LISTING })
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS)
  const [savedId, setSavedId] = useState<string | undefined>(undefined)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [pending, start] = useTransition()

  // Reset / hydrate state every time the sheet opens.
  useEffect(() => {
    if (!initial) return
    if (initial.row) {
      // Patch in defaults for fields older saved properties don't have
      // (sourceUrl, imageUrls) so the form binds cleanly.
      setListing({
        ...initial.row.listing_json,
        sourceUrl: initial.row.listing_json.sourceUrl ?? null,
        imageUrls: initial.row.listing_json.imageUrls ?? [],
      })
      // Merge with defaults to fill in any fields missing from older saves.
      setAssumptions(resolveAssumptions(initial.row.assumptions_json))
      setSavedId(initial.row.id)
    } else {
      setListing({ ...EMPTY_LISTING })
      setAssumptions(DEFAULT_ASSUMPTIONS)
      setSavedId(undefined)
    }
    setSaveStatus(null)
  }, [initial])

  const result = useMemo(
    () => calculateAnalysis({ listing, assumptions }),
    [listing, assumptions],
  )

  const reset = () => {
    setListing({ ...EMPTY_LISTING })
    setAssumptions(DEFAULT_ASSUMPTIONS)
    setSavedId(undefined)
    setSaveStatus(null)
  }

  const save = () =>
    start(async () => {
      setSaveStatus(null)
      const r = await saveProperty({
        id: savedId,
        label: listing.address,
        address: listing.address,
        listing,
        assumptions,
        snapshot: {
          rating: result.rating,
          noi: result.noi,
          totalCourts: result.courts.total,
          paybackYears: result.paybackYears,
        },
      })
      if ('error' in r) {
        setSaveStatus(r.error === 'not_authenticated' ? 'Sign in to save.' : `Error: ${r.error}`)
      } else {
        setSavedId(r.id)
        setSaveStatus('Saved.')
        onSaved()
        onClose()
      }
    })

  return (
    <Sheet
      open={!!initial}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <SheetContent className="editor-sheet w-full overflow-y-auto p-0 data-[side=right]:sm:max-w-[90vw] data-[side=right]:lg:max-w-[80vw] data-[side=right]:xl:max-w-[70vw]">
        <div className="flex flex-col min-h-full">
          <SheetHeader className="border-b border-border px-5 py-4 sticky top-0 bg-popover z-10">
            <SheetTitle className="font-display text-lg font-semibold text-foreground">
              {savedId ? 'Edit property' : 'Add new property'}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 bg-background px-5 py-4 space-y-4">
            <ListingInput onExtracted={(l) => setListing(l)} />
            {listing.imageUrls?.length > 0 && (
              <PhotoStrip images={listing.imageUrls} sourceUrl={listing.sourceUrl ?? null} />
            )}
            <PropertyForm
              value={listing}
              onChange={setListing}
              headerAction={<AssumptionsPanel value={assumptions} onChange={setAssumptions} />}
            />
          </div>

          {/* Live verdict preview footer — sticks at the bottom of the sheet */}
          <div className="border-t border-border bg-popover px-5 py-3 sticky bottom-0 z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 tabular-nums">
                <RatingBadge rating={result.rating} />
                <span className="flex items-baseline gap-1.5">
                  <span className="text-xs text-muted-foreground">NOI</span>
                  <span
                    className={`font-display text-sm font-semibold ${
                      result.noi < 0 ? 'text-risk' : 'text-foreground'
                    }`}
                  >
                    {fmtMoney(result.noi)}
                  </span>
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-xs text-muted-foreground">Courts</span>
                  <span className="font-display text-sm font-semibold text-foreground">
                    {result.courts.total}
                  </span>
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-xs text-muted-foreground">Payback</span>
                  <span className="font-display text-sm font-semibold text-foreground">
                    {fmtYears(result.paybackYears)}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                {saveStatus && (
                  <span className="text-xs text-muted-foreground mr-1">{saveStatus}</span>
                )}
                <Button variant="ghost" size="sm" onClick={reset}>Reset</Button>
                <Button size="lg" onClick={save} disabled={pending} className="px-5">
                  {pending ? 'Saving…' : savedId ? 'Update' : 'Save analysis'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
