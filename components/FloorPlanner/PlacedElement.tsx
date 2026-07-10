"use client";

import { useRef } from "react";
import { COURTS, CourtKey, ITEMS, ItemKey, ROOMS, RoomKey } from "@/lib/floor-planner/config";
import type { FootprintMode, PlacedItem, Rect } from "@/lib/floor-planner/types";
import { playInset, resolveRect } from "@/lib/floor-planner/geometry";
import { snap, usePlanner } from "@/lib/floor-planner/store";
import type { WarningKind } from "@/lib/floor-planner/geometry";

interface Props {
  item: PlacedItem;
  ppf: number;
  mode: FootprintMode;
  selected: boolean;
  warnings: WarningKind[];
}

/** Smallest each category can be resized to (feet). */
function minSizeFt(category: string): number {
  if (category === "room") return 6;
  if (category === "court") return 10;
  return 2; // furniture / barriers
}

type Dir = { dx: -1 | 0 | 1; dy: -1 | 0 | 1; cursor: string };
const HANDLES: Dir[] = [
  { dx: -1, dy: -1, cursor: "nwse-resize" },
  { dx: 0, dy: -1, cursor: "ns-resize" },
  { dx: 1, dy: -1, cursor: "nesw-resize" },
  { dx: 1, dy: 0, cursor: "ew-resize" },
  { dx: 1, dy: 1, cursor: "nwse-resize" },
  { dx: 0, dy: 1, cursor: "ns-resize" },
  { dx: -1, dy: 1, cursor: "nesw-resize" },
  { dx: -1, dy: 0, cursor: "ew-resize" },
];

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export default function PlacedElement({ item, ppf, mode, selected, warnings }: Props) {
  const rect = resolveRect(item, mode);
  const { moveItem, resizeItem, select, beginGesture, snapOn, showPlayLines, building } =
    usePlanner();

  const minFt = minSizeFt(item.category);

  const drag = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  );
  const rz = useRef<{ dir: Dir; startX: number; startY: number; orig: Rect } | null>(null);

  const hasWarning = warnings.length > 0;

  function onBodyPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    select(item.id);
    beginGesture();
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* pointer not active (e.g. synthetic event) — capture is best-effort */
    }
    drag.current = { startX: e.clientX, startY: e.clientY, origX: item.xFt, origY: item.yFt };
  }

  function onBodyPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dxFt = (e.clientX - d.startX) / ppf;
    const dyFt = (e.clientY - d.startY) / ppf;
    let nx = snap(d.origX + dxFt, snapOn);
    let ny = snap(d.origY + dyFt, snapOn);
    nx = clamp(nx, -rect.wFt * 0.5, building.lengthFt - rect.wFt * 0.5);
    ny = clamp(ny, -rect.hFt * 0.5, building.widthFt - rect.hFt * 0.5);
    moveItem(item.id, nx, ny);
  }

  function onBodyPointerUp(e: React.PointerEvent) {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    drag.current = null;
  }

  function onHandleDown(e: React.PointerEvent, dir: Dir) {
    if (e.button !== 0) return;
    e.stopPropagation();
    select(item.id);
    beginGesture();
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* best-effort pointer capture */
    }
    rz.current = {
      dir,
      startX: e.clientX,
      startY: e.clientY,
      // resize is stored in footprint space so play/footprint modes stay in sync
      orig: resolveRect(item, "footprint"),
    };
  }

  function onHandleMove(e: React.PointerEvent) {
    const r = rz.current;
    if (!r) return;
    const dxFt = (e.clientX - r.startX) / ppf;
    const dyFt = (e.clientY - r.startY) / ppf;
    let { xFt, yFt, wFt, hFt } = r.orig;

    if (r.dir.dx === 1) wFt = r.orig.wFt + dxFt;
    if (r.dir.dx === -1) {
      wFt = r.orig.wFt - dxFt;
      xFt = r.orig.xFt + dxFt;
    }
    if (r.dir.dy === 1) hFt = r.orig.hFt + dyFt;
    if (r.dir.dy === -1) {
      hFt = r.orig.hFt - dyFt;
      yFt = r.orig.yFt + dyFt;
    }

    if (r.dir.dx !== 0) {
      const right = r.dir.dx === 1 ? snap(xFt + wFt, snapOn) : r.orig.xFt + r.orig.wFt;
      const left = r.dir.dx === -1 ? snap(xFt, snapOn) : r.orig.xFt;
      xFt = left;
      wFt = Math.max(minFt, right - left);
    }
    if (r.dir.dy !== 0) {
      const bottom = r.dir.dy === 1 ? snap(yFt + hFt, snapOn) : r.orig.yFt + r.orig.hFt;
      const top = r.dir.dy === -1 ? snap(yFt, snapOn) : r.orig.yFt;
      yFt = top;
      hFt = Math.max(minFt, bottom - top);
    }

    resizeItem(item.id, { xFt, yFt, wFt, hFt });
  }

  function onHandleUp(e: React.PointerEvent) {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    rz.current = null;
  }

  const left = rect.xFt * ppf;
  const top = rect.yFt * ppf;
  const w = rect.wFt * ppf;
  const h = rect.hFt * ppf;

  const selRing = selected ? "0 0 0 2px #0a0e14, 0 0 0 4px #38bdf8" : "none";

  let body: React.ReactNode = null;

  if (item.category === "court") {
    const c = COURTS[item.type as CourtKey];
    const play = playInset(item, mode)!;
    const playLeft = (play.xFt - rect.xFt) * ppf;
    const playTop = (play.yFt - rect.yFt) * ppf;
    const playW = play.wFt * ppf;
    const playH = play.hFt * ppf;
    const netHorizontal = play.wFt >= play.hFt;
    body = (
      <>
        <div
          className="absolute inset-0 rounded-[2px]"
          style={{
            background: hasWarning ? "#ef444422" : `${c.color}1f`,
            border: hasWarning ? "1.5px dashed #ef4444" : `1px solid ${c.color}aa`,
          }}
        />
        {(showPlayLines || mode === "play") && (
          <div
            className="absolute"
            style={{
              left: playLeft,
              top: playTop,
              width: playW,
              height: playH,
              border: `1.5px solid ${c.color}`,
              background: `${c.color}12`,
            }}
          >
            <div
              className="absolute bg-current"
              style={{
                color: c.color,
                ...(netHorizontal
                  ? { left: "50%", top: 0, bottom: 0, width: 1.5 }
                  : { top: "50%", left: 0, right: 0, height: 1.5 }),
              }}
            />
          </div>
        )}
        <div
          className="pointer-events-none absolute left-1 top-0.5 select-none font-mono text-[9px] font-semibold leading-tight"
          style={{ color: c.color, textShadow: "0 1px 2px rgba(244,241,234,.7)" }}
        >
          {c.short}
        </div>
      </>
    );
  } else if (item.category === "item") {
    const it = ITEMS[item.type as ItemKey];
    const round = "round" in it && it.round;
    const linear = "linear" in it && it.linear;
    body = (
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{
          background: linear ? it.color : `${it.color}dd`,
          border: `1px solid ${it.color}`,
          borderRadius: round ? "50%" : 3,
        }}
      >
        {!linear && w > 34 && (
          <span className="pointer-events-none select-none px-1 text-center text-[8px] font-medium leading-none text-white/95">
            {it.label}
          </span>
        )}
      </div>
    );
  } else {
    const r = ROOMS[item.type as RoomKey];
    const label = item.label ?? r.label;
    body = (
      <div
        className="absolute inset-0 overflow-hidden rounded-[2px]"
        style={{
          background: `${r.fill}26`,
          border: `2px solid ${r.fill}`,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,.35)",
        }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-center">
          <span className="pointer-events-none select-none text-[13px] leading-none">{r.icon}</span>
          {h > 26 && (
            <span
              className="pointer-events-none select-none text-[9px] font-semibold leading-tight"
              style={{ color: r.fill }}
            >
              {label}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={-1}
      onPointerDown={onBodyPointerDown}
      onPointerMove={onBodyPointerMove}
      onPointerUp={onBodyPointerUp}
      className="absolute touch-none"
      style={{
        left,
        top,
        width: w,
        height: h,
        cursor: drag.current ? "grabbing" : "grab",
        boxShadow: selRing,
        zIndex: selected ? 40 : item.category === "room" ? 10 : 20,
      }}
    >
      {body}

      {selected && (
        <div className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap rounded bg-[#0d1117] px-1.5 py-0.5 font-mono text-[10px] text-sky-300 shadow">
          {Math.round(rect.wFt)}′ × {Math.round(rect.hFt)}′
        </div>
      )}

      {selected &&
        HANDLES.map((dir, i) => {
          const hx = dir.dx === -1 ? 0 : dir.dx === 1 ? w : w / 2;
          const hy = dir.dy === -1 ? 0 : dir.dy === 1 ? h : h / 2;
          return (
            <div
              key={i}
              onPointerDown={(e) => onHandleDown(e, dir)}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              className="absolute z-50 h-2.5 w-2.5 rounded-full border border-sky-400 bg-white touch-none"
              style={{ left: hx - 5, top: hy - 5, cursor: dir.cursor }}
            />
          );
        })}
    </div>
  );
}
