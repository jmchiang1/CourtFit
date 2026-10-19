'use client'

import { COURTS, CourtKey, ITEMS, ItemKey, ROOMS, RoomKey } from '@/lib/floor-planner/config'
import { resolveRect } from '@/lib/floor-planner/geometry'
import type { FloorPlanLayout, PlacedItem } from '@/lib/floor-planner/types'

/** Nominal viewBox width; the SVG itself scales to its container. */
const THUMB_W = 260

/** `pct`% of `color` over transparent — works for hex and `var(--…)` colors. */
const tint = (color: string, pct: number) => `color-mix(in oklab, ${color} ${pct}%, transparent)`

function itemColor(item: PlacedItem): { fill: string; stroke: string } {
  if (item.category === 'court') {
    const c = COURTS[item.type as CourtKey]
    return { fill: tint(c.color, 85), stroke: c.color }
  }
  if (item.category === 'item') {
    const it = ITEMS[item.type as ItemKey]
    return { fill: it.color, stroke: it.color }
  }
  const r = ROOMS[item.type as RoomKey]
  return { fill: tint(r.fill, 20), stroke: r.fill }
}

/** A small read-only SVG preview of a floor plan. */
export function LayoutThumbnail({
  layout,
  className,
}: {
  layout: FloorPlanLayout
  className?: string
}) {
  const { lengthFt, widthFt } = layout.building
  const scale = THUMB_W / Math.max(1, lengthFt)
  const h = Math.max(40, widthFt * scale)

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${THUMB_W} ${h}`}
      className={className ?? 'block rounded-md'}
      style={{ background: 'var(--panel-2)' }}
      role="img"
      aria-label={`Floor plan preview — ${layout.name}`}
    >
      <rect x={0.5} y={0.5} width={THUMB_W - 1} height={h - 1} fill="none" stroke="var(--muted-foreground)" strokeOpacity={0.55} />
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
