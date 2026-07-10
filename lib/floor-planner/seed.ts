import { DEFAULT_BUILDING, makeZone } from './config'
import type { FloorPlanLayout, FootprintMode } from './types'
import type { ExtractedListing } from '@/types/analysis'

/** Assumed length:width ratio when we only know the building's square footage. */
const ASPECT = 1.5

/** Fallback ceiling (ft) when the listing has no clear height. */
const DEFAULT_CEILING_FT = 24

/**
 * Build a starting floor plan for a property from its extracted listing. The
 * envelope is sized from warehouse (or total) square footage and the ceiling is
 * taken from the listing's clear height — both editable afterward.
 */
export function seedLayoutFromListing(
  listing: Pick<ExtractedListing, 'warehouseSqft' | 'totalSqft' | 'clearHeight' | 'address'>,
  label?: string | null,
): FloorPlanLayout {
  const area = listing.warehouseSqft ?? listing.totalSqft ?? null

  let lengthFt = DEFAULT_BUILDING.lengthFt
  let widthFt = DEFAULT_BUILDING.widthFt
  if (area && area > 0) {
    lengthFt = Math.max(40, Math.round(Math.sqrt(area * ASPECT)))
    widthFt = Math.max(30, Math.round(Math.sqrt(area / ASPECT)))
  }

  const ceilingFt =
    listing.clearHeight && listing.clearHeight > 0 ? listing.clearHeight : DEFAULT_CEILING_FT

  const name = label || listing.address || DEFAULT_BUILDING.name

  return {
    version: 1,
    name,
    footprintMode: 'footprint',
    building: { name, lengthFt, widthFt },
    zones: [makeZone(widthFt, ceilingFt)],
    items: [],
  }
}

/** A blank plan with the default envelope. */
export function emptyLayout(name = DEFAULT_BUILDING.name): FloorPlanLayout {
  return {
    version: 1,
    name,
    footprintMode: 'footprint',
    building: { ...DEFAULT_BUILDING, name },
    zones: [makeZone(DEFAULT_BUILDING.widthFt, DEFAULT_CEILING_FT)],
    items: [],
  }
}

/**
 * Coerce whatever is stored in `properties.layout_json` into a valid layout.
 * Returns null when there's no usable saved layout (caller then seeds one).
 */
export function normalizeLayout(raw: unknown): FloorPlanLayout | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<FloorPlanLayout>
  if (!r.building || typeof r.building.lengthFt !== 'number') return null
  if (!Array.isArray(r.zones) || !Array.isArray(r.items)) return null
  const mode: FootprintMode = r.footprintMode === 'play' ? 'play' : 'footprint'
  return {
    version: 1,
    name: typeof r.name === 'string' ? r.name : r.building.name,
    footprintMode: mode,
    building: r.building,
    zones: r.zones,
    items: r.items,
  }
}
