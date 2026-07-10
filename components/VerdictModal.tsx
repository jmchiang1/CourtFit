'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { VerdictHero } from '@/components/Dashboard/VerdictHero'
import { KpiCards } from '@/components/Dashboard/KpiCards'
import { CourtFitPanel } from '@/components/Dashboard/CourtFitPanel'
import { PropertyDetailsPanel } from '@/components/Dashboard/PropertyDetailsPanel'
import { FinancialBreakdown } from '@/components/Dashboard/FinancialBreakdown'
import { RiskFlagsPanel } from '@/components/Dashboard/RiskFlagsPanel'
import { SummaryPanel } from '@/components/Dashboard/SummaryPanel'
import { CompetitionPanel } from '@/components/Dashboard/CompetitionPanel'
import { DemographicsPanel } from '@/components/Dashboard/DemographicsPanel'
import { FloorPlanPanel } from '@/components/FloorPlanner/FloorPlanPanel'
import { StatusBadge } from '@/components/Dashboard/StatusBadge'
import type { CompetitorSite } from '@/lib/competition'
import { Pencil, Trash2, MapPin, X, ExternalLink, ChevronDown, SlidersHorizontal, EyeOff, Star, MoreVertical } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { PhotoStrip } from './PhotoStrip'
import type { PropertyRow } from '@/lib/supabase/types'
import { calculateAnalysis } from '@/lib/calculator'
import { DEFAULT_ASSUMPTIONS } from '@/lib/constants'
import {
  PROPERTY_STATUSES,
  STATUS_META,
  normalizeStatus,
  type PropertyStatus,
} from '@/lib/property-status'
import { useSectionVisibility } from '@/lib/use-section-visibility'

interface Props {
  property: PropertyRow | null
  /** Competitor facilities (built-in + user-added) for the competition panel. */
  sites?: CompetitorSite[]
  onClose: () => void
  onEdit: (row: PropertyRow) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: PropertyStatus) => void
  onInterestedChange: (id: string, interested: boolean) => void
  /** Open the full-screen floor planner for this property. */
  onOpenPlanner: (row: PropertyRow) => void
}

export function VerdictModal({
  property,
  sites = [],
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  onInterestedChange,
  onOpenPlanner,
}: Props) {
  const { isHidden, hide, toggle, showAll } = useSectionVisibility()

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

  const status = normalizeStatus(property?.status)

  // Each toggleable panel, grouped into the labeled sections. Hiding one hides
  // it on every property (persisted); the "Sections" menu restores them.
  const sections = useMemo(() => {
    if (!property || !result) return []
    return [
      {
        label: 'The space & build',
        panels: [
          {
            key: 'court-fit',
            label: 'Court fit',
            node: (
              <CourtFitPanel
                result={result}
                listing={property.listing_json}
                assumptions={property.assumptions_json}
              />
            ),
          },
          {
            key: 'property-details',
            label: 'Property details',
            node: <PropertyDetailsPanel listing={property.listing_json} />,
          },
          {
            key: 'floor-plan',
            label: 'Floor plan',
            node: <FloorPlanPanel property={property} onOpen={() => onOpenPlanner(property)} />,
          },
        ],
      },
      {
        label: 'The money',
        panels: [
          {
            key: 'financials',
            label: 'Revenue & expenses',
            node: <FinancialBreakdown result={result} />,
          },
        ],
      },
      {
        label: 'Location & demand',
        panels: [
          {
            key: 'demand',
            label: 'Demand — trade area',
            node: <DemographicsPanel demographics={property.demographics_json} />,
          },
          {
            key: 'competition',
            label: 'Competition & whitespace',
            node: (
              <CompetitionPanel
                lat={property.latitude}
                lng={property.longitude}
                demographics={property.demographics_json}
                assumptions={{ ...DEFAULT_ASSUMPTIONS, ...property.assumptions_json }}
                sites={sites}
              />
            ),
          },
        ],
      },
      {
        label: 'Risk & verdict',
        panels: [
          {
            key: 'risks',
            label: 'Risks to confirm',
            node: <RiskFlagsPanel flags={result.riskFlags} />,
          },
          {
            key: 'summary',
            label: 'Summary',
            node: <SummaryPanel result={result} address={property.address} />,
          },
        ],
      },
    ]
  }, [property, result, sites, onOpenPlanner])

  const allPanels = useMemo(() => sections.flatMap((s) => s.panels), [sections])
  const hiddenCount = allPanels.filter((p) => isHidden(p.key)).length

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
              {/* Title doubles as the source-listing link when we have one, so
                  the standalone "Listing" chip drops off the row entirely. */}
              <DialogTitle className="min-w-0 truncate">
                {property?.listing_json.sourceUrl ? (
                  <a
                    href={property.listing_json.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open source listing"
                    className="group/title inline-flex min-w-0 items-center gap-1.5 hover:text-foreground/80 transition-colors"
                  >
                    <span className="truncate">
                      {property?.label || property?.address || 'Property analysis'}
                    </span>
                    <ExternalLink className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover/title:text-foreground" />
                  </a>
                ) : (
                  property?.label || property?.address || 'Property analysis'
                )}
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

              {/* One menu for both the outreach status and the manual
                  "interested" star. The star only shows on the trigger when set,
                  so it's an at-a-glance cue rather than a standing control. */}
              {property && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        title="Set status / interested"
                        className="shrink-0 inline-flex items-center gap-1 rounded-full outline-none hover:opacity-80 transition-opacity focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {property.interested && (
                          <Star className="size-3.5 fill-current text-amber-300" />
                        )}
                        <StatusBadge status={status} />
                        <ChevronDown className="size-3 text-muted-foreground" />
                      </button>
                    }
                  />
                  <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuCheckboxItem
                      checked={!!property.interested}
                      onCheckedChange={(checked) => onInterestedChange(property.id, checked)}
                    >
                      Interested
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
                      Property status
                    </div>
                    <DropdownMenuRadioGroup
                      value={status}
                      onValueChange={(v) => onStatusChange(property.id, v as PropertyStatus)}
                    >
                      {PROPERTY_STATUSES.map((s) => (
                        <DropdownMenuRadioItem key={s} value={s}>
                          {STATUS_META[s].label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Edit, section visibility, and Delete collapsed into one
                  overflow menu so the header stays light — matches the list
                  table's per-row action menu. */}
              {property && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="relative size-8 p-0"
                        aria-label="More actions"
                      >
                        <MoreVertical className="size-4" />
                        {/* Dot preserves the "some sections hidden" signal now
                            that the Sections control lives inside this menu. */}
                        {hiddenCount > 0 && (
                          <span className="absolute right-1 top-1 size-1.5 rounded-full bg-foreground/70" />
                        )}
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => onEdit(property)}>
                      <Pencil className="size-4" /> Edit
                    </DropdownMenuItem>

                    {/* Section visibility — toggles persist across every property */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <SlidersHorizontal className="size-4" />
                        Sections
                        {hiddenCount > 0 && (
                          <span className="tabular-nums text-muted-foreground">· {hiddenCount} hidden</span>
                        )}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-60">
                        <p className="px-1.5 py-1 text-[11px] leading-snug text-muted-foreground">
                          Applies to every property on this device.
                        </p>
                        <DropdownMenuSeparator />
                        {allPanels.map((p) => (
                          <DropdownMenuCheckboxItem
                            key={p.key}
                            checked={!isHidden(p.key)}
                            onCheckedChange={() => toggle(p.key)}
                          >
                            {p.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                        {hiddenCount > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={showAll}>Show all sections</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        if (confirm(`Delete "${property.label || property.address || 'this property'}"?`)) {
                          onDelete(property.id)
                        }
                      }}
                      className="text-rose-300"
                    >
                      <Trash2 className="size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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

            {/* Detail grouped into labeled, two-up sections. Empty (fully
                hidden) sections drop out entirely. */}
            {sections.map((section) => {
              const visible = section.panels.filter((p) => !isHidden(p.key))
              if (visible.length === 0) return null
              return (
                <Section key={section.label} label={section.label}>
                  {visible.map((p, i) => {
                    // A card left alone in the final row (odd count → last one)
                    // spans the full width instead of leaving an empty column.
                    const full = visible.length % 2 === 1 && i === visible.length - 1
                    return (
                      <PanelCell
                        key={p.key}
                        label={p.label}
                        onHide={() => hide(p.key)}
                        full={full}
                      >
                        {p.node}
                      </PanelCell>
                    )
                  })}
                </Section>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * A labeled detail group: a small section header + divider, then its panels laid
 * out two-up (stacking on smaller widths).
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
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-w-0">{children}</div>
    </section>
  )
}

/**
 * Wraps a single panel with a hover-revealed hide button. The cell is min-w-0 so
 * the tabular numbers inside never force horizontal overflow.
 */
function PanelCell({
  label,
  onHide,
  children,
  full = false,
}: {
  label: string
  onHide: () => void
  children: ReactNode
  /** Span both columns (used for a card left alone in its row). */
  full?: boolean
}) {
  // flex-col + the panel growing to flex-1 makes the card fill the grid cell's
  // full height, so cards sharing a row are always equal (tallest) height. The
  // hide button is absolute, so it stays out of the flex flow.
  return (
    <div
      className={`group/panel relative flex min-w-0 flex-col [&>*:last-child]:flex-1 ${
        full ? 'xl:col-span-2' : ''
      }`}
    >
      <button
        type="button"
        onClick={onHide}
        aria-label={`Hide ${label}`}
        title={`Hide "${label}" on all properties`}
        className="absolute right-2 top-2 z-10 hidden size-7 items-center justify-center rounded-md bg-card/90 text-muted-foreground ring-1 ring-border backdrop-blur transition-colors group-hover/panel:flex hover:text-foreground"
      >
        <EyeOff className="size-3.5" />
      </button>
      {children}
    </div>
  )
}
