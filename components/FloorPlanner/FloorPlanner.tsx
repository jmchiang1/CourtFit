"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BASE_PPF } from "@/lib/floor-planner/config";
import { diagnose, tally } from "@/lib/floor-planner/geometry";
import { usePlanner } from "@/lib/floor-planner/store";
import Palette from "./Palette";
import Stage from "./Stage";
import Toolbar from "./Toolbar";
import Readouts from "./Readouts";

interface Props {
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}

export default function FloorPlanner({ onClose, onSave, saving }: Props) {
  const items = usePlanner((s) => s.items);
  const footprintMode = usePlanner((s) => s.footprintMode);
  const selectedId = usePlanner((s) => s.selectedId);
  const building = usePlanner((s) => s.building);
  const zones = usePlanner((s) => s.zones);
  const select = usePlanner((s) => s.select);

  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const ppf = BASE_PPF * zoom;

  const diag = useMemo(
    () => diagnose(items, footprintMode, building, zones),
    [items, footprintMode, building, zones],
  );
  const tallyData = useMemo(
    () => tally(items, footprintMode, diag),
    [items, footprintMode, diag],
  );

  const onFit = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pad = 150;
    const availW = el.clientWidth - pad;
    const availH = el.clientHeight - pad;
    const z = Math.min(
      availW / (building.lengthFt * BASE_PPF),
      availH / (building.widthFt * BASE_PPF),
    );
    setZoom(Math.max(0.3, Math.min(3, +z.toFixed(2))));
    el.scrollTo({ top: 0, left: 0 });
  }, [building.lengthFt, building.widthFt]);

  // fit to the envelope on open + focus for keyboard shortcuts
  useEffect(() => {
    rootRef.current?.focus();
    const t = setTimeout(onFit, 40);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    const typing =
      t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    const s = usePlanner.getState();
    const mod = e.metaKey || e.ctrlKey;

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // never let it close the property modal behind us
      if (typing) t.blur();
      else if (s.selectedId) s.select(null);
      else onClose();
      return;
    }

    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) s.redo();
      else s.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      e.stopPropagation();
      s.redo();
      return;
    }
    if (typing) return;

    if (mod && e.key.toLowerCase() === "d" && s.selectedId) {
      e.preventDefault();
      s.duplicateItem(s.selectedId);
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && s.selectedId) {
      e.preventDefault();
      s.removeItem(s.selectedId);
      return;
    }
    if (e.key.toLowerCase() === "r" && s.selectedId) {
      s.rotateItem(s.selectedId);
    }
  };

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="flex h-full w-full overflow-hidden bg-[#0a0e14] text-neutral-200 outline-none"
    >
      <Palette />

      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar
          zoom={zoom}
          setZoom={setZoom}
          onFit={onFit}
          onSave={onSave}
          onClose={onClose}
          saving={saving}
        />

        <div
          ref={scrollRef}
          className="relative min-h-0 flex-1 overflow-auto"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,.04) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        >
          <Stage
            items={items}
            ppf={ppf}
            mode={footprintMode}
            selectedId={selectedId}
            diag={diag}
            building={building}
            zones={zones}
            onBackgroundPointerDown={() => select(null)}
          />

          <div className="pointer-events-none sticky bottom-3 left-3 z-10 ml-3 inline-flex flex-col gap-1 rounded-lg border border-[#232a34] bg-[#161b22]/90 px-3 py-2 text-[10px] text-neutral-400 backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-3.5 rounded-sm border border-dashed border-red-500 bg-red-500/20" />
              Warning — low ceiling / overlap / out of bounds
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-3.5 rounded-sm border border-sky-400" />
              Drag to move · <span className="text-neutral-500">R</span> rotate ·{" "}
              <span className="text-neutral-500">Del</span> remove
            </div>
          </div>
        </div>
      </div>

      <Readouts tally={tallyData} diag={diag} />
    </div>
  );
}
