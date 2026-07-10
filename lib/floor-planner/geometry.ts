import { COURTS, CourtKey, baseFootprint } from "./config";
import type {
  BuildingDef,
  FootprintMode,
  PlacedItem,
  Rect,
  ZoneDef,
} from "./types";

/**
 * The on-plan FOOTPRINT size (feet), honoring a manual resize override.
 * `wFt`/`hFt` overrides are stored in footprint space, already oriented.
 */
function footprintSize(item: PlacedItem): { w: number; h: number } {
  const base = baseFootprint(item.category, item.type, "footprint");
  const baseW = item.rotated ? base.h : base.w;
  const baseH = item.rotated ? base.w : base.h;
  return { w: item.wFt ?? baseW, h: item.hFt ?? baseH };
}

/** For a court, the play size that matches its (possibly resized) footprint. */
function courtPlaySize(item: PlacedItem): { w: number; h: number } {
  const c = COURTS[item.type as CourtKey];
  const fp = footprintSize(item);
  const fpBaseW = item.rotated ? c.footprint.h : c.footprint.w;
  const fpBaseH = item.rotated ? c.footprint.w : c.footprint.h;
  const playBaseW = item.rotated ? c.play.h : c.play.w;
  const playBaseH = item.rotated ? c.play.w : c.play.h;
  // scale the painted lines by the same ratio the footprint was scaled
  return { w: fp.w * (playBaseW / fpBaseW), h: fp.h * (playBaseH / fpBaseH) };
}

/** Resolve the on-plan rectangle (in feet) for a placed item at a given mode. */
export function resolveRect(item: PlacedItem, mode: FootprintMode): Rect {
  let w: number;
  let h: number;

  if (item.category === "room") {
    const base = baseFootprint("room", item.type, mode);
    w = item.wFt ?? base.w;
    h = item.hFt ?? base.h;
  } else if (item.category === "court") {
    if (mode === "play") {
      ({ w, h } = courtPlaySize(item));
    } else {
      ({ w, h } = footprintSize(item));
    }
  } else {
    // furniture / barriers — one size for both modes, resizable
    const base = baseFootprint(item.category, item.type, mode);
    const baseW = item.rotated ? base.h : base.w;
    const baseH = item.rotated ? base.w : base.h;
    w = item.wFt ?? baseW;
    h = item.hFt ?? baseH;
  }

  return { xFt: item.xFt, yFt: item.yFt, wFt: w, hFt: h };
}

/** For courts, also expose the inner "play" rectangle centered in the footprint. */
export function playInset(item: PlacedItem, mode: FootprintMode): Rect | null {
  if (item.category !== "court") return null;
  const outer = resolveRect(item, mode);
  const play = courtPlaySize(item);
  return {
    xFt: outer.xFt + (outer.wFt - play.w) / 2,
    yFt: outer.yFt + (outer.hFt - play.h) / 2,
    wFt: play.w,
    hFt: play.h,
  };
}

export function center(r: Rect): { xFt: number; yFt: number } {
  return { xFt: r.xFt + r.wFt / 2, yFt: r.yFt + r.hFt / 2 };
}

/** Which ceiling zone contains a given y (feet down from the top edge). */
export function zoneAtY(zones: ZoneDef[], yFt: number): ZoneDef | null {
  for (const z of zones) {
    if (yFt >= z.offsetFt && yFt < z.offsetFt + z.widthFt) return z;
  }
  return null;
}

export function zoneOfCenter(zones: ZoneDef[], r: Rect): ZoneDef | null {
  return zoneAtY(zones, center(r).yFt);
}

/** Axis-aligned rectangle intersection with a small epsilon to ignore touching. */
export function rectsOverlap(a: Rect, b: Rect, epsFt = 0.25): boolean {
  return (
    a.xFt < b.xFt + b.wFt - epsFt &&
    a.xFt + a.wFt > b.xFt + epsFt &&
    a.yFt < b.yFt + b.hFt - epsFt &&
    a.yFt + a.hFt > b.yFt + epsFt
  );
}

/** Is the whole rectangle inside the building envelope? */
export function insideBuilding(
  building: BuildingDef,
  r: Rect,
  epsFt = 0.25,
): boolean {
  return (
    r.xFt >= -epsFt &&
    r.yFt >= -epsFt &&
    r.xFt + r.wFt <= building.lengthFt + epsFt &&
    r.yFt + r.hFt <= building.widthFt + epsFt
  );
}

export type WarningKind = "ceiling" | "outdoor" | "overlap" | "out-of-bounds";

export interface Diagnosis {
  id: string;
  warnings: WarningKind[];
}

/** A court is "valid" (counts toward capacity) when it has zero warnings. */
export function diagnose(
  items: PlacedItem[],
  mode: FootprintMode,
  building: BuildingDef,
  zones: ZoneDef[],
): Record<string, Diagnosis> {
  const rects = items.map((it) => ({ it, r: resolveRect(it, mode) }));
  const out: Record<string, Diagnosis> = {};

  for (let i = 0; i < rects.length; i++) {
    const { it, r } = rects[i];
    const warnings: WarningKind[] = [];

    if (!insideBuilding(building, r)) warnings.push("out-of-bounds");

    if (it.category === "court") {
      const c = COURTS[it.type as CourtKey];
      const z = zoneOfCenter(zones, r);
      if (z?.outdoor) {
        // Courts in the outdoor yard are always flagged.
        warnings.push("outdoor");
      } else if (z && z.ceilingFt < c.minCeilingFt) {
        // Indoor but the ceiling is too low for this sport.
        warnings.push("ceiling");
      }
    }

    // Overlap: courts only overlap-check against other courts (the costly
    // planning error). Rooms/furniture can freely sit inside/around courts.
    if (it.category === "court") {
      for (let j = 0; j < rects.length; j++) {
        if (i === j) continue;
        if (rects[j].it.category !== "court") continue;
        if (rectsOverlap(r, rects[j].r)) {
          warnings.push("overlap");
          break;
        }
      }
    }

    out[it.id] = { id: it.id, warnings };
  }

  return out;
}

export interface Tally {
  badminton: number;
  pickleball: number;
  courtsByType: Record<string, number>;
  totalCourts: number;
  warnings: number;
  courtAreaFt2: number;
}

export function tally(
  items: PlacedItem[],
  mode: FootprintMode,
  diag: Record<string, Diagnosis>,
): Tally {
  const t: Tally = {
    badminton: 0,
    pickleball: 0,
    courtsByType: {},
    totalCourts: 0,
    warnings: 0,
    courtAreaFt2: 0,
  };

  for (const it of items) {
    const d = diag[it.id];
    if (d && d.warnings.length > 0) t.warnings += d.warnings.length;
    if (it.category !== "court") continue;

    const valid = d && d.warnings.length === 0;
    if (!valid) continue;

    t.totalCourts += 1;
    t.courtsByType[it.type] = (t.courtsByType[it.type] ?? 0) + 1;
    if (it.type === "badminton") t.badminton += 1;
    if (it.type.startsWith("pickleball")) t.pickleball += 1;

    const r = resolveRect(it, mode);
    t.courtAreaFt2 += r.wFt * r.hFt;
  }

  return t;
}
