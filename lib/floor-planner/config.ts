/**
 * ─────────────────────────────────────────────────────────────────────────
 *  CONFIG — edit everything about the building, courts, furniture and rooms
 *  here. All dimensions are in FEET. The stage renders at `pxPerFt`.
 *
 *  For courts/furniture:  w = length (long axis), h = width (short axis).
 *  A 90° rotation swaps w and h.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { BuildingDef, ZoneDef } from "./types";

export const GRID = {
  snapFt: 2, // snap-to-grid increment
  minorFt: 2, // faint grid line every 2 ft (matches the snap increment)
  majorFt: 10, // bold grid line every 10 ft
};

/** Smallest allowed building dimension (ft), in either axis. */
export const MIN_BUILDING_FT = 20;

/** Base render scale — the plan renders at `BASE_PPF * zoom` pixels per foot. */
export const BASE_PPF = 3;

/** A neutral fallback envelope used when a property has no saved layout yet. */
export const DEFAULT_BUILDING: BuildingDef = {
  name: "Floor plan",
  lengthFt: 150,
  widthFt: 100,
};

/**
 * A single full-depth ceiling band. Custom buildings (one per property) use a
 * single zone seeded from the listing's clear height; multi-zone sites are the
 * exception (e.g. the Apollo demo).
 */
export function makeZone(widthFt: number, ceilingFt: number): ZoneDef {
  return {
    id: "main",
    label: "Building",
    offsetFt: 0,
    widthFt,
    ceilingFt,
    badmintonOk: ceilingFt >= 24,
    outdoor: false,
    // CSS colors (consumed as inline styles), so they follow the light/dark theme.
    fill: "color-mix(in oklab, var(--muted-foreground) 5%, transparent)",
    stroke: "var(--muted-foreground)",
  };
}

export const DEFAULT_ZONES: ZoneDef[] = [makeZone(100, 24)];

/**
 * COURTS — every court has two footprints:
 *   play      = painted lines only (what you see on the floor)
 *   footprint = play area + run-off / safety clearance (plan capacity vs THIS)
 * Validate capacity & spacing against `footprint`, never `play`.
 */
export const COURTS = {
  badminton: {
    label: "Badminton",
    short: "BAD",
    play: { w: 44, h: 20 }, // painted doubles lines, 13.4 m × 6.1 m (20 × 44)
    footprint: { w: 50.5, h: 23.3 }, // full court mat, 15.4 m × 7.1 m (23.3 × 50.5)
    minCeilingFt: 24, // 24 ft min; 26–30+ for club play; BWF intl ≈ 39 ft
    color: "var(--court-fill)",
  },
  pickleball: {
    label: "Pickleball — court",
    short: "PICK",
    play: { w: 44, h: 20 }, // painted lines (20 × 44)
    footprint: { w: 44, h: 22 }, // court itself only (22 × 44)
    minCeilingFt: 18,
    color: "var(--pickle-fill)",
  },
  pickleballRec: {
    label: "Pickleball — rec",
    short: "PICK",
    play: { w: 44, h: 20 },
    footprint: { w: 52, h: 24 }, // recommended recreational spacing (24 × 52)
    minCeilingFt: 18,
    color: "var(--pickle-fill)",
  },
  pickleballPro: {
    label: "Pickleball — tournament",
    short: "PICK",
    play: { w: 44, h: 20 },
    footprint: { w: 60, h: 30 }, // official tournament dims incl. edges (30 × 60)
    minCeilingFt: 18,
    color: "var(--pickle-fill)",
  },
  tennis: {
    label: "Tennis",
    short: "TEN",
    play: { w: 78, h: 36 }, // doubles court
    footprint: { w: 120, h: 60 }, // recommended total court incl. run-back/side
    minCeilingFt: 30, // indoor clearance over the court
    color: "#a65a2e",
  },
} as const;

export type CourtKey = keyof typeof COURTS;

/**
 * Element colors are CSS color strings (hex or `var(--…)`), used only in inline
 * styles / SVG. Consumers derive tints with `color-mix()`, never by appending a
 * hex alpha, so theme vars work here. Hexes are mid-tones that read on both the
 * light and the dark floor.
 */

/** Furniture & barriers. `linear` items are thin (nets/fences/glass). */
export const ITEMS = {
  reception: { label: "Reception", w: 12, h: 4, color: "#2f8f6e" },
  sofa: { label: "Lounge sofa", w: 8, h: 3, color: "#c78a2a" },
  table: { label: "Café table", w: 4, h: 4, color: "#c9a55c", round: true },
  proshop: { label: "Pro shop", w: 9, h: 3, color: "#8a8f88" },
  lockers: { label: "Lockers", w: 9, h: 2.5, color: "#8a8f88" },
  bench: { label: "Bench", w: 8, h: 1.6, color: "#8a8f88" },
  bleacher: { label: "Bleachers", w: 15, h: 6, color: "#8a8f88" },
  plant: { label: "Plant", w: 3, h: 3, color: "#4f9a5c", round: true },
  net: { label: "Court net", w: 22, h: 0.8, color: "var(--court)", linear: true },
  fence: { label: "Fence panel", w: 20, h: 0.9, color: "var(--muted-foreground)", linear: true },
  glass: { label: "Viewing glass", w: 20, h: 0.6, color: "#6fa3d6", linear: true },
  entry: { label: "Entry / door", w: 6, h: 2, color: "#c8503f" },
  vending: { label: "Vending", w: 4, h: 2.5, color: "#8a8f88" },
} as const;

export type ItemKey = keyof typeof ITEMS;

/**
 * ROOMS — enclosed, resizable spaces you draw on the plan (bathroom, office…).
 * `w`/`h` are the DEFAULT size when spawned; rooms are freely resizable after.
 */
export const ROOMS = {
  restroom: { label: "Restroom", w: 14, h: 12, fill: "#3d6ea5", icon: "🚻" },
  office: { label: "Office", w: 14, h: 12, fill: "#6b7bb0", icon: "🗄" },
  locker: { label: "Locker room", w: 22, h: 16, fill: "#4a8c7a", icon: "🚿" },
  storage: { label: "Storage", w: 12, h: 10, fill: "#8a8577", icon: "📦" },
  lobby: { label: "Lobby / reception", w: 30, h: 20, fill: "#2f8f6e", icon: "🛎" },
  lounge: { label: "Lounge area", w: 24, h: 18, fill: "#c08a2e", icon: "🛋" },
  tenant: { label: "Tenant / unit", w: 40, h: 30, fill: "#b4531f", icon: "🏬" },
} as const;

export type RoomKey = keyof typeof ROOMS;

export type Category = "court" | "item" | "room";

/**
 * The catalogue name for any piece — the fallback whenever a placed item has no
 * custom `label` of its own.
 */
export function defaultLabel(category: Category, type: string): string {
  if (category === "court") return COURTS[type as CourtKey].label;
  if (category === "item") return ITEMS[type as ItemKey].label;
  return ROOMS[type as RoomKey].label;
}

/** Look up the base (un-rotated) footprint of any catalogue entry, in feet. */
export function baseFootprint(
  category: Category,
  type: string,
  mode: "play" | "footprint",
): { w: number; h: number } {
  if (category === "court") {
    const c = COURTS[type as CourtKey];
    return mode === "play" ? { ...c.play } : { ...c.footprint };
  }
  if (category === "item") {
    const i = ITEMS[type as ItemKey];
    return { w: i.w, h: i.h };
  }
  const r = ROOMS[type as RoomKey];
  return { w: r.w, h: r.h };
}
