'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { VerdictHero } from '@/components/Dashboard/VerdictHero'
import { KpiCards } from '@/components/Dashboard/KpiCards'
import { CourtFitPanel } from '@/components/Dashboard/CourtFitPanel'
import { FinancialBreakdown } from '@/components/Dashboard/FinancialBreakdown'
import { RiskFlagsPanel } from '@/components/Dashboard/RiskFlagsPanel'
import { SummaryPanel } from '@/components/Dashboard/SummaryPanel'
import { StartupCostBreakdown } from '@/components/Dashboard/StartupCostBreakdown'
import { ConditionPanel } from '@/components/Dashboard/ConditionPanel'
import { CompetitionPanel } from '@/components/Dashboard/CompetitionPanel'
import { DemographicsPanel } from '@/components/Dashboard/DemographicsPanel'
import type { CompetitorSite } from '@/lib/competition'
import { Pencil, Trash2, MapPin, X, ExternalLink } from 'lucide-react'
import { Children, useMemo, type ReactNode } from 'react'
import { PhotoStrip } from './PhotoStrip'
import type { PropertyRow } from '@/lib/supabase/types'
import { calculateAnalysis } from '@/lib/calculator'
import { DEFAULT_ASSUMPTIONS } from '@/lib/constants'

interface Props {
  property: PropertyRow | null
  /** Competitor facilities (built-in + user-added) for the competition panel. */
  sites?: CompetitorSite[]
  onClose: () => void
  onEdit: (row: PropertyRow) => void
  onDelete: (id: string) => void
}

export function VerdictModal({ property, sites = [], onClose, onEdit, onDelete }: Props) {
  // Recompute the analysis from the persisted listing + assumptions so the
  // verdict reflects the latest calculator logic, not the row's stale snapshot.
  const result = useMemo(() => {
    if (!property) return null
    return calculateAnalysis({
      // Patch in default null/[] for fields older saved properties don't have.
      listing: {
        ...property.listing_json,
        sourceUrl: property.listing_json.sourceUrl ?? null,
        imageUrls: property.listing_json.imageUrls ?? [],
      },
      // Merge with defaults so old saved properties (missing the new
      // renovation-breakdown fields) still compute correctly.
      assumptions: { ...DEFAULT_ASSUMPTIONS, ...property.assumptions_json },
      // Condition assessment (when present) scales the renovation estimate.
      condition: property.condition_json,
    })
  }, [property])

  return (
    <Dialog
      open={!!property}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="verdict-modal sm:max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden"
      >
        <DialogHeader className="min-w-0">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <DialogTitle className="truncate">
                {property?.label || property?.address || 'Property analysis'}
              </DialogTitle>
              {property?.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in Google Maps"
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MapPin className="size-4" />
                </a>
              )}
              {property?.listing_json.sourceUrl && (
                <a
                  href={property.listing_json.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open source listing"
                  className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  Listing
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {property && (
                <Button variant="outline" size="sm" onClick={() => onEdit(property)} className="gap-1.5">
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              )}
              {property && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Delete "${property.label || property.address || 'this property'}"?`)) {
                      onDelete(property.id)
                    }
                  }}
                  className="gap-1.5 text-rose-300 hover:text-rose-200 hover:bg-rose-400/10"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="size-8 p-0 text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {property && result && (
          <div className="space-y-6 mt-2 min-w-0">
            {/* Scannable summary: photos + the verdict + the headline numbers */}
            {property.listing_json.imageUrls?.length > 0 && (
              <PhotoStrip
                images={property.listing_json.imageUrls}
                sourceUrl={property.listing_json.sourceUrl}
              />
            )}
            <VerdictHero result={result} address={property.address} />
            <KpiCards result={result} />

            {/* Detail grouped into labeled, two-up sections so the eye can jump */}
            <Section label="The space &amp; build">
              <CourtFitPanel
                result={result}
                listing={property.listing_json}
                assumptions={property.assumptions_json}
              />
              <ConditionPanel condition={property.condition_json} />
            </Section>

            <Section label="The money">
              <FinancialBreakdown result={result} />
              <StartupCostBreakdown result={result} />
            </Section>

            <Section label="Location &amp; demand">
              <DemographicsPanel demographics={property.demographics_json} />
              <CompetitionPanel
                lat={property.latitude}
                lng={property.longitude}
                demographics={property.demographics_json}
                assumptions={{ ...DEFAULT_ASSUMPTIONS, ...property.assumptions_json }}
                sites={sites}
              />
            </Section>

            <Section label="Risk &amp; verdict">
              <RiskFlagsPanel flags={result.riskFlags} />
              <SummaryPanel result={result} address={property.address} />
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * A labeled detail group: a small section header + divider, then its panels laid
 * out two-up (stacking on smaller widths). Each panel cell is min-w-0 so the
 * tabular numbers inside never force horizontal overflow.
 */
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="space-y-3 min-w-0">
      <div className="flex items-center gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </h3>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-w-0">
        {Children.map(children, (child) => (
          <div className="min-w-0">{child}</div>
        ))}
      </div>
    </section>
  )
}
