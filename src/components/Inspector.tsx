"use client";

import { CATALOG, fmt, type NodeKind, type SimNode } from "@/lib/design";
import { NODE_W, NODE_H } from "./NodeCard";

interface Props {
  sim: SimNode | null;
  onDelete: () => void;
  onCapacity: (v: number) => void;
  onClose: () => void;
}

export default function Inspector({ sim, onDelete, onCapacity, onClose }: Props) {
  if (!sim) {
    return (
      <div className="panel rounded-xl p-4 text-[12px] leading-relaxed text-[var(--color-muted)]">
        <div className="mono mb-2 text-[10px] uppercase tracking-widest text-[var(--color-accent)]">
          inspector
        </div>
        Click any component on the canvas to read what it does, watch its load,
        and tune its capacity.
      </div>
    );
  }

  const e = sim.entry;
  const rawPct = sim.capacity === Infinity ? 0 : Math.round(sim.load * 100);
  const barPct = Math.min(100, rawPct);

  return (
    <div className="panel fade-in rounded-xl p-4">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span
            className="mono grid h-7 w-7 place-items-center rounded-md text-[15px]"
            style={{ background: `${e.color}1f`, color: e.color }}
          >
            {e.glyph}
          </span>
          <div>
            <div className="text-[13px] font-semibold leading-tight">{e.name}</div>
            <div className="mono text-[9px] uppercase tracking-wide text-[var(--color-muted)]">
              {e.layer} tier
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="mono text-[11px] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          ✕
        </button>
      </div>

      <p className="mb-3 text-[11.5px] leading-relaxed text-[var(--color-muted)]">
        {e.about}
      </p>

      <div className="mb-1 flex items-center justify-between">
        <span className="mono text-[9px] uppercase text-[var(--color-muted)]">
          current load
        </span>
        <span
          className="mono text-[10px] font-bold"
          style={{ color: sim.overloaded ? "#ef4444" : e.color }}
        >
          {sim.capacity === Infinity ? "—" : `${rawPct}%`}
        </span>
      </div>
      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-[#0a1120]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${sim.capacity === Infinity ? 100 : barPct}%`,
            background: sim.overloaded ? "#ef4444" : e.color,
          }}
        />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Stat label="inflow" value={`${fmt(sim.inflow)} rps`} />
        <Stat
          label="capacity"
          value={sim.capacity === Infinity ? "∞" : `${fmt(sim.capacity)} rps`}
        />
      </div>

      {sim.capacity !== Infinity && (
        <div className="mb-3">
          <div className="mono mb-1 flex justify-between text-[9px] uppercase text-[var(--color-muted)]">
            <span>tune capacity</span>
            <span>{fmt(sim.capacity)} rps</span>
          </div>
          <input
            type="range"
            min={Math.max(100, Math.round(e.capacity * 0.25))}
            max={Math.round(e.capacity * 4)}
            step={100}
            value={sim.capacity}
            onChange={(ev) => onCapacity(Number(ev.target.value))}
            className="w-full"
          />
        </div>
      )}

      <button
        onClick={onDelete}
        className="mono w-full rounded-lg border border-[#ef444433] bg-[#ef44440f] py-1.5 text-[10.5px] text-[#ef4444] transition hover:bg-[#ef44441f]"
      >
        delete component
      </button>
      <div className="mono mt-2 text-center text-[8.5px] text-[var(--color-muted)]">
        {NODE_W}×{NODE_H} · {sim.node.id}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[#0a1120] px-2.5 py-1.5">
      <div className="mono text-[8.5px] uppercase text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mono text-[12px] font-semibold">{value}</div>
    </div>
  );
}

export function Palette({
  onAdd,
}: {
  onAdd: (k: NodeKind) => void;
}) {
  const order: NodeKind[] = [
    "client",
    "cdn",
    "loadbalancer",
    "api",
    "cache",
    "database",
    "replica",
    "shard",
    "queue",
    "worker",
    "model",
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {order.map((k) => {
        const e = CATALOG[k];
        return (
          <button
            key={k}
            onClick={() => onAdd(k)}
            className="mono flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] bg-[#0a1120] px-2 py-1.5 text-left text-[10px] transition hover:border-[var(--color-accent)] hover:bg-[#111a2b]"
          >
            <span style={{ color: e.color }}>{e.glyph}</span>
            <span className="truncate">{e.name}</span>
          </button>
        );
      })}
    </div>
  );
}
