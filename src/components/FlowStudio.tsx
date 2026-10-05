"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CATALOG,
  SCENARIOS,
  fmt,
  fmtUsers,
  newId,
  simulate,
  type Edge,
  type FlowNode,
  type NodeKind,
} from "@/lib/design";
import NodeCard, { NODE_H, NODE_W } from "./NodeCard";
import Inspector, { Palette } from "./Inspector";

const EDGE_COLOR: Record<Edge["mode"], string> = {
  read: "var(--edge-read)",
  write: "var(--edge-write)",
  async: "var(--edge-async)",
};

export default function FlowStudio() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [nodes, setNodes] = useState<FlowNode[]>(SCENARIOS[0].nodes);
  const [edges, setEdges] = useState<Edge[]>(SCENARIOS[0].edges);
  const [users, setUsers] = useState(SCENARIOS[0].users);
  const [selected, setSelected] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 30, y: 20 });
  const [zoom, setZoom] = useState(0.9);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const wrapRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const panDrag = useRef<{
    startX: number;
    startY: number;
    ox: number;
    oy: number;
  } | null>(null);

  const sim = useMemo(() => simulate(nodes, edges, users), [nodes, edges, users]);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;

  const fitTo = useCallback((ns: FlowNode[]) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r || !ns.length) return;
    const minX = Math.min(...ns.map((n) => n.x));
    const minY = Math.min(...ns.map((n) => n.y));
    const maxX = Math.max(...ns.map((n) => n.x)) + NODE_W;
    const maxY = Math.max(...ns.map((n) => n.y)) + NODE_H;
    const pad = 70;
    const z = Math.min(
      1.15,
      Math.max(
        0.4,
        Math.min(
          (r.width - pad * 2) / (maxX - minX),
          (r.height - pad * 2) / (maxY - minY),
        ),
      ),
    );
    setZoom(z);
    setPan({
      x: (r.width - (maxX - minX) * z) / 2 - minX * z,
      y: (r.height - (maxY - minY) * z) / 2 - minY * z,
    });
  }, []);

  useEffect(() => {
    fitTo(SCENARIOS[0].nodes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadScenario = useCallback(
    (id: string) => {
      const s = SCENARIOS.find((x) => x.id === id)!;
      setScenarioId(id);
      setNodes(s.nodes.map((n) => ({ ...n })));
      setEdges(s.edges.map((e) => ({ ...e })));
      setUsers(s.users);
      setSelected(null);
      setLinkFrom(null);
      setLinkMode(false);
      fitTo(s.nodes);
    },
    [fitTo],
  );

  /* ---------------- pointer plumbing ---------------- */
  const toCanvas = useCallback((clientX: number, clientY: number) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return {
      x: (clientX - r.left - panRef.current.x) / zoomRef.current,
      y: (clientY - r.top - panRef.current.y) / zoomRef.current,
    };
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (drag.current) {
        const d = drag.current;
        const dx = (e.clientX - d.startX) / zoomRef.current;
        const dy = (e.clientY - d.startY) / zoomRef.current;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
        setNodes((prev) =>
          prev.map((n) =>
            n.id === d.id ? { ...n, x: d.origX + dx, y: d.origY + dy } : n,
          ),
        );
      } else if (panDrag.current) {
        const p = panDrag.current;
        setPan({
          x: p.ox + (e.clientX - p.startX),
          y: p.oy + (e.clientY - p.startY),
        });
      }
      const c = toCanvas(e.clientX, e.clientY);
      setGhost(c);
    };
    const up = () => {
      if (drag.current && !drag.current.moved) setSelected(drag.current.id);
      drag.current = null;
      panDrag.current = null;
      setPanning(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [toCanvas]);

  const onNodePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (linkMode) {
      if (!linkFrom) {
        setLinkFrom(id);
      } else if (linkFrom !== id) {
        const dupe = edges.some((x) => x.from === linkFrom && x.to === id);
        if (!dupe) {
          setEdges((prev) => [
            ...prev,
            { id: `${linkFrom}->${id}`, from: linkFrom, to: id, mode: "read" },
          ]);
        }
        setLinkFrom(null);
      }
      return;
    }
    const n = nodes.find((x) => x.id === id)!;
    drag.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: n.x,
      origY: n.y,
      moved: false,
    };
  };

  const onBgPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".node-card")) return;
    if (linkMode) {
      setLinkFrom(null);
      return;
    }
    setSelected(null);
    panDrag.current = {
      startX: e.clientX,
      startY: e.clientY,
      ox: pan.x,
      oy: pan.y,
    };
    setPanning(true);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const r = wrapRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const next = Math.min(1.8, Math.max(0.4, zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
    setPan({
      x: mx - ((mx - pan.x) * next) / zoom,
      y: my - ((my - pan.y) * next) / zoom,
    });
    setZoom(next);
  };

  /* ---------------- editing ---------------- */
  const addNode = (kind: NodeKind) => {
    const r = wrapRef.current?.getBoundingClientRect();
    const c = r
      ? toCanvas(r.left + r.width / 2, r.top + r.height / 2)
      : { x: 300, y: 200 };
    const id = newId(kind);
    setNodes((prev) => [
      ...prev,
      {
        id,
        kind,
        x: c.x - NODE_W / 2 + Math.random() * 40,
        y: c.y - NODE_H / 2 + Math.random() * 40,
      },
    ]);
    setSelected(id);
  };

  const deleteNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    setSelected(null);
    setLinkFrom(null);
  };

  const setEdgeMode = (id: string, mode: Edge["mode"]) =>
    setEdges((prev) => prev.map((e) => (e.id === id ? { ...e, mode } : e)));

  const fit = () => fitTo(nodes);

  /* ---------------- render ---------------- */
  const ghostStart = linkFrom ? sim.nodes[linkFrom] : null;
  const hasTargets = nodes.some((n) => !CATALOG[n.kind].source);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      {/* ============ TOP BAR ============ */}
      <header className="z-20 flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2.5">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[17px] font-extrabold tracking-tight">
            FLOW STUDIO
          </span>
          <span className="mono hidden text-[10px] text-[var(--color-muted)] sm:inline">
            link components · see how it holds
          </span>
        </div>

        <div className="mono ml-auto flex flex-wrap items-center gap-2 text-[10px]">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-3 py-1.5">
            <span className="uppercase text-[var(--color-muted)]">users</span>
            <input
              type="range"
              min={10000}
              max={3000000}
              step={10000}
              value={users}
              onChange={(e) => setUsers(Number(e.target.value))}
              className="w-32"
            />
            <span className="w-14 text-right font-bold text-[var(--color-accent)]">
              {fmtUsers(users)}
            </span>
          </div>
          <span className="rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-3 py-1.5 text-[var(--color-muted)]">
            {fmt(sim.rps)} req/s
          </span>
          <button
            onClick={() => {
              setLinkMode((v) => !v);
              setLinkFrom(null);
            }}
            className={`rounded-lg border px-3 py-1.5 transition ${
              linkMode
                ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent)]"
                : "border-[var(--color-line)] bg-[var(--color-well)] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            🔗 link {linkMode ? "on" : "off"}
          </button>
          <button
            onClick={fit}
            className="rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-3 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            fit
          </button>
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            title="toggle theme"
            className="rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-3 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            {theme === "light" ? "☾ dark" : "☀ light"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ============ SIDEBAR ============ */}
        <aside className="z-10 flex w-[300px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-[var(--color-line)] bg-[var(--color-panel)] p-3">
          {/* scenario */}
          <div className="panel fade-in rounded-xl p-3">
            <div className="mono text-[10px] uppercase tracking-widest text-[var(--color-accent)]">
              {scenario.index} / {scenario.title}
            </div>
            <div className="mt-1 text-[14px] font-semibold leading-snug">
              {scenario.blurb}
            </div>
          </div>

          <Section title="scenarios">
            <div className="flex flex-col gap-1.5">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => loadScenario(s.id)}
                  className={`mono flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[10.5px] transition ${
                    s.id === scenarioId
                      ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] text-[var(--color-ink)]"
                      : "border-[var(--color-line)] bg-[var(--color-well)] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <span className="font-bold text-[var(--color-accent)]">
                    {s.index}
                  </span>
                  <span className="truncate">{s.title}</span>
                </button>
              ))}
            </div>
          </Section>

          <Inspector
            sim={selected ? sim.nodes[selected] : null}
            onDelete={() => selected && deleteNode(selected)}
            onCapacity={(v) =>
              setNodes((prev) =>
                prev.map((n) => (n.id === selected ? { ...n, capacity: v } : n)),
              )
            }
            onClose={() => setSelected(null)}
          />

          <Section title="add component">
            <Palette onAdd={addNode} />
          </Section>

          {edges.length > 0 && (
            <Section title="connections">
              <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto">
                {edges.map((e) => {
                  const a = nodes.find((n) => n.id === e.from);
                  const b = nodes.find((n) => n.id === e.to);
                  return (
                    <div
                      key={e.id}
                      className="mono flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-2 py-1.5 text-[9.5px]"
                    >
                      <span className="truncate text-[var(--color-muted)]">
                        {a ? CATALOG[a.kind].glyph : "?"}{" "}
                        {a ? CATALOG[a.kind].name : "?"}
                        {" → "}
                        {b ? CATALOG[b.kind].glyph : "?"}{" "}
                        {b ? CATALOG[b.kind].name : "?"}
                      </span>
                      <select
                        value={e.mode}
                        onChange={(ev) =>
                          setEdgeMode(e.id, ev.target.value as Edge["mode"])
                        }
                        className="ml-auto shrink-0 rounded border border-[var(--color-line)] bg-[var(--color-panel2)] px-1 py-0.5 text-[9px]"
                        style={{ color: EDGE_COLOR[e.mode] }}
                      >
                        <option value="read">read</option>
                        <option value="write">write</option>
                        <option value="async">async</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          <Section title="legend">
            <div className="mono flex flex-col gap-1 text-[9.5px] text-[var(--color-muted)]">
              <Legend c="var(--color-good)" t="healthy · under capacity" />
              <Legend c="var(--color-bad)" t="overloaded · the bottleneck" />
              <Legend c="var(--edge-read)" t="read path" />
              <Legend c="var(--edge-write)" t="write path" />
              <Legend c="var(--edge-async)" t="async / queued" />
            </div>
          </Section>

          <div className="mono px-1 pb-2 text-[8.5px] leading-relaxed text-[var(--color-muted)]">
            drag nodes · scroll to zoom · drag bg to pan · 🔗 then click two
            nodes to connect
          </div>
        </aside>

        {/* ============ CANVAS ============ */}
        <main
          ref={wrapRef}
          className="dotgrid relative min-w-0 flex-1 overflow-hidden"
          onPointerDown={onBgPointerDown}
          onWheel={onWheel}
          style={{
            cursor: panning ? "grabbing" : linkMode ? "crosshair" : "default",
          }}
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            {/* edges */}
            <svg
              className="pointer-events-none absolute left-0 top-0 overflow-visible"
              width={1}
              height={1}
            >
              <defs>
                {(["read", "write", "async"] as const).map((m) => (
                  <marker
                    key={m}
                    id={`arrow-${m}`}
                    markerWidth="9"
                    markerHeight="9"
                    refX="7"
                    refY="4.5"
                    orient="auto"
                  >
                    <path d="M0,0 L9,4.5 L0,9 z" fill={EDGE_COLOR[m]} />
                  </marker>
                ))}
                <marker
                  id="arrow-bad"
                  markerWidth="9"
                  markerHeight="9"
                  refX="7"
                  refY="4.5"
                  orient="auto"
                >
                  <path d="M0,0 L9,4.5 L0,9 z" fill="var(--color-bad)" />
                </marker>
              </defs>

              {edges.map((e) => {
                const a = nodes.find((n) => n.id === e.from);
                const b = nodes.find((n) => n.id === e.to);
                if (!a || !b) return null;
                const se = sim.edges[e.id];
                const bad = se?.overloaded;
                const col = bad ? "var(--color-bad)" : EDGE_COLOR[e.mode];
                const x1 = a.x + NODE_W;
                const y1 = a.y + NODE_H / 2;
                const x2 = b.x;
                const y2 = b.y + NODE_H / 2;
                const mx = (x1 + x2) / 2;
                const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2 - 6} ${y2}`;
                const dotx =
                  0.125 * x1 + 0.375 * mx + 0.375 * mx + 0.125 * (x2 - 6);
                const doty = 0.5 * y1 + 0.5 * y2;
                return (
                  <g key={e.id}>
                    <path
                      d={d}
                      fill="none"
                      stroke={col}
                      strokeOpacity={0.28}
                      strokeWidth={2.4}
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke={col}
                      strokeWidth={2.4}
                      className={`edge-flow ${bad ? "fast" : ""}`}
                      markerEnd={`url(#arrow-${bad ? "bad" : e.mode})`}
                    />
                    <circle cx={dotx} cy={doty} r={3.2} fill={col} className="pulse-dot" />
                  </g>
                );
              })}

              {/* ghost link line */}
              {linkFrom && ghostStart && ghost && (
                <path
                  d={`M ${ghostStart.node.x + NODE_W} ${
                    ghostStart.node.y + NODE_H / 2
                  } L ${ghost.x} ${ghost.y}`}
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  strokeDasharray="5 6"
                  fill="none"
                />
              )}
            </svg>

            {nodes.map((n) => (
              <NodeCard
                key={n.id}
                n={n}
                sim={sim.nodes[n.id]}
                selected={selected === n.id}
                linkSource={linkFrom === n.id}
                linkTarget={linkMode && !!linkFrom && linkFrom !== n.id}
                onPointerDown={onNodePointerDown}
                onSelect={setSelected}
              />
            ))}
          </div>

          {/* bottleneck banner */}
          {sim.worst && (
            <div className="fade-in pointer-events-none absolute left-1/2 top-4 -translate-x-1/2">
              <div className="flex items-center gap-2 rounded-xl border border-[var(--color-bad-border)] bg-[var(--color-bad-soft)] px-4 py-2 backdrop-blur">
                <span className="pulse-dot grid h-2.5 w-2.5 place-items-center rounded-full bg-[var(--color-bad)]" />
                <span className="mono text-[11px]">
                  <span className="font-bold text-[var(--color-bad)]">
                    {CATALOG[sim.worst.node.kind].name.toUpperCase()}
                  </span>{" "}
                  <span className="text-[var(--color-ink)]">
                    is your bottleneck — {Math.round(sim.worst.load * 100)}% of
                    capacity
                  </span>
                </span>
              </div>
            </div>
          )}
          {!sim.worst && hasTargets && (
            <div className="fade-in pointer-events-none absolute left-1/2 top-4 -translate-x-1/2">
              <div className="mono rounded-xl border border-[var(--color-good-border)] bg-[var(--color-good-soft)] px-4 py-2 text-[11px] text-[var(--color-good)] backdrop-blur">
                ◉ every component under capacity — the system holds
              </div>
            </div>
          )}

          {/* bottom status strip */}
          <div className="mono pointer-events-none absolute bottom-0 left-0 right-0 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--color-line)] bg-[var(--color-strip)] px-4 py-1.5 text-[9.5px] text-[var(--color-muted)] backdrop-blur">
            <span className="text-[var(--color-accent)]">SIMULATED WORKLOAD</span>
            <span>· real-world capacity numbers</span>
            <span>· {nodes.length} components</span>
            <span>· {edges.length} links</span>
            <span>· {fmt(sim.rps)} req/s in</span>
            <span className="ml-auto">
              bottleneck:{" "}
              <span
                style={{
                  color: sim.worst ? "var(--color-bad)" : "var(--color-good)",
                }}
              >
                {sim.worst ? CATALOG[sim.worst.node.kind].name : "none"}
              </span>
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mono mb-1.5 px-1 text-[9px] uppercase tracking-widest text-[var(--color-muted)]">
        {title}
      </div>
      {children}
    </div>
  );
}

function Legend({ c, t }: { c: string; t: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: c }} />
      {t}
    </span>
  );
}
