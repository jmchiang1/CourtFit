import { create } from "zustand";
import { Category, GRID, ROOMS, baseFootprint, makeZone } from "./config";
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
  selectedId: string | null;
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
  resizeItem: (id: string, rect: { xFt: number; yFt: number; wFt: number; hFt: number }) => void;
  rotateItem: (id: string) => void;
  duplicateItem: (id: string) => void;
  removeItem: (id: string) => void;
  renameRoom: (id: string, label: string) => void;
  select: (id: string | null) => void;

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
    opts: { history?: boolean; select?: string | null } = {},
  ) => {
    const state = get();
    const nextItems = updater(state.items);
    const patch: Partial<PlannerState> = { items: nextItems, dirty: true };
    if (opts.history) {
      patch.past = [...state.past, state.items].slice(-60);
      patch.future = [];
    }
    if (opts.select !== undefined) patch.selectedId = opts.select;
    set(patch);
  };

  return {
    items: [],
    footprintMode: "footprint",
    name: "Floor plan",
    building: { name: "Floor plan", lengthFt: 150, widthFt: 100 },
    zones: [makeZone(100, 24)],

    selectedId: null,
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
        selectedId: null,
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
          selectedId: null,
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
          selectedId: null,
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

    select: (id) => set({ selectedId: id }),

    setFootprintMode: (m) => set({ footprintMode: m, dirty: true }),
    toggleSnap: () => set((s) => ({ snapOn: !s.snapOn })),
    toggleShowPlayLines: () => set((s) => ({ showPlayLines: !s.showPlayLines })),
    setName: (name) => set({ name, dirty: true }),

    setBuildingSize: (lengthFt, widthFt) => {
      const s = get();
      const L = Math.max(20, Math.round(lengthFt));
      const W = Math.max(20, Math.round(widthFt));
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
