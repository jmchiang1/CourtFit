"use client";

import { useEffect, useState } from "react";
import { usePlanner } from "@/lib/floor-planner/store";
import { MIN_BUILDING_FT } from "@/lib/floor-planner/config";

interface Props {
  zoom: number;
  setZoom: (z: number) => void;
  onFit: () => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}

function Seg({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`h-7 rounded-md px-2.5 text-[12px] font-medium transition ${
        active
          ? "bg-primary text-primary-foreground shadow-xs"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * A building-dimension field (ft). Holds a free-text draft while focused so the
 * user can type or backspace freely — the min-size clamp is only applied when
 * the edit is committed (blur or Enter), not on every keystroke. Committing an
 * out-of-range or empty value snaps the field to the clamped result.
 */
function DimensionInput({
  value,
  onCommit,
  title,
}: {
  value: number;
  onCommit: (v: number) => void;
  title: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  // Re-sync from the committed value whenever it changes externally, but never
  // while the user is mid-edit (that would clobber what they're typing).
  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(n)) {
      setDraft(String(value)); // invalid → revert to the last good value
      return;
    }
    const clamped = Math.max(MIN_BUILDING_FT, Math.round(n));
    setDraft(String(clamped));
    onCommit(clamped);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={MIN_BUILDING_FT}
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="h-7 w-16 rounded-md border border-input bg-background px-1.5 text-center text-[12px] tabular-nums text-foreground outline-none focus:border-ring"
      title={title}
    />
  );
}

function Btn({
  onClick,
  children,
  title,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="h-7 rounded-md border border-border px-2.5 text-[12px] font-medium text-foreground shadow-xs transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export default function Toolbar({ zoom, setZoom, onFit, onSave, onClose, saving }: Props) {
  const {
    name,
    setName,
    building,
    setBuildingSize,
    footprintMode,
    setFootprintMode,
    snapOn,
    toggleSnap,
    showPlayLines,
    toggleShowPlayLines,
    undo,
    redo,
    past,
    future,
    dirty,
  } = usePlanner();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-panel px-3 py-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        spellCheck={false}
        className="h-7 w-44 rounded-md border border-input bg-background px-2 text-[13px] font-medium text-foreground outline-none focus:border-ring"
      />

      <div className="h-5 w-px bg-border" />

      {/* building envelope */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="mr-0.5">Building</span>
        <DimensionInput
          value={building.lengthFt}
          onCommit={(v) => setBuildingSize(v, building.widthFt)}
          title="Length (ft)"
        />
        <span>×</span>
        <DimensionInput
          value={building.widthFt}
          onCommit={(v) => setBuildingSize(building.lengthFt, v)}
          title="Width (ft)"
        />
        <span>ft</span>
      </div>

      <div className="h-5 w-px bg-border" />

      <div className="flex rounded-lg bg-muted p-0.5">
        <Seg
          active={footprintMode === "footprint"}
          onClick={() => setFootprintMode("footprint")}
          title="Full footprint incl. run-off (validate capacity against this)"
        >
          Footprint
        </Seg>
        <Seg
          active={footprintMode === "play"}
          onClick={() => setFootprintMode("play")}
          title="Painted lines only"
        >
          Play lines
        </Seg>
      </div>

      <Seg active={snapOn} onClick={toggleSnap} title="Snap to 2 ft grid">
        Snap 2′
      </Seg>
      <Seg active={showPlayLines} onClick={toggleShowPlayLines} title="Draw inner court lines">
        Court lines
      </Seg>

      <div className="h-5 w-px bg-border" />

      <div className="flex items-center gap-1">
        <Btn onClick={() => setZoom(Math.max(0.3, +(zoom - 0.15).toFixed(2)))} title="Zoom out">
          −
        </Btn>
        <span className="w-11 text-center text-[11px] tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Btn onClick={() => setZoom(Math.min(3, +(zoom + 0.15).toFixed(2)))} title="Zoom in">
          +
        </Btn>
        <Btn onClick={onFit} title="Fit to screen">
          Fit
        </Btn>
      </div>

      <div className="h-5 w-px bg-border" />

      <div className="flex items-center gap-1">
        <Btn onClick={undo} disabled={past.length === 0} title="Undo (⌘Z)">
          Undo
        </Btn>
        <Btn onClick={redo} disabled={future.length === 0} title="Redo (⌘⇧Z)">
          Redo
        </Btn>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={onSave}
          disabled={saving || !dirty}
          className="h-7 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : dirty ? "Save" : "Saved"}
        </button>
        <Btn onClick={onClose} title="Close planner (Esc)">
          Close
        </Btn>
      </div>
    </div>
  );
}
