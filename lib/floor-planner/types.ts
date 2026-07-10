import type { Category } from './config'

export type FootprintMode = 'play' | 'footprint'

/** The building envelope, in feet. */
export interface BuildingDef {
  name: string
  lengthFt: number // long axis → rendered horizontally (x)
  widthFt: number // short axis → rendered vertically (y)
}

/** A ceiling band across the building width (the y axis). */
export interface ZoneDef {
  id: string
  label: string
  offsetFt: number // measured down from the top edge
  widthFt: number
  ceilingFt: number
  badmintonOk: boolean
  outdoor: boolean
  fill: string
  stroke: string
}

export interface PlacedItem {
  id: string
  category: Category
  type: string // key into COURTS / ITEMS / ROOMS
  xFt: number // top-left, in feet from stage origin
  yFt: number
  rotated: boolean // 90° rotation (courts & furniture)
  // Optional resize override (footprint feet). Any element is resizable;
  // when unset the catalogue default size is used. Rooms also carry a label.
  wFt?: number
  hFt?: number
  label?: string
}

/** An axis-aligned rectangle in feet, resolved for the current render. */
export interface Rect {
  xFt: number
  yFt: number
  wFt: number
  hFt: number
}

/**
 * The serializable per-property floor plan. This is exactly what lands in the
 * `properties.layout_json` column. `version` lets us migrate the shape later.
 */
export interface FloorPlanLayout {
  version: 1
  name: string
  footprintMode: FootprintMode
  building: BuildingDef
  zones: ZoneDef[]
  items: PlacedItem[]
}
