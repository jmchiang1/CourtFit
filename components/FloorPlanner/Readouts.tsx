"use client";

import { useMemo } from "react";
import { COURTS, CourtKey, ITEMS, ROOMS } from "@/lib/floor-planner/config";
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
    <div className="rounded-lg border border-[#232a34] bg-[#0d1117] px-3 py-2">
      <div className="font-mono text-xl font-semibold" style={{ color: accent ?? "#e6edf3" }}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
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
    renameRoom,
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

  const selLabel = selected
    ? selected.category === "court"
      ? COURTS[selected.type as CourtKey].label
      : selected.category === "item"
        ? ITEMS[selected.type as keyof typeof ITEMS].label
        : selected.label ?? ROOMS[selected.type as keyof typeof ROOMS].label
    : "";

  const pct = usableFt2 > 0 ? (tally.courtAreaFt2 / usableFt2) * 100 : 0;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-[#232a34] bg-[#161b22]">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {multi && (
          <div className="border-b border-[#232a34] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
                {selectedIds.length} selected
              </span>
              <button
                onClick={() => select(null)}
                className="text-[11px] text-neutral-500 hover:text-neutral-300"
              >
                deselect
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => rotateItems(selectedIds)}
                className="rounded-md border border-[#232a34] py-1.5 text-[12px] text-neutral-200 hover:bg-white/10"
              >
                Rotate
              </button>
              <button
                onClick={() => duplicateItems(selectedIds)}
                className="rounded-md border border-[#232a34] py-1.5 text-[12px] text-neutral-200 hover:bg-white/10"
              >
                Clone
              </button>
              <button
                onClick={() => removeItems(selectedIds)}
                className="rounded-md border border-red-500/40 py-1.5 text-[12px] text-red-300 hover:bg-red-500/15"
              >
                Delete
              </button>
            </div>
          </div>
        )}
        {selected && (
          <div className="border-b border-[#232a34] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
                Selected
              </span>
              <button
                onClick={() => select(null)}
                className="text-[11px] text-neutral-500 hover:text-neutral-300"
              >
                deselect
              </button>
            </div>

            {selected.category === "room" ? (
              <input
                value={selected.label ?? ROOMS[selected.type as keyof typeof ROOMS].label}
                onChange={(e) => renameRoom(selected.id, e.target.value)}
                className="mb-2 w-full rounded-md border border-[#232a34] bg-[#0d1117] px-2 py-1 text-[13px] text-neutral-100 outline-none focus:border-sky-500"
              />
            ) : (
              <div className="mb-2 text-sm font-medium text-neutral-100">{selLabel}</div>
            )}

            {selWarnings.length > 0 && (
              <ul className="mb-2 space-y-1">
                {selWarnings.map((w) => (
                  <li
                    key={w}
                    className="flex items-center gap-1.5 rounded bg-red-500/10 px-2 py-1 text-[11px] text-red-300"
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
                className="rounded-md border border-[#232a34] py-1.5 text-[12px] text-neutral-200 hover:bg-white/10"
              >
                Rotate
              </button>
              <button
                onClick={() => duplicateItem(selected.id)}
                className="rounded-md border border-[#232a34] py-1.5 text-[12px] text-neutral-200 hover:bg-white/10"
              >
                Clone
              </button>
              <button
                onClick={() => removeItem(selected.id)}
                className="rounded-md border border-red-500/40 py-1.5 text-[12px] text-red-300 hover:bg-red-500/15"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        <div className="p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Capacity
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Valid courts" value={tally.totalCourts} accent="#38bdf8" />
            <Stat
              label="Warnings"
              value={tally.warnings}
              accent={tally.warnings ? "#f87171" : "#4ade80"}
            />
            <Stat label="Badminton" value={tally.badminton} accent={COURTS.badminton.color} />
            <Stat label="Pickleball" value={tally.pickleball} accent={COURTS.pickleball.color} />
          </div>

          {courtRows.length > 0 && (
            <div className="mt-3 space-y-1">
              {courtRows.map((r) => (
                <div
                  key={r.k}
                  className="flex items-center justify-between rounded-md bg-[#0d1117] px-2.5 py-1.5 text-[12px]"
                >
                  <span className="flex items-center gap-2 text-neutral-300">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: COURTS[r.k].color }}
                    />
                    {COURTS[r.k].label}
                  </span>
                  <span className="font-mono text-neutral-400">{r.count}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 rounded-lg border border-[#232a34] bg-[#0d1117] px-3 py-2">
            <div className="flex items-center justify-between text-[12px] text-neutral-400">
              <span>Court area used</span>
              <span className="font-mono text-neutral-200">
                {Math.round(tally.courtAreaFt2).toLocaleString()} ft²
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#232a34]">
              <div
                className="h-full rounded-full bg-sky-500 transition-[width]"
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <div className="mt-1 text-right font-mono text-[10px] text-neutral-500">
              {Math.round(pct)}% of {Math.round(usableFt2).toLocaleString()} ft² indoor
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
