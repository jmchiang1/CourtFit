"use client";

import { useState } from "react";
import { COURTS, ITEMS, ROOMS, Category } from "@/lib/floor-planner/config";
import { usePlanner } from "@/lib/floor-planner/store";

type Section = "courts" | "rooms" | "furniture";

export default function Palette() {
  const addItem = usePlanner((s) => s.addItem);
  const [open, setOpen] = useState<Record<Section, boolean>>({
    courts: true,
    rooms: true,
    furniture: true,
  });
  const toggle = (s: Section) => setOpen((o) => ({ ...o, [s]: !o[s] }));

  const Row = ({
    onClick,
    swatch,
    label,
    meta,
  }: {
    onClick: () => void;
    swatch: React.ReactNode;
    label: string;
    meta?: string;
  }) => (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground transition outline-none hover:bg-field active:bg-field-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      {swatch}
      <span className="flex-1 truncate">{label}</span>
      {meta && (
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {meta}
        </span>
      )}
      <span className="text-muted-foreground opacity-0 transition group-hover:opacity-100">+</span>
    </button>
  );

  const Header = ({ id, title }: { id: Section; title: string }) => (
    <button
      onClick={() => toggle(id)}
      className="flex w-full items-center justify-between px-2 pb-1 pt-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
    >
      {title}
      <span className="text-muted-foreground">{open[id] ? "−" : "+"}</span>
    </button>
  );

  const spawn = (category: Category, type: string) => addItem(category, type);

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col overflow-hidden rounded-xl bg-panel">
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
        <Header id="courts" title="Courts" />
        {open.courts && (
          <div className="space-y-0.5">
            {(Object.keys(COURTS) as (keyof typeof COURTS)[]).map((k) => {
              const c = COURTS[k];
              return (
                <Row
                  key={k}
                  onClick={() => spawn("court", k)}
                  swatch={
                    <span
                      className="inline-block h-3.5 w-5 shrink-0 rounded-[2px]"
                      style={{ background: c.color }}
                    />
                  }
                  label={c.label}
                  meta={`${c.footprint.w}×${c.footprint.h}`}
                />
              );
            })}
          </div>
        )}

        <Header id="rooms" title="Rooms" />
        {open.rooms && (
          <div className="space-y-0.5">
            {(Object.keys(ROOMS) as (keyof typeof ROOMS)[]).map((k) => {
              const r = ROOMS[k];
              return (
                <Row
                  key={k}
                  onClick={() => spawn("room", k)}
                  swatch={
                    <span className="grid h-3.5 w-5 shrink-0 place-items-center text-[11px]">
                      {r.icon}
                    </span>
                  }
                  label={r.label}
                  meta="resize"
                />
              );
            })}
          </div>
        )}

        <Header id="furniture" title="Furniture & barriers" />
        {open.furniture && (
          <div className="space-y-0.5">
            {(Object.keys(ITEMS) as (keyof typeof ITEMS)[]).map((k) => {
              const it = ITEMS[k];
              return (
                <Row
                  key={k}
                  onClick={() => spawn("item", k)}
                  swatch={
                    <span
                      className="inline-block h-3.5 w-5 shrink-0"
                      style={{
                        background: it.color,
                        borderRadius: "round" in it && it.round ? "50%" : 2,
                      }}
                    />
                  }
                  label={it.label}
                  meta={`${it.w}×${it.h}`}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-field/60 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
        Click to add · drag to place · handles resize · select to rename
      </div>
    </aside>
  );
}
