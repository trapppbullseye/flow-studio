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
  wireSource: boolean;
  wireTarget: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onPortDown: (e: React.PointerEvent, id: string) => void;
}

export default function NodeCard({
  n,
  sim,
  selected,
  linkSource,
  linkTarget,
  wireSource,
  wireTarget,
  onPointerDown,
  onPortDown,
}: Props) {
  const entry = CATALOG[n.kind];
  const rawPct = sim.capacity === Infinity ? 0 : Math.round(sim.load * 100);
  const barPct = Math.min(100, rawPct);
  const isSource = !!entry.source;

  const ring = wireSource || linkSource
    ? "var(--color-accent)"
    : wireTarget || linkTarget
      ? "var(--color-good)"
      : selected
        ? entry.color
        : sim.overloaded
          ? "var(--color-bad)"
          : "var(--color-line)";

  return (
    <div
      className={`node-card absolute rounded-xl panel ${sim.overloaded ? "node-over" : ""}`}
      style={{
        left: n.x,
        top: n.y,
        width: NODE_W,
        height: NODE_H,
        borderColor: ring,
        boxShadow: selected
          ? `0 0 0 1px ${entry.color}, 0 10px 30px -12px var(--shadow-node)`
          : "0 8px 24px -14px var(--shadow-node)",
        cursor: "grab",
      }}
      onPointerDown={(e) => onPointerDown(e, n.id)}
    >
      {/* header */}
      <div className="flex items-start gap-2 px-3 pt-2.5">
        <span
          className="mono grid h-6 w-6 shrink-0 place-items-center rounded-md text-[13px]"
          style={{
            background: `color-mix(in srgb, ${entry.color} 14%, transparent)`,
            color: entry.color,
          }}
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
          <span className="mono shrink-0 rounded bg-[color-mix(in_srgb,var(--color-bad)_15%,transparent)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--color-bad)]">
            OVER
          </span>
        )}
      </div>

      {/* load meter */}
      <div className="absolute inset-x-3 bottom-2.5">
        <div className="mb-1 flex items-center justify-between">
          <span className="mono text-[9px] uppercase text-[var(--color-muted)]">
            {isSource ? "emitting" : "load"}
          </span>
          <span
            className="mono text-[9.5px] font-bold"
            style={{
              color: sim.overloaded ? "var(--color-bad)" : entry.color,
            }}
          >
            {isSource ? `${fmt(sim.inflow)} rps` : `${rawPct}%`}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-well)]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${isSource ? 100 : barPct}%`,
              background: sim.overloaded
                ? "var(--color-bad)"
                : `linear-gradient(90deg, color-mix(in srgb, ${entry.color} 55%, transparent), ${entry.color})`,
            }}
          />
        </div>
      </div>

      {/* input port */}
      <span
        className="absolute -left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-[var(--color-bg)]"
        style={{ background: entry.color, opacity: isSource ? 0.4 : 1 }}
        title="input"
      />

      {/* output port — drag from here to connect */}
      <span
        onPointerDown={(e) => onPortDown(e, n.id)}
        className="node-port absolute -right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-[var(--color-bg)] transition-transform hover:scale-150"
        style={{
          background: wireSource
            ? "var(--color-accent)"
            : sim.overloaded
              ? "var(--color-bad)"
              : entry.color,
        }}
        title="drag to connect"
      />
    </div>
  );
}
