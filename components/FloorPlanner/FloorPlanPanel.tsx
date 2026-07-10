'use client'

import { Button } from '@/components/ui/button'
import { COURTS, CourtKey, ITEMS, ItemKey, ROOMS, RoomKey } from '@/lib/floor-planner/config'
import { diagnose, resolveRect, tally } from '@/lib/floor-planner/geometry'
import { normalizeLayout } from '@/lib/floor-planner/seed'
import type { FloorPlanLayout, PlacedItem } from '@/lib/floor-planner/types'
import type { PropertyRow } from '@/lib/supabase/types'

const THUMB_W = 260

function itemColor(item: PlacedItem): { fill: string; stroke: string } {
  if (item.category === 'court') {
    const c = COURTS[item.type as CourtKey]
    return { fill: `${c.color}44`, stroke: c.color }
  }
  if (item.category === 'item') {
    const it = ITEMS[item.type as ItemKey]
    return { fill: it.color, stroke: it.color }
  }
  const r = ROOMS[item.type as RoomKey]
  return { fill: `${r.fill}33`, stroke: r.fill }
}

/** A small read-only SVG preview of a floor plan. */
function LayoutThumbnail({ layout }: { layout: FloorPlanLayout }) {
  const { lengthFt, widthFt } = layout.building
  const scale = THUMB_W / Math.max(1, lengthFt)
  const h = Math.max(40, widthFt * scale)

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${THUMB_W} ${h}`}
      className="block rounded-md"
      style={{ background: '#f4f1ea' }}
      role="img"
      aria-label="Floor plan preview"
    >
      <rect x={0.5} y={0.5} width={THUMB_W - 1} height={h - 1} fill="none" stroke="#8a939e" />
      {layout.items.map((it) => {
        const r = resolveRect(it, layout.footprintMode)
        const { fill, stroke } = itemColor(it)
        return (
          <rect
            key={it.id}
            x={r.xFt * scale}
            y={r.yFt * scale}
            width={Math.max(1, r.wFt * scale)}
            height={Math.max(1, r.hFt * scale)}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.75}
          />
        )
      })}
    </svg>
  )
}

interface Props {
  property: PropertyRow
  onOpen: () => void
}

export function FloorPlanPanel({ property, onOpen }: Props) {
  const layout = normalizeLayout(property.layout_json)

  const stats = layout
    ? tally(
        layout.items,
        layout.footprintMode,
        diagnose(layout.items, layout.footprintMode, layout.building, layout.zones),
      )
    : null

  const updated = property.layout_updated_at
    ? new Date(property.layout_updated_at).toLocaleDateString()
    : null

  return (
    <div className="surface rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Floor plan</h3>
        {layout && (
          <span className="text-xs text-muted-foreground">
            {stats?.totalCourts ?? 0} court{(stats?.totalCourts ?? 0) === 1 ? '' : 's'} ·{' '}
            {layout.items.length} items
          </span>
        )}
      </div>

      {layout ? (
        <>
          <div className="overflow-hidden rounded-lg ring-1 ring-border">
            <LayoutThumbnail layout={layout} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {layout.building.lengthFt}′ × {layout.building.widthFt}′
              {updated ? ` · saved ${updated}` : ''}
            </p>
            <Button size="sm" variant="secondary" onClick={onOpen}>
              Edit floor plan
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-8 text-center">
          <p className="max-w-xs text-sm text-muted-foreground">
            No floor plan yet. Lay out courts, rooms, and furniture to scale — seeded from this
            listing’s size and clear height.
          </p>
          <Button size="sm" onClick={onOpen}>
            Create floor plan
          </Button>
        </div>
      )}
    </div>
  )
}
