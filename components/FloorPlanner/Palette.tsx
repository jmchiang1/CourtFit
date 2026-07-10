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
      className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-neutral-200 transition hover:bg-white/5 active:bg-white/10"
    >
      {swatch}
      <span className="flex-1 truncate">{label}</span>
      {meta && (
        <span className="font-mono text-[10px] text-neutral-500 group-hover:text-neutral-400">
          {meta}
        </span>
      )}
      <span className="text-neutral-600 opacity-0 transition group-hover:opacity-100">+</span>
    </button>
  );

  const Header = ({ id, title }: { id: Section; title: string }) => (
    <button
      onClick={() => toggle(id)}
      className="flex w-full items-center justify-between px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-300"
    >
      {title}
      <span className="text-neutral-600">{open[id] ? "−" : "+"}</span>
    </button>
  );

  const spawn = (category: Category, type: string) => addItem(category, type);

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-[#232a34] bg-[#161b22]">
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
                      className="inline-block h-3.5 w-5 shrink-0 rounded-[2px] border"
                      style={{ background: `${c.color}33`, borderColor: c.color }}
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

        <Header id="furniture" title="Furniture & Barriers" />
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
                      className="inline-block h-3.5 w-5 shrink-0 border"
                      style={{
                        background: it.color,
                        borderColor: "rgba(0,0,0,.3)",
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

      <div className="border-t border-[#232a34] px-3 py-2 text-[10px] leading-relaxed text-neutral-600">
        Click to add · drag to place · handles resize
      </div>
    </aside>
  );
}
