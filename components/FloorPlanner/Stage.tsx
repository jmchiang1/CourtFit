"use client";

import { useRef, useState } from "react";
import { GRID } from "@/lib/floor-planner/config";
import type { BuildingDef, FootprintMode, PlacedItem, ZoneDef } from "@/lib/floor-planner/types";
import type { Diagnosis } from "@/lib/floor-planner/geometry";
import { resolveRect } from "@/lib/floor-planner/geometry";
import { usePlanner } from "@/lib/floor-planner/store";
import PlacedElement from "./PlacedElement";

interface Props {
  items: PlacedItem[];
  ppf: number;
  mode: FootprintMode;
  selectedIds: string[];
  diag: Record<string, Diagnosis>;
  building: BuildingDef;
  zones: ZoneDef[];
}

/** Marquee rectangle in floor-local pixels while a rubber-band drag is active. */
type Marquee = { x0: number; y0: number; x1: number; y1: number };

export default function Stage({ items, ppf, mode, selectedIds, diag, building, zones }: Props) {
  const select = usePlanner((s) => s.select);
  const setSelection = usePlanner((s) => s.setSelection);

  const W = building.lengthFt * ppf;
  const H = building.widthFt * ppf;

  const minor = GRID.minorFt * ppf;
  const major = GRID.majorFt * ppf;

  // Rubber-band selection. Started on empty floor; a tiny drag counts as a click
  // (which clears the selection). `start` also remembers whether Shift was held
  // so the marquee adds to the existing selection instead of replacing it.
  const floorRef = useRef<HTMLDivElement | null>(null);
  const start = useRef<{ x: number; y: number; additive: boolean } | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);

  const localPoint = (e: React.PointerEvent) => {
    const r = floorRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function onFloorPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || !floorRef.current) return; // left button only (pan uses the container)
    const p = localPoint(e);
    start.current = { x: p.x, y: p.y, additive: e.shiftKey };
    setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    floorRef.current.setPointerCapture?.(e.pointerId);
  }

  function onFloorPointerMove(e: React.PointerEvent) {
    if (!start.current || !floorRef.current) return;
    const p = localPoint(e);
    setMarquee({ x0: start.current.x, y0: start.current.y, x1: p.x, y1: p.y });
  }

  function onFloorPointerUp(e: React.PointerEvent) {
    const s = start.current;
    start.current = null;
    setMarquee(null);
    if (!s || !floorRef.current) return;
    floorRef.current.releasePointerCapture?.(e.pointerId);

    const p = localPoint(e);
    const dragged = Math.abs(p.x - s.x) > 3 || Math.abs(p.y - s.y) > 3;
    if (!dragged) {
      if (!s.additive) select(null); // a plain click on empty floor clears selection
      return;
    }

    // Everything intersecting the box (in feet) gets selected.
    const left = Math.min(s.x, p.x) / ppf;
    const right = Math.max(s.x, p.x) / ppf;
    const top = Math.min(s.y, p.y) / ppf;
    const bottom = Math.max(s.y, p.y) / ppf;
    const hits = items
      .filter((it) => {
        const r = resolveRect(it, mode);
        return r.xFt < right && r.xFt + r.wFt > left && r.yFt < bottom && r.yFt + r.hFt > top;
      })
      .map((it) => it.id);

    setSelection(
      s.additive ? Array.from(new Set([...usePlanner.getState().selectedIds, ...hits])) : hits,
    );
  }

  const sole = selectedIds.length === 1 ? selectedIds[0] : null;

  return (
    <div className="inline-block p-16">
      <div
        className="relative mx-auto mb-2 text-center font-mono text-[11px] text-neutral-400"
        style={{ width: W }}
      >
        <span className="rounded bg-[#161b22] px-2 py-0.5">← {building.lengthFt} ft →</span>
      </div>

      <div className="flex items-start gap-2">
        <div
          className="flex items-center justify-center font-mono text-[11px] text-neutral-400"
          style={{ height: H, width: 20 }}
        >
          <span className="-rotate-90 whitespace-nowrap rounded bg-[#161b22] px-2 py-0.5">
            ↕ {building.widthFt} ft
          </span>
        </div>

        <div
          ref={floorRef}
          onPointerDown={onFloorPointerDown}
          onPointerMove={onFloorPointerMove}
          onPointerUp={onFloorPointerUp}
          className="relative shrink-0 shadow-2xl ring-1 ring-black/40"
          style={{
            width: W,
            height: H,
            backgroundColor: "#f4f1ea",
            backgroundImage:
              "linear-gradient(rgba(90,110,130,.09) 1px, transparent 1px)," +
              "linear-gradient(90deg, rgba(90,110,130,.09) 1px, transparent 1px)," +
              "linear-gradient(rgba(90,110,130,.22) 1px, transparent 1px)," +
              "linear-gradient(90deg, rgba(90,110,130,.22) 1px, transparent 1px)",
            backgroundSize: `${minor}px ${minor}px, ${minor}px ${minor}px, ${major}px ${major}px, ${major}px ${major}px`,
          }}
        >
          {zones.map((z) => (
            <div
              key={z.id}
              className="pointer-events-none absolute left-0"
              style={{
                top: z.offsetFt * ppf,
                width: W,
                height: z.widthFt * ppf,
                background: z.fill,
                borderTop: `1px dashed ${z.stroke}`,
                borderBottom: `1px dashed ${z.stroke}`,
              }}
            >
              <div
                className="absolute left-1 top-1 select-none font-mono text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: z.stroke }}
              >
                {z.label}
                {z.outdoor ? "" : ` · ${z.ceilingFt}′ clg`}
              </div>
              {z.outdoor && (
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, transparent 0 6px, rgba(90,110,130,.35) 6px 7px)",
                  }}
                />
              )}
            </div>
          ))}

          {items.map((it) => (
            <PlacedElement
              key={it.id}
              item={it}
              ppf={ppf}
              mode={mode}
              selected={selectedIds.includes(it.id)}
              sole={it.id === sole}
              warnings={diag[it.id]?.warnings ?? []}
            />
          ))}

          {marquee && (
            <div
              className="pointer-events-none absolute z-30 border border-sky-400 bg-sky-400/10"
              style={{
                left: Math.min(marquee.x0, marquee.x1),
                top: Math.min(marquee.y0, marquee.y1),
                width: Math.abs(marquee.x1 - marquee.x0),
                height: Math.abs(marquee.y1 - marquee.y0),
              }}
            />
          )}

          <div className="pointer-events-none absolute inset-0 ring-2 ring-neutral-700/70" />
        </div>
      </div>
    </div>
  );
}
