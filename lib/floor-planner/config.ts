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
    fill: "#6b727a14",
    stroke: "#7c8590",
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
    color: "#5a8a3c",
  },
  pickleball: {
    label: "Pickleball — court",
    short: "PICK",
    play: { w: 44, h: 20 }, // painted lines (20 × 44)
    footprint: { w: 44, h: 22 }, // court itself only (22 × 44)
    minCeilingFt: 18,
    color: "#2f6db0",
  },
  pickleballRec: {
    label: "Pickleball — rec",
    short: "PICK",
    play: { w: 44, h: 20 },
    footprint: { w: 52, h: 24 }, // recommended recreational spacing (24 × 52)
    minCeilingFt: 18,
    color: "#2f6db0",
  },
  pickleballPro: {
    label: "Pickleball — tournament",
    short: "PICK",
    play: { w: 44, h: 20 },
    footprint: { w: 60, h: 30 }, // official tournament dims incl. edges (30 × 60)
    minCeilingFt: 18,
    color: "#2f6db0",
  },
  tennis: {
    label: "Tennis",
    short: "TEN",
    play: { w: 78, h: 36 }, // doubles court
    footprint: { w: 120, h: 60 }, // recommended total court incl. run-back/side
    minCeilingFt: 30, // indoor clearance over the court
    color: "#b4531f",
  },
} as const;

export type CourtKey = keyof typeof COURTS;

/** Furniture & barriers. `linear` items are thin (nets/fences/glass). */
export const ITEMS = {
  reception: { label: "Reception", w: 12, h: 4, color: "#0f6e56" },
  sofa: { label: "Lounge sofa", w: 8, h: 3, color: "#c78a2a" },
  table: { label: "Café table", w: 4, h: 4, color: "#e6cd93", round: true },
  proshop: { label: "Pro shop", w: 9, h: 3, color: "#9a978c" },
  lockers: { label: "Lockers", w: 9, h: 2.5, color: "#9a978c" },
  bench: { label: "Bench", w: 8, h: 1.6, color: "#9a978c" },
  bleacher: { label: "Bleachers", w: 15, h: 6, color: "#9a978c" },
  plant: { label: "Plant", w: 3, h: 3, color: "#5a8a3c", round: true },
  net: { label: "Court net", w: 22, h: 0.8, color: "#3b6d11", linear: true },
  fence: { label: "Fence panel", w: 20, h: 0.9, color: "#2b2c28", linear: true },
  glass: { label: "Viewing glass", w: 20, h: 0.6, color: "#7fb0d8", linear: true },
  entry: { label: "Entry / door", w: 6, h: 2, color: "#c0392b" },
  vending: { label: "Vending", w: 4, h: 2.5, color: "#9a978c" },
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
  lobby: { label: "Lobby / reception", w: 30, h: 20, fill: "#2f8f6e", icon: "🛋" },
  tenant: { label: "Tenant / unit", w: 40, h: 30, fill: "#b4531f", icon: "🏬" },
} as const;

export type RoomKey = keyof typeof ROOMS;

export type Category = "court" | "item" | "room";

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
