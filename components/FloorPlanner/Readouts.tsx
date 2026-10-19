"use client";

import { useMemo } from "react";
import { COURTS, CourtKey, defaultLabel } from "@/lib/floor-planner/config";
import type { Diagnosis, Tally, WarningKind } from "@/lib/floor-planner/geometry";
import { usePlanner } from "@/lib/floor-planner/store";

interface Props {
  tally: Tally;
  diag: Record<string, Diagnosis>;
}

const WARNING_LABEL: Record<WarningKind, string> = {
  ceiling: "Ceiling too low",
  outdoor: "In outdoor yard",
  overlap: "Overlaps a court",
  "out-of-bounds": "Outside building",
};

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-md bg-muted/70 px-3 py-2">
      <div
        className="font-display text-xl font-semibold tabular-nums"
        style={{ color: accent ?? "var(--foreground)" }}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default function Readouts({ tally, diag }: Props) {
  const {
    items,
    selectedIds,
    building,
    zones,
    rotateItem,
    duplicateItem,
    removeItem,
    rotateItems,
    duplicateItems,
    removeItems,
    renameItem,
    select,
  } = usePlanner();

  const usableFt2 = useMemo(
    () =>
      zones.filter((z) => !z.outdoor).reduce((sum, z) => sum + z.widthFt * building.lengthFt, 0),
    [zones, building.lengthFt],
  );

  // The detailed inspector is for a single selection; a multi-selection shows a
  // lightweight group panel with bulk actions instead.
  const selected =
    selectedIds.length === 1 ? items.find((it) => it.id === selectedIds[0]) ?? null : null;
  const multi = selectedIds.length > 1;
  const selWarnings = selected ? diag[selected.id]?.warnings ?? [] : [];

  const courtRows = useMemo(
    () =>
      (Object.keys(COURTS) as CourtKey[])
        .map((k) => ({ k, count: tally.courtsByType[k] ?? 0 }))
        .filter((r) => r.count > 0),
    [tally],
  );

  // The catalogue name, shown under the name field so a renamed piece still
  // says what it actually is.
  const selKind = selected ? defaultLabel(selected.category, selected.type) : "";

  const pct = usableFt2 > 0 ? (tally.courtAreaFt2 / usableFt2) * 100 : 0;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col overflow-hidden rounded-xl bg-panel">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {multi && (
          <div className="px-3 pb-4 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-sm font-semibold text-foreground">
                {selectedIds.length} selected
              </span>
              <button
                onClick={() => select(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Deselect
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => rotateItems(selectedIds)}
                className="rounded-md bg-field py-1.5 text-[12px] text-foreground outline-none transition hover:bg-field-hover focus-visible:ring-2 focus-visible:ring-ring"
              >
                Rotate
              </button>
              <button
                onClick={() => duplicateItems(selectedIds)}
                className="rounded-md bg-field py-1.5 text-[12px] text-foreground outline-none transition hover:bg-field-hover focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clone
              </button>
              <button
                onClick={() => removeItems(selectedIds)}
                className="rounded-md bg-risk/10 py-1.5 text-[12px] font-medium text-risk outline-none transition hover:bg-risk/15 focus-visible:ring-2 focus-visible:ring-ring"
              >
                Delete
              </button>
            </div>
          </div>
        )}
        {selected && (
          <div className="px-3 pb-4 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-sm font-semibold text-foreground">
                Selected
              </span>
              <button
                onClick={() => select(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Deselect
              </button>
            </div>

            {/* Any piece can be renamed; clearing the field restores the
                catalogue name. */}
            <input
              value={selected.label ?? ""}
              placeholder={selKind}
              onChange={(e) => renameItem(selected.id, e.target.value)}
              onBlur={(e) => renameItem(selected.id, e.target.value.trim())}
              aria-label="Piece name"
              className="w-full rounded-md bg-field px-2 py-1 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="mb-2 mt-1 truncate text-xs text-muted-foreground">
              {selKind}
            </div>

            {selWarnings.length > 0 && (
              <ul className="mb-2 space-y-1">
                {selWarnings.map((w) => (
                  <li
                    key={w}
                    className="flex items-center gap-1.5 rounded bg-risk/10 px-2 py-1 text-[11px] text-risk"
                  >
                    <span>⚠</span>
                    {WARNING_LABEL[w]}
                  </li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => rotateItem(selected.id)}
                className="rounded-md bg-field py-1.5 text-[12px] text-foreground outline-none transition hover:bg-field-hover focus-visible:ring-2 focus-visible:ring-ring"
              >
                Rotate
              </button>
              <button
                onClick={() => duplicateItem(selected.id)}
                className="rounded-md bg-field py-1.5 text-[12px] text-foreground outline-none transition hover:bg-field-hover focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clone
              </button>
              <button
                onClick={() => removeItem(selected.id)}
                className="rounded-md bg-risk/10 py-1.5 text-[12px] font-medium text-risk outline-none transition hover:bg-risk/15 focus-visible:ring-2 focus-visible:ring-ring"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        <div className="p-3">
          <div className="mb-2 font-display text-sm font-semibold text-foreground">
            Capacity
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Valid courts" value={tally.totalCourts} />
            <Stat
              label="Warnings"
              value={tally.warnings}
              accent={tally.warnings ? "var(--risk)" : "var(--good)"}
            />
            <Stat label="Badminton" value={tally.badminton} accent="var(--court)" />
            <Stat label="Pickleball" value={tally.pickleball} accent="var(--info)" />
          </div>

          {courtRows.length > 0 && (
            <div className="mt-3 space-y-1">
              {courtRows.map((r) => (
                <div
                  key={r.k}
                  className="flex items-center justify-between rounded-md bg-muted/70 px-2.5 py-1.5 text-[12px]"
                >
                  <span className="flex items-center gap-2 text-foreground/80">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: COURTS[r.k].color }}
                    />
                    {COURTS[r.k].label}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">{r.count}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 rounded-md bg-muted/70 px-3 py-2">
            <div className="flex items-center justify-between text-[12px] text-muted-foreground">
              <span>Court area used</span>
              <span className="font-medium tabular-nums text-foreground">
                {Math.round(tally.courtAreaFt2).toLocaleString()} ft²
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <div className="mt-1 text-right text-[10px] tabular-nums text-muted-foreground">
              {Math.round(pct)}% of {Math.round(usableFt2).toLocaleString()} ft² indoor
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
