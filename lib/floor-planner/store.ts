import { create } from "zustand";
import { Category, GRID, MIN_BUILDING_FT, ROOMS, baseFootprint, makeZone } from "./config";
import type {
  BuildingDef,
  FloorPlanLayout,
  FootprintMode,
  PlacedItem,
  ZoneDef,
} from "./types";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.floor(performance.now())}-${Math.floor(Math.random() * 1e6)}`;

export const snap = (v: number, on: boolean) =>
  on ? Math.round(v / GRID.snapFt) * GRID.snapFt : Math.round(v * 100) / 100;

interface PlannerState {
  // serializable plan state
  items: PlacedItem[];
  footprintMode: FootprintMode;
  name: string;
  building: BuildingDef;
  zones: ZoneDef[];

  // editor-only state
  selectedIds: string[];
  snapOn: boolean;
  showPlayLines: boolean;
  past: PlacedItem[][];
  future: PlacedItem[][];
  spawnSeq: number;
  dirty: boolean; // unsaved changes since last init / markSaved

  // lifecycle
  init: (layout: FloorPlanLayout) => void;
  serialize: () => FloorPlanLayout;
  markSaved: () => void;

  // gesture history
  beginGesture: () => void;
  undo: () => void;
  redo: () => void;

  // mutations
  addItem: (category: Category, type: string) => void;
  moveItem: (id: string, xFt: number, yFt: number) => void;
  /** Set absolute positions for several items at once (used for group drag). */
  moveItems: (updates: { id: string; xFt: number; yFt: number }[]) => void;
  resizeItem: (id: string, rect: { xFt: number; yFt: number; wFt: number; hFt: number }) => void;
  rotateItem: (id: string) => void;
  rotateItems: (ids: string[]) => void;
  duplicateItem: (id: string) => void;
  duplicateItems: (ids: string[]) => void;
  removeItem: (id: string) => void;
  removeItems: (ids: string[]) => void;
  renameRoom: (id: string, label: string) => void;
  /** Select exactly one item, or clear when passed null. */
  select: (id: string | null) => void;
  /** Add/remove one item from the current selection (shift-click). */
  toggleSelect: (id: string) => void;
  /** Replace the whole selection (marquee). */
  setSelection: (ids: string[]) => void;

  // global toggles + envelope
  setFootprintMode: (m: FootprintMode) => void;
  toggleSnap: () => void;
  toggleShowPlayLines: () => void;
  setName: (name: string) => void;
  setBuildingSize: (lengthFt: number, widthFt: number) => void;
  clear: () => void;
}

export const usePlanner = create<PlannerState>((set, get) => {
  /** Apply an items mutation and mark the plan dirty. */
  const commit = (
    updater: (items: PlacedItem[]) => PlacedItem[],
    opts: { history?: boolean; select?: string | string[] | null } = {},
  ) => {
    const state = get();
    const nextItems = updater(state.items);
    const patch: Partial<PlannerState> = { items: nextItems, dirty: true };
    if (opts.history) {
      patch.past = [...state.past, state.items].slice(-60);
      patch.future = [];
    }
    if (opts.select !== undefined) {
      patch.selectedIds =
        opts.select == null ? [] : Array.isArray(opts.select) ? opts.select : [opts.select];
    }
    set(patch);
  };

  return {
    items: [],
    footprintMode: "footprint",
    name: "Floor plan",
    building: { name: "Floor plan", lengthFt: 150, widthFt: 100 },
    zones: [makeZone(100, 24)],

    selectedIds: [],
    snapOn: true,
    showPlayLines: true,
    past: [],
    future: [],
    spawnSeq: 0,
    dirty: false,

    init: (layout) =>
      set({
        items: layout.items.map((it) => ({ ...it })),
        footprintMode: layout.footprintMode,
        name: layout.name,
        building: layout.building,
        zones: layout.zones,
        selectedIds: [],
        past: [],
        future: [],
        spawnSeq: 0,
        dirty: false,
      }),

    serialize: () => {
      const s = get();
      return {
        version: 1,
        name: s.name,
        footprintMode: s.footprintMode,
        building: s.building,
        zones: s.zones,
        items: s.items,
      };
    },

    markSaved: () => set({ dirty: false }),

    beginGesture: () =>
      set((s) => ({ past: [...s.past, s.items].slice(-60), future: [] })),

    undo: () =>
      set((s) => {
        if (s.past.length === 0) return {};
        const prev = s.past[s.past.length - 1];
        return {
          items: prev,
          past: s.past.slice(0, -1),
          future: [s.items, ...s.future].slice(0, 60),
          selectedIds: [],
          dirty: true,
        };
      }),

    redo: () =>
      set((s) => {
        if (s.future.length === 0) return {};
        const next = s.future[0];
        return {
          items: next,
          future: s.future.slice(1),
          past: [...s.past, s.items].slice(-60),
          selectedIds: [],
          dirty: true,
        };
      }),

    addItem: (category, type) => {
      const s = get();
      const base = baseFootprint(category, type, s.footprintMode);
      const seq = s.spawnSeq;
      const step = (seq % 6) * GRID.snapFt;
      const x = snap(24 + step, s.snapOn);
      const y = snap(24 + step, s.snapOn);
      const item: PlacedItem = {
        id: uid(),
        category,
        type,
        xFt: Math.min(x, Math.max(0, s.building.lengthFt - base.w)),
        yFt: Math.min(y, Math.max(0, s.building.widthFt - base.h)),
        rotated: false,
        ...(category === "room" ? { wFt: base.w, hFt: base.h } : {}),
      };
      set({ spawnSeq: seq + 1 });
      commit((items) => [...items, item], { history: true, select: item.id });
    },

    moveItem: (id, xFt, yFt) =>
      commit((items) =>
        items.map((it) => (it.id === id ? { ...it, xFt, yFt } : it)),
      ),

    resizeItem: (id, rect) =>
      commit((items) =>
        items.map((it) =>
          it.id === id
            ? { ...it, xFt: rect.xFt, yFt: rect.yFt, wFt: rect.wFt, hFt: rect.hFt }
            : it,
        ),
      ),

    rotateItem: (id) =>
      commit(
        (items) =>
          items.map((it) => {
            if (it.id !== id) return it;
            if (it.category === "room") {
              return { ...it, wFt: it.hFt, hFt: it.wFt };
            }
            const swapped =
              it.wFt != null && it.hFt != null
                ? { wFt: it.hFt, hFt: it.wFt }
                : {};
            return { ...it, rotated: !it.rotated, ...swapped };
          }),
        { history: true },
      ),

    duplicateItem: (id) => {
      const s = get();
      const src = s.items.find((it) => it.id === id);
      if (!src) return;
      const copy: PlacedItem = {
        ...src,
        id: uid(),
        xFt: snap(src.xFt + GRID.snapFt, s.snapOn),
        yFt: snap(src.yFt + GRID.snapFt, s.snapOn),
      };
      commit((items) => [...items, copy], { history: true, select: copy.id });
    },

    removeItem: (id) =>
      commit((items) => items.filter((it) => it.id !== id), {
        history: true,
        select: null,
      }),

    renameRoom: (id, label) =>
      commit((items) =>
        items.map((it) => (it.id === id ? { ...it, label } : it)),
      ),

    moveItems: (updates) =>
      commit((items) =>
        items.map((it) => {
          const u = updates.find((u) => u.id === it.id);
          return u ? { ...it, xFt: u.xFt, yFt: u.yFt } : it;
        }),
      ),

    rotateItems: (ids) =>
      commit(
        (items) =>
          items.map((it) => {
            if (!ids.includes(it.id)) return it;
            if (it.category === "room") return { ...it, wFt: it.hFt, hFt: it.wFt };
            const swapped =
              it.wFt != null && it.hFt != null ? { wFt: it.hFt, hFt: it.wFt } : {};
            return { ...it, rotated: !it.rotated, ...swapped };
          }),
        { history: true },
      ),

    duplicateItems: (ids) => {
      const s = get();
      const copies: PlacedItem[] = [];
      for (const src of s.items) {
        if (!ids.includes(src.id)) continue;
        copies.push({
          ...src,
          id: uid(),
          xFt: snap(src.xFt + GRID.snapFt, s.snapOn),
          yFt: snap(src.yFt + GRID.snapFt, s.snapOn),
        });
      }
      if (copies.length === 0) return;
      commit((items) => [...items, ...copies], {
        history: true,
        select: copies.map((c) => c.id),
      });
    },

    removeItems: (ids) =>
      commit((items) => items.filter((it) => !ids.includes(it.id)), {
        history: true,
        select: null,
      }),

    select: (id) => set({ selectedIds: id ? [id] : [] }),
    toggleSelect: (id) =>
      set((s) => ({
        selectedIds: s.selectedIds.includes(id)
          ? s.selectedIds.filter((x) => x !== id)
          : [...s.selectedIds, id],
      })),
    setSelection: (ids) => set({ selectedIds: ids }),

    setFootprintMode: (m) => set({ footprintMode: m, dirty: true }),
    toggleSnap: () => set((s) => ({ snapOn: !s.snapOn })),
    toggleShowPlayLines: () => set((s) => ({ showPlayLines: !s.showPlayLines })),
    setName: (name) => set({ name, dirty: true }),

    setBuildingSize: (lengthFt, widthFt) => {
      const s = get();
      const L = Math.max(MIN_BUILDING_FT, Math.round(lengthFt));
      const W = Math.max(MIN_BUILDING_FT, Math.round(widthFt));
      const building: BuildingDef = { ...s.building, lengthFt: L, widthFt: W };
      // keep a single band spanning the full depth; leave multi-zone sites alone
      const zones =
        s.zones.length <= 1
          ? [{ ...(s.zones[0] ?? makeZone(W, 24)), offsetFt: 0, widthFt: W }]
          : s.zones;
      set({ building, zones, dirty: true });
    },

    clear: () => commit(() => [], { history: true, select: null }),
  };
});
