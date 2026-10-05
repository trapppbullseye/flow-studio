"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CATALOG,
  CHALLENGES,
  SCENARIOS,
  addSecondRegion,
  billOf,
  costOf,
  fmt,
  fmtMoney,
  fmtUsers,
  newId,
  shortName,
  simulate,
  smartStack,
  type Challenge,
  type Edge,
  type FlowNode,
  type NodeKind,
} from "@/lib/design";
import { analyzeLatency, findSpofs, fmtMs } from "@/lib/analysis";
import {
  designToSVG,
  download,
  readSharedDesign,
  shareUrl,
  svgToPng,
} from "@/lib/share";
import NodeCard, { NODE_H, NODE_W, type View } from "./NodeCard";
import Inspector, { Palette } from "./Inspector";

const EDGE_COLOR: Record<Edge["mode"], string> = {
  read: "var(--edge-read)",
  write: "var(--edge-write)",
  async: "var(--edge-async)",
};

const hitTest = (p: { x: number; y: number }, ns: FlowNode[]) => {
  for (let i = ns.length - 1; i >= 0; i--) {
    const n = ns[i];
    if (p.x >= n.x && p.x <= n.x + NODE_W && p.y >= n.y && p.y <= n.y + NODE_H)
      return n.id;
  }
  return null;
};

export default function FlowStudio() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [nodes, setNodes] = useState<FlowNode[]>(SCENARIOS[0].nodes);
  const [edges, setEdges] = useState<Edge[]>(SCENARIOS[0].edges);
  const [users, setUsers] = useState(SCENARIOS[0].users);
  const [selection, setSelection] = useState<string[]>([]);
  const [meta, setMeta] = useState({
    index: SCENARIOS[0].index,
    title: SCENARIOS[0].title,
    blurb: SCENARIOS[0].blurb,
  });
  const [view, setView] = useState<View>("info");
  const [dead, setDead] = useState<string[]>([]);
  const [history, setHistory] = useState<
    { cost: number; latency: number; label: string }[]
  >([]);
  const [showChart, setShowChart] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [linkMode, setLinkMode] = useState(false);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [wireFrom, setWireFrom] = useState<string | null>(null);
  const [wireHover, setWireHover] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [pan, setPan] = useState({ x: 30, y: 20 });
  const [zoom, setZoom] = useState(0.9);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const wrapRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const wiring = useRef<string | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const drag = useRef<{
    ids: string[];
    origins: Record<string, { x: number; y: number }>;
    startX: number;
    startY: number;
    moved: boolean;
    collapseTo: string | null;
  } | null>(null);
  const panDrag = useRef<{
    startX: number;
    startY: number;
    ox: number;
    oy: number;
  } | null>(null);

  const deadSet = useMemo(() => new Set(dead), [dead]);
  const sim = useMemo(
    () => simulate(nodes, edges, users, deadSet),
    [nodes, edges, users, deadSet],
  );
  const bill = useMemo(() => billOf(sim), [sim]);
  const lat = useMemo(() => analyzeLatency(nodes, edges, sim), [nodes, edges, sim]);
  const spofs = useMemo(() => new Set(findSpofs(nodes, edges)), [nodes, edges]);
  const selectedId = selection.length === 1 ? selection[0] : null;

  const billRef = useRef(bill);
  const latRef = useRef(lat);
  useEffect(() => {
    billRef.current = bill;
    latRef.current = lat;
  }, [bill, lat]);

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
        0.35,
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

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const record = useCallback((label: string) => {
    setHistory((h) => [
      ...h,
      { cost: billRef.current.total, latency: latRef.current.endToEnd, label },
    ]);
    setShowChart(true);
  }, []);

  /* ---------- boot: shared link or default scenario ---------- */
  useEffect(() => {
    const shared = readSharedDesign();
    if (shared) {
      // reading the URL is an external-system sync; setState on mount is correct here
      /* eslint-disable react-hooks/set-state-in-effect */
      setNodes(shared.nodes);
      setEdges(shared.edges);
      setUsers(shared.users);
      setDead(shared.dead);
      setScenarioId("");
      setMeta({
        index: "🔗",
        title: "SHARED DESIGN",
        blurb: "A build someone sent you. Poke at it — nothing here is saved.",
      });
      /* eslint-enable react-hooks/set-state-in-effect */
      fitTo(shared.nodes);
      flash("shared design loaded");
      return;
    }
    fitTo(SCENARIOS[0].nodes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadScenario = useCallback(
    (id: string) => {
      const s = SCENARIOS.find((x) => x.id === id)!;
      setScenarioId(id);
      setMeta({ index: s.index, title: s.title, blurb: s.blurb });
      setNodes(s.nodes.map((n) => ({ ...n })));
      setEdges(s.edges.map((e) => ({ ...e })));
      setUsers(s.users);
      setChallenge(null);
      setDead([]);
      setSelection([]);
      setLinkFrom(null);
      setLinkMode(false);
      setWireFrom(null);
      fitTo(s.nodes);
    },
    [fitTo],
  );

  const loadChallenge = useCallback(
    (c: Challenge) => {
      setChallenge(c);
      setScenarioId("");
      setMeta({ index: "⚔", title: c.title, blurb: c.brief });
      setNodes(c.nodes.map((n) => ({ ...n })));
      setEdges(c.edges.map((e) => ({ ...e })));
      setUsers(c.users);
      setDead([]);
      setSelection([]);
      setWireFrom(null);
      fitTo(c.nodes);
    },
    [fitTo],
  );

  const buildSmartStack = useCallback(() => {
    const { nodes: ns, edges: es } = smartStack(users);
    setScenarioId("");
    setMeta({
      index: "★",
      title: "SMART STACK",
      blurb:
        "A scalable default — edge, LB, stateless APIs, cache, replicas, queue. Every layer sized to hold.",
    });
    setNodes(ns);
    setEdges(es);
    setChallenge(null);
    setDead([]);
    setSelection([]);
    setWireFrom(null);
    fitTo(ns);
    record("smart stack");
  }, [users, fitTo, record]);

  const autoScale = useCallback(() => {
    const over = nodes.filter((n) => sim.nodes[n.id]?.overloaded);
    if (!over.length) {
      flash("nothing overloaded");
      return;
    }
    setNodes((prev) =>
      prev.map((n) => {
        const sn = sim.nodes[n.id];
        if (!sn || sn.capacity === Infinity || !sn.overloaded) return n;
        return { ...n, capacity: Math.ceil((sn.inflow * 1.3) / 100) * 100 };
      }),
    );
    flash(`scaled ${over.length} component${over.length > 1 ? "s" : ""}`);
  }, [nodes, sim, flash]);

  const addRegion = useCallback(() => {
    const { nodes: ns, edges: es, added } = addSecondRegion(nodes, edges);
    if (!added) {
      flash("add a Users node first");
      return;
    }
    setNodes(ns);
    setEdges(es);
    setSelection([]);
    fitTo(ns);
    flash(`second region: ${added} components cloned`);
  }, [nodes, edges, fitTo, flash]);

  const chaosKill = useCallback(() => {
    const target = sim.worst?.node.id ?? nodes.find((n) => !CATALOG[n.kind].source)?.id;
    if (!target) return;
    setDead((d) => (d.includes(target) ? d : [...d, target]));
    const name = CATALOG[nodes.find((n) => n.id === target)!.kind].name;
    flash(`💥 killed ${name} — watch what starves downstream`);
  }, [sim, nodes, flash]);

  const reviveAll = useCallback(() => {
    setDead([]);
    flash("all components back online");
  }, [flash]);

  /** two-step wipe: first click arms it, second click clears the canvas */
  const clearAll = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 5000);
      flash("click clear again to wipe everything");
      return;
    }
    setConfirmClear(false);
    setNodes([]);
    setEdges([]);
    setDead([]);
    setSelection([]);
    setWireFrom(null);
    setLinkFrom(null);
    setScenarioId("");
    setChallenge(null);
    setMeta({
      index: "🧹",
      title: "BLANK CANVAS",
      blurb:
        "Empty canvas. Add components from the palette, then drag a ● port onto another node to wire them up.",
    });
    flash("canvas cleared");
  }, [confirmClear, flash]);

  const toggleDead = useCallback((id: string) => {
    setDead((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  }, []);

  const replay = useCallback(() => {
    if (replaying) return;
    setDead([]);
    setReplaying(true);
    let guard = 0;
    const step = () => {
      guard++;
      const curNodes = nodesRef.current;
      const curSim = simulate(curNodes, edgesRef.current, users);
      const over = curNodes.filter((n) => curSim.nodes[n.id]?.overloaded);
      if (!over.length || guard > 14) {
        setReplaying(false);
        window.setTimeout(() => record("after replay"), 280);
        flash(
          over.length
            ? "stopped — still hot after 14 fixes"
            : "system holds — replay done",
        );
        return;
      }
      const worst = over.reduce((a, b) =>
        curSim.nodes[a.id].load > curSim.nodes[b.id].load ? a : b,
      );
      setNodes((prev) =>
        prev.map((n) =>
          n.id === worst.id
            ? {
                ...n,
                capacity:
                  Math.ceil((curSim.nodes[worst.id].inflow * 1.3) / 100) * 100,
              }
            : n,
        ),
      );
      window.setTimeout(step, 550);
    };
    step();
  }, [replaying, users, record, flash]);

  const doShare = useCallback(async () => {
    const url = shareUrl({ nodes, edges, users, dead });
    try {
      await navigator.clipboard.writeText(url);
      flash("link copied to clipboard");
    } catch {
      window.location.hash = `d=${url.split("#d=")[1]}`;
      flash("link is in the address bar");
    }
  }, [nodes, edges, users, dead, flash]);

  const exportSvg = useCallback(() => {
    const svg = designToSVG(nodes, edges, sim, {
      theme,
      showCost: view === "cost",
      showLatency: view === "latency",
      costOf: (id) => costOf(sim.nodes[id]).total,
      latencyOf: (id) => lat.perNode[id] ?? 0,
    });
    if (!svg) return;
    download("flow-studio.svg", svg, "image/svg+xml");
    flash("flow-studio.svg downloaded");
  }, [nodes, edges, sim, theme, view, lat, flash]);

  const exportPng = useCallback(() => {
    const svg = designToSVG(nodes, edges, sim, {
      theme,
      showCost: view === "cost",
      showLatency: view === "latency",
      costOf: (id) => costOf(sim.nodes[id]).total,
      latencyOf: (id) => lat.perNode[id] ?? 0,
    });
    if (!svg) return;
    svgToPng(svg, "flow-studio.png");
    flash("flow-studio.png downloading");
  }, [nodes, edges, sim, theme, view, lat, flash]);

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
      const c = toCanvas(e.clientX, e.clientY);
      setGhost(c);

      if (drag.current) {
        const d = drag.current;
        const dx = (e.clientX - d.startX) / zoomRef.current;
        const dy = (e.clientY - d.startY) / zoomRef.current;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
        setNodes((prev) =>
          prev.map((n) =>
            d.origins[n.id]
              ? { ...n, x: d.origins[n.id].x + dx, y: d.origins[n.id].y + dy }
              : n,
          ),
        );
      } else if (panDrag.current) {
        const p = panDrag.current;
        setPan({
          x: p.ox + (e.clientX - p.startX),
          y: p.oy + (e.clientY - p.startY),
        });
      } else if (marqueeStart.current) {
        const s = marqueeStart.current;
        setMarquee({
          x: Math.min(s.x, c.x),
          y: Math.min(s.y, c.y),
          w: Math.abs(c.x - s.x),
          h: Math.abs(c.y - s.y),
        });
      }

      if (wiring.current) {
        const t = hitTest(c, nodesRef.current);
        setWireHover(t && t !== wiring.current ? t : null);
      }
    };

    const up = (e: PointerEvent) => {
      const c = toCanvas(e.clientX, e.clientY);

      if (drag.current) {
        const d = drag.current;
        if (!d.moved && d.collapseTo) setSelection([d.collapseTo]);
        drag.current = null;
      }
      if (panDrag.current) {
        panDrag.current = null;
        setPanning(false);
      }
      if (marqueeStart.current) {
        const s = marqueeStart.current;
        marqueeStart.current = null;
        const rx = Math.min(s.x, c.x);
        const ry = Math.min(s.y, c.y);
        const rw = Math.abs(c.x - s.x);
        const rh = Math.abs(c.y - s.y);
        if (rw > 6 || rh > 6) {
          const ids = nodesRef.current
            .filter(
              (n) =>
                n.x < rx + rw &&
                n.x + NODE_W > rx &&
                n.y < ry + rh &&
                n.y + NODE_H > ry,
            )
            .map((n) => n.id);
          setSelection((prev) => Array.from(new Set([...prev, ...ids])));
        }
        setMarquee(null);
      }
      if (wiring.current) {
        const from = wiring.current;
        const t = hitTest(c, nodesRef.current);
        if (t && t !== from) {
          setEdges((prev) =>
            prev.some((x) => x.from === from && x.to === t)
              ? prev
              : [...prev, { id: `${from}->${t}`, from, to: t, mode: "read" }],
          );
        }
        wiring.current = null;
        setWireFrom(null);
        setWireHover(null);
      }
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
        setEdges((prev) =>
          prev.some((x) => x.from === linkFrom && x.to === id)
            ? prev
            : [
                ...prev,
                { id: `${linkFrom}->${id}`, from: linkFrom, to: id, mode: "read" },
              ],
        );
        setLinkFrom(null);
      }
      return;
    }

    if (e.shiftKey) {
      setSelection((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
      return;
    }

    const already = selection.includes(id);
    const ids = already ? selection : [id];
    if (!already) setSelection([id]);

    const origins: Record<string, { x: number; y: number }> = {};
    for (const nid of ids) {
      const n = nodes.find((x) => x.id === nid);
      if (n) origins[nid] = { x: n.x, y: n.y };
    }
    drag.current = {
      ids,
      origins,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      collapseTo: already && selection.length > 1 ? id : null,
    };
  };

  const onPortDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    wiring.current = id;
    setWireFrom(id);
    setWireHover(null);
  };

  const onBgPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".node-card")) return;
    if (linkMode) {
      setLinkFrom(null);
      return;
    }
    if (wiring.current) return;

    if (e.shiftKey) {
      const p = toCanvas(e.clientX, e.clientY);
      marqueeStart.current = p;
      setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
      return;
    }
    if (selection.length) setSelection([]);
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
    setSelection([id]);
  };

  const deleteNodes = (ids: string[]) => {
    const set = new Set(ids);
    setNodes((prev) => prev.filter((n) => !set.has(n.id)));
    setEdges((prev) => prev.filter((e) => !set.has(e.from) && !set.has(e.to)));
    setDead((d) => d.filter((x) => !set.has(x)));
    setSelection([]);
    setLinkFrom(null);
  };

  const setEdgeMode = (id: string, mode: Edge["mode"]) =>
    setEdges((prev) => prev.map((e) => (e.id === id ? { ...e, mode } : e)));

  const fit = () => fitTo(nodes);

  /* ---------------- derived ---------------- */
  const previewId = wireFrom ?? linkFrom;
  const previewNode = previewId ? nodes.find((n) => n.id === previewId) : undefined;
  const hoverNode = wireHover ? nodes.find((n) => n.id === wireHover) : undefined;
  const hasTargets = nodes.some((n) => !CATALOG[n.kind].source);
  const deadNames = dead
    .map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean)
    .map((n) => shortName(n!.kind));

  let previewPath: string | null = null;
  if (previewNode && (wireFrom || (linkFrom && ghost))) {
    const x1 = previewNode.x + NODE_W;
    const y1 = previewNode.y + NODE_H / 2;
    const x2 = hoverNode ? hoverNode.x : (ghost?.x ?? x1);
    const y2 = hoverNode ? hoverNode.y + NODE_H / 2 : (ghost?.y ?? y1);
    const mx = (x1 + x2) / 2;
    previewPath = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }

  const grade = challenge
    ? (() => {
        const holds = !sim.worst;
        const underBudget = bill.total <= challenge.budget;
        const noSpof = spofs.size === 0;
        return {
          holds,
          underBudget,
          noSpof,
          pass: holds && underBudget && (!challenge.requireNoSpof || noSpof),
        };
      })()
    : null;

  const slowest = lat.slowestId ? nodes.find((n) => n.id === lat.slowestId) : null;

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      {/* ============ TOP BAR ============ */}
      <header className="z-20 flex flex-col gap-2 border-b border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[17px] font-extrabold tracking-tight">
              FLOW STUDIO
            </span>
            <span className="mono hidden text-[10px] text-[var(--color-muted)] lg:inline">
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
                className="w-28"
              />
              <span className="w-14 text-right font-bold text-[var(--color-accent)]">
                {fmtUsers(users)}
              </span>
            </div>
            <Readout label="req/s" value={fmt(sim.rps)} tone="accent" />
            <Readout label="p99" value={fmtMs(lat.endToEnd)} tone="accent" />
            <Readout label="$/mo" value={fmtMoney(bill.total)} tone="good" />
            <button
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              title="toggle theme"
              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-3 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              {theme === "light" ? "☾ dark" : "☀ light"}
            </button>
          </div>
        </div>

        {/* toolbar */}
        <div className="mono flex flex-wrap items-center gap-1.5 text-[10px]">
          <div className="flex overflow-hidden rounded-lg border border-[var(--color-line)]">
            {(["info", "cost", "latency"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1.5 transition ${
                  view === v
                    ? "bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-[var(--color-accent)]"
                    : "bg-[var(--color-well)] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                }`}
              >
                {v === "info" ? "ℹ info" : v === "cost" ? "$ cost" : "⏱ latency"}
              </button>
            ))}
          </div>

          <Btn onClick={buildSmartStack} tone="accent" title="build a scalable default stack">
            ⚡ smart stack
          </Btn>
          <Btn onClick={autoScale} disabled={!sim.worst} tone="warn" title="scale every bottleneck clear of its load">
            🛠 auto-scale
          </Btn>
          <Btn onClick={replay} disabled={replaying || !sim.worst} tone="good" title="watch the system heal itself, step by step">
            {replaying ? "🎬 replaying…" : "🎬 watch the fix"}
          </Btn>

          <span className="mx-1 h-4 w-px bg-[var(--color-line)]" />

          <Btn onClick={chaosKill} tone="bad" title="kill a component and watch the fallout">
            💥 chaos
          </Btn>
          <Btn onClick={reviveAll} disabled={!dead.length} title="bring everything back online">
            ↺ revive all
          </Btn>

          <span className="mx-1 h-4 w-px bg-[var(--color-line)]" />

          <Btn onClick={addRegion} title="clone the stack into a second region">
            🌍 + region
          </Btn>
          <Btn onClick={() => record("snapshot")} title="record this design on the cost/latency chart">
            📌 record
          </Btn>
          <Btn onClick={() => setShowChart((v) => !v)} active={showChart} title="cost vs latency chart">
            📊 chart
          </Btn>
          <Btn onClick={doShare} title="copy a shareable link to this design">
            🔗 share
          </Btn>
          <Btn onClick={exportSvg} title="download the diagram as SVG">
            ⬇ svg
          </Btn>
          <Btn onClick={exportPng} title="download the diagram as PNG">
            ⬇ png
          </Btn>
          <Btn onClick={fit} title="zoom to fit">
            fit
          </Btn>

          <span className="mx-1 h-4 w-px bg-[var(--color-line)]" />
          <Btn
            onClick={clearAll}
            tone={confirmClear ? "bad" : "default"}
            title="remove every component and link from the canvas"
          >
            {confirmClear ? "⚠ click again" : "🧹 clear all"}
          </Btn>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ============ SIDEBAR ============ */}
        <aside className="z-10 flex w-[306px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-[var(--color-line)] bg-[var(--color-panel)] p-3">
          <div className="panel fade-in rounded-xl p-3">
            <div className="mono text-[10px] uppercase tracking-widest text-[var(--color-accent)]">
              {meta.index} / {meta.title}
            </div>
            <div className="mt-1 text-[14px] font-semibold leading-snug">
              {meta.blurb}
            </div>
          </div>

          {challenge && grade && (
            <Section title="challenge">
              <div className="panel rounded-xl p-3">
                <div className="mono mb-2 text-[9px] uppercase tracking-widest text-[var(--color-muted)]">
                  budget {fmtMoney(challenge.budget)}/mo
                </div>
                <div className="mono flex flex-col gap-1 text-[10px]">
                  <Grade ok={grade.holds} label="system holds under load" />
                  <Grade ok={grade.underBudget} label="within budget" />
                  {challenge.requireNoSpof && (
                    <Grade ok={grade.noSpof} label="no single point of failure" />
                  )}
                </div>
                <div
                  className={`mono mt-2.5 rounded-lg px-2.5 py-2 text-center text-[11px] font-bold ${
                    grade.pass
                      ? "bg-[color-mix(in_srgb,var(--color-good)_14%,transparent)] text-[var(--color-good)]"
                      : "bg-[color-mix(in_srgb,var(--color-bad)_12%,transparent)] text-[var(--color-bad)]"
                  }`}
                >
                  {grade.pass ? "✓ PASSED" : "not yet"}
                </div>
                <button
                  onClick={() => setChallenge(null)}
                  className="mono mt-2 w-full text-[9px] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                >
                  exit challenge
                </button>
              </div>
            </Section>
          )}

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
                  <span className="font-bold text-[var(--color-accent)]">{s.index}</span>
                  <span className="truncate">{s.title}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="⚔ challenges">
            <div className="flex flex-col gap-1.5">
              {CHALLENGES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => loadChallenge(c)}
                  className={`mono rounded-lg border px-2.5 py-2 text-left text-[10px] transition ${
                    challenge?.id === c.id
                      ? "border-[var(--color-warn)] bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] text-[var(--color-ink)]"
                      : "border-[var(--color-line)] bg-[var(--color-well)] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <div className="font-bold">{c.title}</div>
                  <div className="mt-0.5 text-[9px] leading-snug opacity-80">
                    {c.brief}
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {selection.length > 1 ? (
            <div className="panel fade-in rounded-xl p-4">
              <div className="mono mb-2 text-[10px] uppercase tracking-widest text-[var(--color-accent)]">
                multi-select
              </div>
              <div className="mb-3 text-[12px] text-[var(--color-muted)]">
                <span className="font-bold text-[var(--color-ink)]">
                  {selection.length}
                </span>{" "}
                components selected — drag any of them to move the whole group.
              </div>
              <button
                onClick={() => deleteNodes(selection)}
                className="mono w-full rounded-lg border border-[color-mix(in_srgb,var(--color-bad)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-bad)_8%,transparent)] py-1.5 text-[10.5px] text-[var(--color-bad)] transition hover:bg-[color-mix(in_srgb,var(--color-bad)_14%,transparent)]"
              >
                delete {selection.length} components
              </button>
            </div>
          ) : (
            <Inspector
              sim={selectedId ? sim.nodes[selectedId] : null}
              cost={selectedId ? costOf(sim.nodes[selectedId]) : null}
              latency={selectedId ? (lat.perNode[selectedId] ?? 0) : 0}
              baseLatency={selectedId ? (lat.basePerNode[selectedId] ?? 0) : 0}
              spof={selectedId ? spofs.has(selectedId) : false}
              onDelete={() => selectedId && deleteNodes([selectedId])}
              onCapacity={(v) =>
                setNodes((prev) =>
                  prev.map((n) => (n.id === selectedId ? { ...n, capacity: v } : n)),
                )
              }
              onToggleDead={() => selectedId && toggleDead(selectedId)}
              onClose={() => setSelection([])}
            />
          )}

          <Section title="monthly bill">
            <div className="panel rounded-xl p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="mono text-[9px] uppercase tracking-widest text-[var(--color-muted)]">
                  total / month
                </span>
                <span className="mono text-[16px] font-extrabold text-[var(--color-good)]">
                  {fmtMoney(bill.total)}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {bill.rows
                  .filter((r) => r.cost.total > 0.5)
                  .slice(0, 5)
                  .map((r) => {
                    const pct = bill.total ? (r.cost.total / bill.total) * 100 : 0;
                    return (
                      <div key={r.id}>
                        <div className="mono mb-0.5 flex items-center justify-between text-[9.5px]">
                          <span className="truncate text-[var(--color-muted)]">
                            {r.name}
                          </span>
                          <span className="shrink-0 font-semibold text-[var(--color-ink)]">
                            {fmtMoney(r.cost.total)}
                          </span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-well)]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: r.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                {bill.total === 0 && (
                  <div className="mono text-[9.5px] text-[var(--color-muted)]">
                    nothing running — $0/mo
                  </div>
                )}
              </div>
            </div>
          </Section>

          {lat.endToEnd > 0 && (
            <Section title="latency budget">
              <div className="panel rounded-xl p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="mono text-[9px] uppercase tracking-widest text-[var(--color-muted)]">
                    end-to-end p99
                  </span>
                  <span className="mono text-[16px] font-extrabold text-[var(--color-accent)]">
                    {fmtMs(lat.endToEnd)}
                  </span>
                </div>
                {slowest && (
                  <div className="mono text-[9.5px] leading-relaxed text-[var(--color-muted)]">
                    slowest hop:{" "}
                    <span className="font-semibold text-[var(--color-ink)]">
                      {shortName(slowest.kind)}
                    </span>{" "}
                    at {fmtMs(lat.slowestMs)}
                    {lat.slowestMs > lat.basePerNode[slowest.id] * 1.5 && (
                      <span className="text-[var(--color-warn)]">
                        {" "}
                        — mostly queueing, not the code
                      </span>
                    )}
                  </div>
                )}
                <div className="mono mt-2 text-[8px] leading-relaxed text-[var(--color-muted)]">
                  p99 = slowest path · saturated hops balloon (queueing delay)
                </div>
              </div>
            </Section>
          )}

          {showChart && (
            <Section title="cost vs latency">
              <CostLatencyChart
                points={history}
                current={{ cost: bill.total, latency: lat.endToEnd }}
                onClear={() => setHistory([])}
              />
            </Section>
          )}

          {(dead.length > 0 || spofs.size > 0) && (
            <Section title="health">
              <div className="panel rounded-xl p-3">
                {dead.length > 0 && (
                  <div className="mono mb-2 text-[10px] leading-relaxed text-[var(--color-bad)]">
                    💥 down: {deadNames.join(", ")} — {fmt(sim.dropped)} req/s
                    dropped
                  </div>
                )}
                {spofs.size > 0 && (
                  <div className="mono text-[10px] leading-relaxed text-[var(--color-warn)]">
                    ⚠ {spofs.size} single point
                    {spofs.size > 1 ? "s" : ""} of failure — kill any one and
                    part of the system goes dark.
                  </div>
                )}
                {dead.length === 0 && spofs.size === 0 && (
                  <div className="mono text-[10px] text-[var(--color-good)]">
                    ◉ no failures, no single points of failure
                  </div>
                )}
              </div>
            </Section>
          )}

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
                        {a ? shortName(a.kind) : "?"}
                        {" → "}
                        {b ? CATALOG[b.kind].glyph : "?"}{" "}
                        {b ? shortName(b.kind) : "?"}
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
              <Legend c="var(--color-bad)" t="overloaded or down" />
              <Legend c="var(--color-warn)" t="single point of failure" />
              <Legend c="var(--edge-read)" t="read path" />
              <Legend c="var(--edge-write)" t="write path" />
              <Legend c="var(--edge-async)" t="async / queued" />
            </div>
          </Section>

          <div className="mono px-1 pb-2 text-[8.5px] leading-relaxed text-[var(--color-muted)]">
            drag the <span className="text-[var(--color-accent)]">●</span> port of
            a node onto another node to connect · drag a node to move it ·
            shift-click or shift-drag to select many · scroll to zoom · drag bg
            to pan
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
                const srcDead = sim.nodes[e.from]?.dead;
                const bad = se?.overloaded && !srcDead;
                const dim = srcDead;
                const col = bad
                  ? "var(--color-bad)"
                  : dim
                    ? "var(--color-line)"
                    : EDGE_COLOR[e.mode];
                const x1 = a.x + NODE_W;
                const y1 = a.y + NODE_H / 2;
                const x2 = b.x;
                const y2 = b.y + NODE_H / 2;
                const mx = (x1 + x2) / 2;
                const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2 - 6} ${y2}`;
                const dotx = 0.125 * x1 + 0.375 * mx + 0.375 * mx + 0.125 * (x2 - 6);
                const doty = 0.5 * y1 + 0.5 * y2;
                return (
                  <g key={e.id}>
                    <path d={d} fill="none" stroke={col} strokeOpacity={0.28} strokeWidth={2.4} />
                    <path
                      d={d}
                      fill="none"
                      stroke={col}
                      strokeWidth={2.4}
                      className={`edge-flow ${bad ? "fast" : ""}`}
                      markerEnd={`url(#arrow-${bad ? "bad" : e.mode})`}
                    />
                    {!dim && (
                      <circle cx={dotx} cy={doty} r={3.2} fill={col} className="pulse-dot" />
                    )}
                  </g>
                );
              })}

              {previewPath && (
                <path
                  d={previewPath}
                  stroke={hoverNode ? "var(--color-good)" : "var(--color-accent)"}
                  strokeWidth={2}
                  strokeDasharray="5 6"
                  fill="none"
                />
              )}
            </svg>

            {marquee && (
              <div
                className="absolute rounded border border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]"
                style={{
                  left: marquee.x,
                  top: marquee.y,
                  width: marquee.w,
                  height: marquee.h,
                }}
              />
            )}

            {nodes.map((n) => (
              <NodeCard
                key={n.id}
                n={n}
                sim={sim.nodes[n.id]}
                cost={costOf(sim.nodes[n.id])}
                latency={lat.perNode[n.id] ?? 0}
                view={view}
                spof={spofs.has(n.id)}
                selected={selection.includes(n.id)}
                linkSource={linkFrom === n.id}
                linkTarget={linkMode && !!linkFrom && linkFrom !== n.id}
                wireSource={wireFrom === n.id}
                wireTarget={wireHover === n.id}
                onPointerDown={onNodePointerDown}
                onPortDown={onPortDown}
              />
            ))}
          </div>

          {/* headline banner */}
          {dead.length > 0 && (
            <Banner tone="bad">
              💥 <b>{deadNames.join(" + ")}</b> is DOWN — {fmt(sim.dropped)} req/s
              dropped{sim.worst ? "" : ", rest of the system absorbed it"}
            </Banner>
          )}
          {dead.length === 0 && sim.worst && (
            <Banner tone="bad">
              <b>{CATALOG[sim.worst.node.kind].name.toUpperCase()}</b> is your
              bottleneck — {Math.round(sim.worst.load * 100)}% of capacity
            </Banner>
          )}
          {dead.length === 0 && !sim.worst && hasTargets && (
            <Banner tone="good">
              ◉ every component under capacity — the system holds
            </Banner>
          )}
          {dead.length > 0 && !sim.worst && (
            <Banner tone="warn">
              ⚠ degraded but standing — p99 {fmtMs(lat.endToEnd)}
            </Banner>
          )}

          {toast && (
            <div className="fade-in pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2">
              <div className="mono rounded-lg border border-[var(--color-line)] bg-[var(--color-strip)] px-3 py-2 text-[10px] text-[var(--color-ink)] backdrop-blur">
                {toast}
              </div>
            </div>
          )}

          <div className="mono pointer-events-none absolute bottom-0 left-0 right-0 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--color-line)] bg-[var(--color-strip)] px-4 py-1.5 text-[9.5px] text-[var(--color-muted)] backdrop-blur">
            <span className="text-[var(--color-accent)]">SIMULATED WORKLOAD</span>
            <span>· {nodes.length} components</span>
            <span>· {edges.length} links</span>
            <span>· {fmt(sim.rps)} req/s in</span>
            <span className="text-[var(--color-accent)]">· {fmtMs(lat.endToEnd)} p99</span>
            <span className="text-[var(--color-good)]">· {fmtMoney(bill.total)}/mo</span>
            {spofs.size > 0 && (
              <span className="text-[var(--color-warn)]">· {spofs.size} SPOF</span>
            )}
            {dead.length > 0 && (
              <span className="text-[var(--color-bad)]">· {dead.length} down</span>
            )}
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

/* ---------------- small pieces ---------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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

function Readout({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "accent" | "good" | "bad";
}) {
  const color =
    tone === "accent"
      ? "var(--color-accent)"
      : tone === "good"
        ? "var(--color-good)"
        : "var(--color-bad)";
  return (
    <span className="flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-3 py-1.5">
      <span className="uppercase text-[var(--color-muted)]">{label}</span>
      <span className="font-bold" style={{ color }}>
        {value}
      </span>
    </span>
  );
}

function Btn({
  onClick,
  children,
  tone = "default",
  active,
  disabled,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "accent" | "good" | "bad" | "warn";
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const tones: Record<string, string> = {
    default: "",
    accent: "border-[var(--color-accent)] text-[var(--color-accent)]",
    good: "border-[color-mix(in_srgb,var(--color-good)_45%,transparent)] text-[var(--color-good)]",
    bad: "border-[var(--color-bad-border)] text-[var(--color-bad)]",
    warn: "border-[color-mix(in_srgb,var(--color-warn)_45%,transparent)] text-[var(--color-warn)]",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-lg border px-2.5 py-1.5 transition ${
        disabled
          ? "border-[var(--color-line)] bg-[var(--color-well)] text-[var(--color-muted)] opacity-40"
          : active
            ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent)]"
            : `${tones[tone] || "border-[var(--color-line)]"} bg-[var(--color-well)] ${
                tone === "default"
                  ? "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  : "hover:bg-[var(--color-panel2)]"
              }`
      }`}
    >
      {children}
    </button>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "good" | "bad" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    tone === "good"
      ? "border-[var(--color-good-border)] bg-[var(--color-good-soft)] text-[var(--color-good)]"
      : tone === "warn"
        ? "border-[color-mix(in_srgb,var(--color-warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] text-[var(--color-warn)]"
        : "border-[var(--color-bad-border)] bg-[var(--color-bad-soft)] text-[var(--color-ink)]";
  return (
    <div className="fade-in pointer-events-none absolute left-1/2 top-4 -translate-x-1/2">
      <div className={`mono rounded-xl border px-4 py-2 text-[11px] backdrop-blur ${cls}`}>
        {children}
      </div>
    </div>
  );
}

function Grade({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color: ok ? "var(--color-good)" : "var(--color-bad)" }}>
        {ok ? "✓" : "✕"}
      </span>
      <span className={ok ? "text-[var(--color-ink)]" : "text-[var(--color-muted)]"}>
        {label}
      </span>
    </div>
  );
}

function CostLatencyChart({
  points,
  current,
  onClear,
}: {
  points: { cost: number; latency: number; label: string }[];
  current: { cost: number; latency: number };
  onClear: () => void;
}) {
  const all = [...points, { ...current, label: "now" }];
  const W = 272;
  const H = 150;
  const pad = 26;
  const maxCost = Math.max(...all.map((p) => p.cost), 1) * 1.1;
  const maxLat = Math.max(...all.map((p) => p.latency), 1) * 1.15;
  const px = (c: number) => pad + (c / maxCost) * (W - pad - 10);
  const py = (l: number) => H - pad - (l / maxLat) * (H - pad - 16);

  if (!points.length) {
    return (
      <div className="panel mono rounded-xl p-3 text-[9.5px] leading-relaxed text-[var(--color-muted)]">
        Hit <span className="text-[var(--color-accent)]">📌 record</span> to plot
        each design you build. Cheapest sits bottom-left, fastest top-left — the
        sweet spot is the low-and-left corner.
      </div>
    );
  }

  return (
    <div className="panel rounded-xl p-3">
      <svg width={W} height={H} className="overflow-visible">
        <line x1={pad} y1={H - pad} x2={W - 6} y2={H - pad} stroke="var(--color-line)" />
        <line x1={pad} y1={12} x2={pad} y2={H - pad} stroke="var(--color-line)" />
        <text x={pad} y={H - 8} fill="var(--color-muted)" fontSize="9" fontFamily="monospace">
          cost →
        </text>
        <text x={4} y={12} fill="var(--color-muted)" fontSize="9" fontFamily="monospace">
          p99 ↑
        </text>
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={px(p.cost)} cy={py(p.latency)} r={3.5} fill="var(--color-accent)" opacity={0.75} />
            <text
              x={px(p.cost) + 5}
              y={py(p.latency) + 3}
              fill="var(--color-muted)"
              fontSize="7.5"
              fontFamily="monospace"
            >
              {p.label.slice(0, 12)}
            </text>
          </g>
        ))}
        <circle cx={px(current.cost)} cy={py(current.latency)} r={5} fill="var(--color-good)" />
        <text
          x={px(current.cost) + 7}
          y={py(current.latency) + 3}
          fill="var(--color-good)"
          fontSize="8"
          fontFamily="monospace"
        >
          now
        </text>
      </svg>
      <button
        onClick={onClear}
        className="mono mt-1.5 text-[9px] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        clear {points.length} point{points.length > 1 ? "s" : ""}
      </button>
    </div>
  );
}
