"use client";

import { GRID } from "@/lib/floor-planner/config";
import type { BuildingDef, FootprintMode, PlacedItem, ZoneDef } from "@/lib/floor-planner/types";
import type { Diagnosis } from "@/lib/floor-planner/geometry";
import PlacedElement from "./PlacedElement";

interface Props {
  items: PlacedItem[];
  ppf: number;
  mode: FootprintMode;
  selectedId: string | null;
  diag: Record<string, Diagnosis>;
  building: BuildingDef;
  zones: ZoneDef[];
  onBackgroundPointerDown: () => void;
}

export default function Stage({
  items,
  ppf,
  mode,
  selectedId,
  diag,
  building,
  zones,
  onBackgroundPointerDown,
}: Props) {
  const W = building.lengthFt * ppf;
  const H = building.widthFt * ppf;

  const minor = GRID.minorFt * ppf;
  const major = GRID.majorFt * ppf;

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
          onPointerDown={onBackgroundPointerDown}
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
              selected={it.id === selectedId}
              warnings={diag[it.id]?.warnings ?? []}
            />
          ))}

          <div className="pointer-events-none absolute inset-0 ring-2 ring-neutral-700/70" />
        </div>
      </div>
    </div>
  );
}
