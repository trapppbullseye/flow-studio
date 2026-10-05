"use client";

import type { SimNode, FlowNode } from "@/lib/design";
import { CATALOG, fmt } from "@/lib/design";

export const NODE_W = 172;
export const NODE_H = 104;

interface Props {
  n: FlowNode;
  sim: SimNode;
  selected: boolean;
  linkSource: boolean;
  linkTarget: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onSelect: (id: string) => void;
}

export default function NodeCard({
  n,
  sim,
  selected,
  linkSource,
  linkTarget,
  onPointerDown,
  onSelect,
}: Props) {
  const entry = CATALOG[n.kind];
  const rawPct = sim.capacity === Infinity ? 0 : Math.round(sim.load * 100);
  const barPct = Math.min(100, rawPct);
  const isClient = n.kind === "client";

  const ring = linkSource
    ? "#38bdf8"
    : linkTarget
      ? "#22c55e"
      : selected
        ? entry.color
        : sim.overloaded
          ? "#ef4444"
          : "#1b2740";

  return (
    <div
      className={`node-card absolute rounded-xl panel ${sim.overloaded ? "node-over" : ""}`}
      style={{
        left: n.x,
        top: n.y,
        width: NODE_W,
        height: NODE_H,
        borderColor: ring,
        boxShadow: selected ? `0 0 0 1px ${entry.color}, 0 10px 30px -12px #000` : "0 8px 24px -14px #000",
        cursor: "grab",
      }}
      onPointerDown={(e) => onPointerDown(e, n.id)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(n.id);
      }}
    >
      {/* header */}
      <div className="flex items-start gap-2 px-3 pt-2.5">
        <span
          className="mono grid h-6 w-6 shrink-0 place-items-center rounded-md text-[13px]"
          style={{ background: `${entry.color}1f`, color: entry.color }}
        >
          {entry.glyph}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold leading-tight">
            {entry.name}
          </div>
          <div className="mono truncate text-[9px] uppercase tracking-wide text-[var(--color-muted)]">
            {entry.tagline}
          </div>
        </div>
        {sim.overloaded && (
          <span className="mono shrink-0 rounded bg-[#ef444426] px-1.5 py-0.5 text-[9px] font-bold text-[#ef4444]">
            OVER
          </span>
        )}
      </div>

      {/* load meter */}
      <div className="absolute inset-x-3 bottom-2.5">
        <div className="mb-1 flex items-center justify-between">
          <span className="mono text-[9px] uppercase text-[var(--color-muted)]">
            {isClient ? "emitting" : "load"}
          </span>
          <span
            className="mono text-[9.5px] font-bold"
            style={{ color: sim.overloaded ? "#ef4444" : entry.color }}
          >
            {isClient ? `${fmt(sim.inflow)} rps` : `${rawPct}%`}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0a1120]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${isClient ? 100 : barPct}%`,
              background: sim.overloaded
                ? "#ef4444"
                : `linear-gradient(90deg, ${entry.color}88, ${entry.color})`,
            }}
          />
        </div>
      </div>

      {/* ports */}
      {n.kind !== "client" && (
        <span
          className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#060a12]"
          style={{ background: entry.color }}
        />
      )}
      {sim.capacity !== Infinity && (
        <span
          className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#060a12]"
          style={{ background: sim.overloaded ? "#ef4444" : entry.color }}
        />
      )}
    </div>
  );
}
