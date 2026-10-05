"use client";

import { useMemo, useState } from "react";
import {
  CATALOG,
  PALETTE_GROUPS,
  fmt,
  fmtMoney,
  instancedUnits,
  shortName,
  type NodeKind,
  type NodeCost,
  type SimNode,
} from "@/lib/design";
import { NODE_W, NODE_H } from "./NodeCard";
import { fmtMs } from "@/lib/analysis";

interface Props {
  sim: SimNode | null;
  cost: NodeCost | null;
  latency: number;
  baseLatency: number;
  spof: boolean;
  onDelete: () => void;
  onCapacity: (v: number) => void;
  onToggleDead: () => void;
  onClose: () => void;
}

export default function Inspector({
  sim,
  cost,
  latency,
  baseLatency,
  spof,
  onDelete,
  onCapacity,
  onToggleDead,
  onClose,
}: Props) {
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

  // slider range must always contain the current value, or a controlled range
  // input renders pinned/frozen and dragging appears to do nothing
  const natural = e.capacity;
  const scalable = sim.capacity !== Infinity && natural !== Infinity && natural > 0;
  const units = scalable ? instancedUnits(e.kind, sim.capacity) : 1;
  const lo = scalable ? Math.max(1, Math.min(natural, sim.capacity)) : 0;
  const hi = scalable ? Math.max(natural * 8, sim.capacity * 2) : 1;
  const step = scalable ? Math.max(1, Math.round(natural / 10)) : 1;

  return (
    <div className="panel fade-in rounded-xl p-4">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span
            className="mono grid h-7 w-7 place-items-center rounded-md text-[15px]"
            style={{
              background: `color-mix(in srgb, ${e.color} 14%, transparent)`,
              color: e.color,
            }}
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
          style={{
            color: sim.overloaded ? "var(--color-bad)" : e.color,
          }}
        >
          {sim.capacity === Infinity ? "—" : `${rawPct}%`}
        </span>
      </div>
      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-[var(--color-well)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${sim.capacity === Infinity ? 100 : barPct}%`,
            background: sim.overloaded ? "var(--color-bad)" : e.color,
          }}
        />
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <Stat label="inflow" value={`${fmt(sim.inflow)} rps`} />
        <Stat
          label="capacity"
          value={sim.capacity === Infinity ? "∞" : `${fmt(sim.capacity)} rps`}
        />
        <Stat label="p99 latency" value={sim.dead ? "down" : fmtMs(latency)} />
        <Stat label="base p99" value={`${Math.round(baseLatency)} ms`} />
      </div>

      {spof && (
        <div className="mono mb-3 rounded-lg border border-[color-mix(in_srgb,var(--color-warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] px-2.5 py-2 text-[9.5px] leading-relaxed text-[var(--color-warn)]">
          ⚠ single point of failure — if this dies, everything behind it goes
          dark. Add a replica or a second path.
        </div>
      )}

      {scalable && (
        <div className="mb-3">
          <div className="mono mb-1 flex justify-between text-[9px] uppercase text-[var(--color-muted)]">
            <span>tune capacity</span>
            <span className="text-[var(--color-ink)]">
              {fmt(sim.capacity)} rps · ×
              {units >= 10 ? Math.round(units) : units.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={lo}
            max={hi}
            step={step}
            value={Math.min(hi, Math.max(lo, sim.capacity))}
            onChange={(ev) => onCapacity(Number(ev.target.value))}
            className="w-full"
          />
          <div className="mono mt-1 flex justify-between text-[8.5px] text-[var(--color-muted)]">
            <span>1× = {fmt(natural)} rps</span>
            <button
              onClick={() => onCapacity(natural)}
              className="hover:text-[var(--color-ink)]"
            >
              reset to 1×
            </button>
          </div>
        </div>
      )}

      {cost && (
        <div className="mb-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] p-2.5">
          <div className="mono mb-2 flex items-center justify-between text-[9px] uppercase tracking-widest">
            <span className="text-[var(--color-muted)]">monthly cost</span>
            <span className="text-[12px] font-bold text-[var(--color-good)]">
              {fmtMoney(cost.total)}
            </span>
          </div>
          <div className="mono flex flex-col gap-1 text-[9.5px] text-[var(--color-muted)]">
            <Row
              label={cost.instances > 1 ? `fixed · ${cost.instances} instances` : "fixed"}
              value={fmtMoney(cost.fixed)}
            />
            <Row label="per-request" value={fmtMoney(cost.variable)} />
          </div>
        </div>
      )}

      <button
        onClick={onToggleDead}
        className={`mono mb-1.5 w-full rounded-lg border py-1.5 text-[10.5px] transition ${
          sim.dead
            ? "border-[color-mix(in_srgb,var(--color-good)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-good)_10%,transparent)] text-[var(--color-good)] hover:bg-[color-mix(in_srgb,var(--color-good)_18%,transparent)]"
            : "border-[color-mix(in_srgb,var(--color-warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] text-[var(--color-warn)] hover:bg-[color-mix(in_srgb,var(--color-warn)_18%,transparent)]"
        }`}
      >
        {sim.dead ? "↺ bring back online" : "💥 kill this node"}
      </button>

      <button
        onClick={onDelete}
        className="mono w-full rounded-lg border border-[color-mix(in_srgb,var(--color-bad)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-bad)_8%,transparent)] py-1.5 text-[10.5px] text-[var(--color-bad)] transition hover:bg-[color-mix(in_srgb,var(--color-bad)_14%,transparent)]"
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
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-2.5 py-1.5">
      <div className="mono text-[8.5px] uppercase text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mono text-[12px] font-semibold">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate">{label}</span>
      <span className="shrink-0 font-semibold text-[var(--color-ink)]">
        {value}
      </span>
    </div>
  );
}

export function Palette({
  onAdd,
  unlocked,
  lockedHint,
  priceOf,
  canAfford,
}: {
  onAdd: (k: NodeKind) => void;
  /** when provided, anything outside this set renders locked */
  unlocked?: Set<NodeKind>;
  lockedHint?: (k: NodeKind) => string | null;
  /** optional price label shown on each button */
  priceOf?: (k: NodeKind) => string | null;
  /** optional gate — false dims the button and blocks the click */
  canAfford?: (k: NodeKind) => boolean;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const groups = useMemo(
    () =>
      PALETTE_GROUPS.map((g) => ({
        ...g,
        kinds: (Object.keys(CATALOG) as NodeKind[]).filter(
          (k) =>
            CATALOG[k].layer === g.layer &&
            (!q || CATALOG[k].name.toLowerCase().includes(q)),
        ),
      })).filter((g) => g.kinds.length),
    [q],
  );

  return (
    <div className="flex flex-col gap-2.5">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="search 50 components…"
        className="mono w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-2.5 py-1.5 text-[10px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]"
      />

      {groups.map((g) => (
        <div key={g.layer}>
          <div className="mono mb-1 px-0.5 text-[8px] uppercase tracking-widest text-[var(--color-muted)]">
            {g.label}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {g.kinds.map((k) => {
              const e = CATALOG[k];
              const locked = unlocked ? !unlocked.has(k) : false;
              const hint = locked && lockedHint ? lockedHint(k) : null;
              const price = priceOf ? priceOf(k) : null;
              const affordable = canAfford ? canAfford(k) : true;
              const dim = locked || !affordable;
              return (
                <button
                  key={k}
                  onClick={() => !dim && onAdd(k)}
                  disabled={dim}
                  title={
                    locked
                      ? `${e.name} — locked${hint ? ` · ${hint}` : ""}`
                      : !affordable
                        ? `${e.name} — can't afford this yet${price ? ` (${price})` : ""}`
                        : `${e.name} — ${e.tagline}${price ? ` · buy for ${price}` : ""}`
                  }
                  className={`mono flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[9.5px] transition ${
                    locked
                      ? "cursor-not-allowed border-dashed border-[var(--color-line)] bg-transparent opacity-40"
                      : !affordable
                        ? "cursor-not-allowed border-[var(--color-line)] bg-[var(--color-well)] opacity-45"
                        : "border-[var(--color-line)] bg-[var(--color-well)] hover:border-[var(--color-accent)] hover:bg-[var(--color-panel2)]"
                  }`}
                >
                  <span
                    style={{ color: dim ? "var(--color-muted)" : e.color }}
                  >
                    {locked ? "🔒" : e.glyph}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{shortName(k)}</span>
                  {price && !locked && (
                    <span className="shrink-0 text-[8px] text-[var(--color-muted)]">
                      {price}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!groups.length && (
        <div className="mono px-1 py-2 text-[10px] text-[var(--color-muted)]">
          no components match “{query}”
        </div>
      )}
    </div>
  );
}
