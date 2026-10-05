"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CATALOG,
  CHALLENGES,
  SCALE_PRESETS,
  SCENARIOS,
  addSecondRegion,
  billOf,
  costOf,
  fmt,
  fmtMoney,
  fmtUsers,
  newId,
  provisionCapacity,
  shortName,
  simulate,
  smartStack,
  type Challenge,
  type Edge,
  type FlowNode,
  type NodeKind,
  type ScalePreset,
} from "@/lib/design";
import {
  BUSINESSES,
  HERO_STAGES,
  HERO_START_BUSINESS,
  HERO_START_CASH,
  HERO_START_USERS,
  PIVOT_CHURN,
  businessById,
  countsAsClient,
  heroTick,
  nextStage,
  pitchAmount,
  pitchOdds,
  purchasePrice,
  revenueFor,
  sellPrice,
  stageIndexFor,
  unlockedUpTo,
  type Business,
} from "@/lib/hero";
import { analyzeLatency, findSpofs, fmtMs } from "@/lib/analysis";
import { explainDesign } from "@/lib/explain";
import { toDockerCompose, toTerraform } from "@/lib/iac";
import {
  deleteSaved,
  designToSVG,
  download,
  listSaved,
  loadSavedDesign,
  readSharedDesign,
  saveDesign,
  shareUrl,
  svgToPng,
  type SavedDesign,
} from "@/lib/share";
import NodeCard, { NODE_H, NODE_W, type View } from "./NodeCard";
import Inspector, { Palette } from "./Inspector";
import ModeScreen, { type Mode } from "./ModeScreen";

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

const TOUR: { title: string; body: string }[] = [
  {
    title: "Welcome to Flow Studio",
    body: "This is a system design. Users flow through components, and each component forwards traffic downstream. Red means a component is over capacity — that's your bottleneck.",
  },
  {
    title: "Wire things together",
    body: "Drag the ● port on a node's right edge onto another node to connect them. Drag a node to move it. Shift-click or shift-drag a box to select several and move them as a group.",
  },
  {
    title: "Crank the load",
    body: "The users slider top-right is the stress test. Push it up and watch which component turns red first. Use the real-world presets to see the same design at four different sizes.",
  },
  {
    title: "Read the numbers",
    body: "$ cost and ⏱ latency change what every node shows: monthly dollars or p99 milliseconds. The sidebar totals the bill, the end-to-end latency, and any single points of failure.",
  },
  {
    title: "Break it on purpose",
    body: "💥 chaos kills a component so you can watch the fallout. 🎬 watch the fix heals the system one bottleneck at a time. ⚔ challenges give you a budget and a goal to hit. 🧹 clear all wipes the canvas.",
  },
  {
    title: "Clean up",
    body: "↩ undo (⌘Z) and ↪ redo (⌘⇧Z) step through your changes. Delete key removes whatever's selected. 💾 save keeps a design in this browser; 🔗 share copies a link; ⬇ exports SVG, PNG, Terraform or docker-compose.",
  },
];

export default function FlowStudio() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [booted, setBooted] = useState(false);
  const [scenarioId, setScenarioId] = useState("");
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [users, setUsers] = useState(500000);
  const [selection, setSelection] = useState<string[]>([]);
  const [meta, setMeta] = useState({
    index: "🧪",
    title: "START",
    blurb: "Choose how you want to start.",
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
  const [showExplain, setShowExplain] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [saved, setSaved] = useState<SavedDesign[]>([]);
  const [savedName, setSavedName] = useState("");
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /* ---- zero → hero progression ---- */
  const [hero, setHero] = useState({
    cash: HERO_START_CASH,
    month: 0,
    businessId: HERO_START_BUSINESS,
    running: false,
    raises: 0,
    bankrupt: false,
    freebies: 0,
  });
  const [showPivot, setShowPivot] = useState(false);
  const [pitchMsg, setPitchMsg] = useState<string | null>(null);

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

  /* ---------- boot: a shared link skips the mode screen ---------- */
  useEffect(() => {
    const shared = readSharedDesign();
    /* eslint-disable react-hooks/set-state-in-effect */
    if (shared) {
      setNodes(shared.nodes);
      setEdges(shared.edges);
      setUsers(shared.users);
      setDead(shared.dead);
      setMode("shared");
      setScenarioId("");
      setMeta({
        index: "🔗",
        title: "SHARED DESIGN",
        blurb: "A build someone sent you. Poke at it — nothing here is saved.",
      });
      setSaved(listSaved());
      setBooted(true);
      /* eslint-enable react-hooks/set-state-in-effect */
      window.setTimeout(() => fitTo(shared.nodes), 60);
      flash("shared design loaded");
      return;
    }
    setSaved(listSaved());
    setBooted(true);
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

  const chooseMode = useCallback(
    (m: Mode) => {
      setMode(m);
      setSelection([]);
      setLinkFrom(null);
      setWireFrom(null);
      setLinkMode(false);
      setDead([]);
      setHistory([]);
      setSavedName("");
      setShowPivot(false);
      setPitchMsg(null);

      if (m === "sandbox") {
        setNodes([]);
        setEdges([]);
        setChallenge(null);
        setScenarioId("");
        setUsers(500000);
        setZoom(0.9);
        setPan({ x: 30, y: 20 });
        setMeta({
          index: "🧪",
          title: "SANDBOX",
          blurb:
            "Empty canvas — no budget, no rules. Add components below, then drag a ● port onto another node to wire them up.",
        });
      } else if (m === "hero") {
        setHero({
          cash: HERO_START_CASH,
          month: 0,
          businessId: HERO_START_BUSINESS,
          running: false,
          raises: 0,
          bankrupt: false,
          freebies: 0,
        });
        setNodes([]);
        setEdges([]);
        setChallenge(null);
        setScenarioId("");
        setUsers(HERO_START_USERS);
        setZoom(1);
        setPan({ x: 60, y: 40 });
        const st0 = HERO_STAGES[0];
        setMeta({
          index: st0.glyph,
          title: st0.name.toUpperCase(),
          blurb: st0.blurb,
        });
        flash("🌱 25 users, $0 in the bank, no revenue model — go");
      } else if (m === "scenarios") {
        loadScenario(SCENARIOS[0].id);
      } else if (m === "challenges") {
        loadChallenge(CHALLENGES[0]);
      }

      // the tour describes tools that zero → hero deliberately hides
      try {
        if (
          m !== "hero" &&
          !window.localStorage.getItem("flowstudio.toured")
        ) {
          setTourStep(0);
        }
      } catch {
        /* ignore */
      }
    },
    [flash, loadScenario, loadChallenge],
  );

  const changeMode = useCallback(() => {
    setMode(null);
    setTourStep(null);
  }, []);

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
        return { ...n, capacity: provisionCapacity(n.kind, sn.inflow) };
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
                capacity: provisionCapacity(
                  worst.kind,
                  curSim.nodes[worst.id].inflow,
                ),
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
    // zero → hero: components must be bought, or paid for with a free-node credit
    if (mode === "hero") {
      const price = purchasePrice(kind);
      if (price > 0) {
        if (hero.freebies > 0) {
          setHero((h) => ({ ...h, freebies: h.freebies - 1 }));
          flash(
            `${shortName(kind)} — 🎁 free node used (${hero.freebies - 1} left)`,
          );
        } else if (hero.cash >= price) {
          setHero((h) => ({ ...h, cash: h.cash - price }));
          flash(`bought ${shortName(kind)} for ${fmtMoney(price)}`);
        } else {
          flash(
            `can't afford ${shortName(kind)} — ${fmtMoney(price)}, you have ${fmtMoney(hero.cash)}`,
          );
          return;
        }
      }
    }

    const r = wrapRef.current?.getBoundingClientRect();
    const c = r
      ? toCanvas(r.left + r.width / 2, r.top + r.height / 2)
      : { x: 300, y: 200 };
    const id = newId(kind);

    // nudge right/down until the new node doesn't land on top of an existing one
    const cx = c.x - NODE_W / 2;
    const cy = c.y - NODE_H / 2;
    const pad = 14;
    const hits = (px: number, py: number) =>
      nodes.some(
        (n) =>
          px < n.x + NODE_W + pad &&
          px + NODE_W + pad > n.x &&
          py < n.y + NODE_H + pad &&
          py + NODE_H + pad > n.y,
      );
    let x = cx;
    let y = cy;
    for (let guard = 0; guard < 60 && hits(x, y); guard++) {
      x += NODE_W + pad;
      if (guard % 4 === 3) {
        x = cx;
        y += NODE_H + pad;
      }
    }

    setNodes((prev) => [...prev, { id, kind, x, y }]);
    setSelection([id]);
  };

  const deleteNodes = useCallback(
    (ids: string[]) => {
    const set = new Set(ids);
    // zero → hero: selling up returns half of what you paid
    if (mode === "hero") {
      const refund = nodes
        .filter((n) => set.has(n.id))
        .reduce((sum, n) => sum + sellPrice(n.kind), 0);
      if (refund > 0) {
        setHero((h) => ({ ...h, cash: h.cash + refund }));
        flash(
          `sold ${ids.length} component${ids.length === 1 ? "" : "s"} for ${fmtMoney(refund)}`,
        );
      }
    }
    setNodes((prev) => prev.filter((n) => !set.has(n.id)));
    setEdges((prev) => prev.filter((e) => !set.has(e.from) && !set.has(e.to)));
    setDead((d) => d.filter((x) => !set.has(x)));
    setSelection([]);
    setLinkFrom(null);
    },
    [mode, nodes, flash],
  );

  const setEdgeMode = (id: string, mode: Edge["mode"]) =>
    setEdges((prev) => prev.map((e) => (e.id === id ? { ...e, mode } : e)));

  const fit = () => fitTo(nodes);

  /* ---------------- undo / redo ---------------- */
  const past = useRef<{ nodes: FlowNode[]; edges: Edge[]; dead: string[] }[]>([]);
  const future = useRef<{ nodes: FlowNode[]; edges: Edge[]; dead: string[] }[]>(
    [],
  );
  const lastSnap = useRef({ nodes, edges, dead });
  const pendingSnap = useRef<{
    nodes: FlowNode[];
    edges: Edge[];
    dead: string[];
  } | null>(null);
  const histTimer = useRef<number | null>(null);

  // capture one history entry per settled burst of changes (so a drag is one step)
  useEffect(() => {
    const prev = lastSnap.current;
    if (prev.nodes === nodes && prev.edges === edges && prev.dead === dead) return;
    lastSnap.current = { nodes, edges, dead };
    if (!pendingSnap.current) pendingSnap.current = prev;
    if (histTimer.current) window.clearTimeout(histTimer.current);
    histTimer.current = window.setTimeout(() => {
      if (!pendingSnap.current) return;
      past.current.push(pendingSnap.current);
      if (past.current.length > 80) past.current.shift();
      future.current = [];
      pendingSnap.current = null;
      setCanUndo(true);
      setCanRedo(false);
    }, 340);
  }, [nodes, edges, dead]);

  const undo = useCallback(() => {
    const p = past.current.pop();
    if (!p) return;
    future.current.push({ nodes, edges, dead });
    if (histTimer.current) window.clearTimeout(histTimer.current);
    pendingSnap.current = null;
    lastSnap.current = p;
    setNodes(p.nodes);
    setEdges(p.edges);
    setDead(p.dead);
    setSelection([]);
    setCanRedo(true);
    setCanUndo(past.current.length > 0);
  }, [nodes, edges, dead]);

  const redo = useCallback(() => {
    const f = future.current.pop();
    if (!f) return;
    past.current.push({ nodes, edges, dead });
    if (histTimer.current) window.clearTimeout(histTimer.current);
    pendingSnap.current = null;
    lastSnap.current = f;
    setNodes(f.nodes);
    setEdges(f.edges);
    setDead(f.dead);
    setSelection([]);
    setCanUndo(true);
    setCanRedo(future.current.length > 0);
  }, [nodes, edges, dead]);

  /* ---------------- library / presets / exports ---------------- */
  const applyPreset = useCallback(
    (p: ScalePreset) => {
      setUsers(p.users);
      flash(`${p.name} — ${p.blurb}`);
      window.setTimeout(() => record(p.name), 260);
    },
    [flash, record],
  );

  const doSave = useCallback(() => {
    const name = savedName.trim() || "untitled";
    setSaved(saveDesign(name, { nodes, edges, users, dead }));
    setSavedName("");
    flash(`saved “${name}”`);
  }, [savedName, nodes, edges, users, dead, flash]);

  const doLoad = useCallback(
    (d: SavedDesign) => {
      const st = loadSavedDesign(d);
      if (!st) {
        flash("could not load that design");
        return;
      }
      setNodes(st.nodes);
      setEdges(st.edges);
      setUsers(st.users);
      setDead(st.dead);
      setSelection([]);
      setChallenge(null);
      setScenarioId("");
      setMeta({
        index: "💾",
        title: d.name.toUpperCase(),
        blurb: "Loaded from your library. Saved in this browser only.",
      });
      fitTo(st.nodes);
      flash(`loaded “${d.name}”`);
    },
    [fitTo, flash],
  );

  const doDeleteSaved = useCallback((id: string) => {
    setSaved(deleteSaved(id));
  }, []);

  const exportCompose = useCallback(() => {
    download("docker-compose.yml", toDockerCompose(nodes, edges, sim), "text/yaml");
    flash("docker-compose.yml downloaded");
  }, [nodes, edges, sim, flash]);

  const exportTerraform = useCallback(() => {
    download("main.tf", toTerraform(nodes, edges, sim), "text/plain");
    flash("main.tf downloaded");
  }, [nodes, edges, sim, flash]);

  const narration = useMemo(
    () =>
      explainDesign({
        nodes,
        edges,
        users,
        sim,
        total: bill.total,
        lat,
        spofs,
        dead,
        topCost: bill.rows
          .slice(0, 5)
          .map((r) => ({ name: r.name, total: r.cost.total })),
      }),
    [nodes, edges, users, sim, bill, lat, spofs, dead],
  );

  /* ---------------- keyboard shortcuts ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (typing) return;

      if (e.key === "Escape") {
        setSelection([]);
        setLinkFrom(null);
        setWireFrom(null);
        setLinkMode(false);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selection.length) {
        e.preventDefault();
        deleteNodes(selection);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selection, deleteNodes]);

  /* ---------------- first-run tour ---------------- */
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      if (!window.localStorage.getItem("flowstudio.toured")) setTourStep(0);
    } catch {
      /* private mode — skip the tour */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const closeTour = useCallback(() => {
    setTourStep(null);
    try {
      window.localStorage.setItem("flowstudio.toured", "1");
    } catch {
      /* ignore */
    }
  }, []);

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

  /* ---------------- zero → hero economy ---------------- */
  const heroStage = stageIndexFor(users);
  const biz = businessById(hero.businessId);
  // you only earn once a real client — a website or a mobile app — is wired to a backend
  const heroHasClient = nodes.some((n) => countsAsClient(n.kind));
  const heroHasSink = Object.values(sim.nodes).some(
    (sn) => !sn.entry.source && sn.inflow > 0.5,
  );
  const heroServing = heroHasClient && heroHasSink;
  const heroHealthy = heroServing && !sim.worst;
  const heroRevenue = heroServing ? revenueFor(users, biz.arpu) : 0;
  const heroNet = heroRevenue - bill.total;
  const heroUnlocked = mode === "hero" ? unlockedUpTo(heroStage) : undefined;
  const heroNext = nextStage(heroStage);
  const heroOdds = pitchOdds({
    users,
    stageIndex: heroStage,
    net: heroNet,
    healthy: heroHealthy,
    raises: hero.raises,
  });

  /** advance one or more months of the simulation */
  const rollMonths = (n: number) => {
      let u = users;
      let cash = hero.cash;
      let month = hero.month;
      let stage = heroStage;
      let bankrupt = false;
      let freebies = hero.freebies;
      let lastChurned = false;
      let lastGrew = false;
      const stageMsgs: string[] = [];

      for (let i = 0; i < n; i++) {
        const hasClient = nodes.some((x) => countsAsClient(x.kind));
        const hasSink = Object.values(sim.nodes).some(
          (sn) => !sn.entry.source && sn.inflow > 0.5,
        );
        const serving = hasClient && hasSink;
        const healthy = serving && !sim.worst;

        const r = heroTick({
          users: u,
          cash,
          month,
          stageIndex: stage,
          businessId: hero.businessId,
          cost: bill.total,
          serving,
          healthy,
          freebies,
        });

        u = r.users;
        cash = r.cash;
        month = r.month;
        stage = r.stageIndex;
        freebies = r.freebies;
        lastChurned = r.churned;
        lastGrew = r.grew;
        bankrupt = r.bankrupt;

        if (r.stageChanged) {
          const st = HERO_STAGES[stage];
          stageMsgs.push(
            `${st.glyph} ${st.name}${
              r.grant ? ` · ${r.grantLabel} +${fmtMoney(r.grant)}` : ""
            }${
              r.granted
                ? ` · 🎁 ${r.granted} free node${r.granted === 1 ? "" : "s"}`
                : ""
            }`,
          );
        }
        if (bankrupt) break;
      }

      const before = users;
      setUsers(u);
      setHero((h) => ({
        ...h,
        cash,
        month,
        bankrupt,
        freebies,
        running: bankrupt ? false : h.running,
      }));
      setPitchMsg(null);

      if (stageMsgs.length) {
        const st = HERO_STAGES[stage];
        setMeta({
          index: st.glyph,
          title: st.name.toUpperCase(),
          blurb: st.blurb,
        });
        flash(stageMsgs.join("   ·   "));
      } else if (bankrupt) {
        flash("💀 out of money");
      } else if (lastChurned) {
        flash(`⚠ over capacity — users are leaving (${fmt(u)})`);
      } else if (lastGrew) {
        flash(`${fmt(u)} users  (+${fmt(Math.max(0, u - before))})`);
      }
      return { bankrupt, users: u };
  };

  const rollRef = useRef(rollMonths);
  useEffect(() => {
    rollRef.current = rollMonths;
  });

  // auto-run: a month every 900ms while ▶ is on
  useEffect(() => {
    if (mode !== "hero" || !hero.running || hero.bankrupt) return;
    const t = window.setInterval(() => rollRef.current(1), 900);
    return () => window.clearInterval(t);
  }, [mode, hero.running, hero.bankrupt]);

  /** change what kind of business you are — costs you users */
  const pivotTo = (b: Business) => {
      setHero((h) => ({ ...h, businessId: b.id }));
      setUsers((u) => Math.max(1, Math.round(u * (1 - PIVOT_CHURN))));
      setShowPivot(false);
      setPitchMsg(null);
      flash(
        `pivoted to ${b.name} — ${Math.round(PIVOT_CHURN * 100)}% of your users left`,
      );
  };

  /** ask investors for money. a gamble. `roll` comes from the click handler. */
  const pitchRoll = (roll: number) => {
    const win = roll < heroOdds;
    if (win) {
      const amount = pitchAmount({ revenue: heroRevenue, stageIndex: heroStage });
      setHero((h) => ({ ...h, cash: h.cash + amount, raises: h.raises + 1 }));
      setPitchMsg(`✅ They're in — +${fmtMoney(amount)} for the round.`);
      flash(`raised ${fmtMoney(amount)}`);
    } else {
      setHero((h) => ({ ...h, raises: h.raises + 1 }));
      setPitchMsg("❌ They passed. “Come back with more traction.”");
      flash("the pitch fell flat");
    }
  };

  const heroRestart = () => {
    setHero({
      cash: HERO_START_CASH,
      month: 0,
      businessId: HERO_START_BUSINESS,
      running: false,
      raises: 0,
      bankrupt: false,
      freebies: 0,
    });
    setNodes([]);
    setEdges([]);
    setDead([]);
    setSelection([]);
    setUsers(HERO_START_USERS);
    setHistory([]);
    setPitchMsg(null);
    setShowPivot(false);
    const st0 = HERO_STAGES[0];
    setMeta({
      index: st0.glyph,
      title: st0.name.toUpperCase(),
      blurb: st0.blurb,
    });
    flash("back to nothing — 25 users, $0 in the bank");
  };

  const grade = challenge
    ? (() => {
        // "serves the load" — a source must actually reach something downstream,
        // otherwise an empty canvas would trivially "hold"
        const hasSource = nodes.some((n) => CATALOG[n.kind].source);
        const hasSink = Object.values(sim.nodes).some(
          (sn) => !sn.entry.source && sn.inflow > 0.5,
        );
        const serves = hasSource && hasSink;
        const holds = !sim.worst;
        const underBudget = bill.total <= challenge.budget;
        const noSpof = spofs.size === 0;
        return {
          serves,
          holds,
          underBudget,
          noSpof,
          pass:
            serves &&
            holds &&
            underBudget &&
            (!challenge.requireNoSpof || noSpof),
        };
      })()
    : null;

  const slowest = lat.slowestId ? nodes.find((n) => n.id === lat.slowestId) : null;

  // ── before the studio: splash, then the mode picker ──
  if (!booted) {
    return (
      <div className="grid min-h-screen w-full place-items-center">
        <span className="mono text-[11px] text-[var(--color-muted)]">
          loading flow studio…
        </span>
      </div>
    );
  }

  if (mode === null) {
    return (
      <ModeScreen
        onChoose={chooseMode}
        scenarioCount={SCENARIOS.length}
        challengeCount={CHALLENGES.length}
      />
    );
  }

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden">
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
            {mode === "hero" ? (
              <>
                <Readout
                  label="stage"
                  value={`${HERO_STAGES[heroStage].glyph} ${HERO_STAGES[heroStage].name}`}
                  tone="good"
                />
                <Readout label="users" value={fmt(users)} tone="accent" />
                <Readout label="mrr" value={fmtMoney(heroRevenue)} tone="good" />
                <Readout
                  label="bill"
                  value={fmtMoney(bill.total)}
                  tone={heroNet >= 0 ? "good" : "bad"}
                />
                <Readout
                  label="cash"
                  value={fmtMoney(hero.cash)}
                  tone={hero.cash >= 0 ? "good" : "bad"}
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-3 py-1.5">
                  <span className="uppercase text-[var(--color-muted)]">
                    users
                  </span>
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
                {challenge ? (
                  <Readout
                    label="spent"
                    value={`${fmtMoney(bill.total)} / ${fmtMoney(challenge.budget)}`}
                    tone={bill.total <= challenge.budget ? "good" : "bad"}
                  />
                ) : (
                  <Readout
                    label="$/mo"
                    value={fmtMoney(bill.total)}
                    tone="good"
                  />
                )}
              </>
            )}
            <button
              onClick={changeMode}
              title="back to the mode picker"
              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-3 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              ⇤ modes
            </button>
            {mode !== "hero" && (
              <button
                onClick={() => setTourStep(0)}
                title="how this works"
                className="rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-3 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              >
                ? help
              </button>
            )}
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
          {mode === "hero" && (
            <>
              <Btn onClick={undo} disabled={!canUndo} title="undo (⌘Z)">
                ↩ undo
              </Btn>
              <Btn onClick={redo} disabled={!canRedo} title="redo (⌘⇧Z)">
                ↪ redo
              </Btn>
              <span className="mx-1 h-4 w-px bg-[var(--color-line)]" />
              <Btn
                onClick={clearAll}
                tone={confirmClear ? "bad" : "default"}
                title="remove every component and link from the canvas"
              >
                {confirmClear ? "⚠ click again" : "🧹 clear all"}
              </Btn>
              <Btn onClick={fit} title="zoom to fit">
                fit
              </Btn>
            </>
          )}

          {mode !== "hero" && (
            <>
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

          <span className="mx-1 h-4 w-px bg-[var(--color-line)]" />
          <Btn onClick={undo} disabled={!canUndo} title="undo (⌘Z)">
            ↩ undo
          </Btn>
          <Btn onClick={redo} disabled={!canRedo} title="redo (⌘⇧Z)">
            ↪ redo
          </Btn>
          <span className="mx-1 h-4 w-px bg-[var(--color-line)]" />

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
          <Btn onClick={() => setShowExplain((v) => !v)} active={showExplain} title="plain-English read of this design">
            📖 explain
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
          <Btn onClick={exportTerraform} title="download Terraform for this design">
            ⬇ tf
          </Btn>
          <Btn onClick={exportCompose} title="download docker-compose.yml for this design">
            ⬇ compose
          </Btn>

          <span className="mx-1 h-4 w-px bg-[var(--color-line)]" />
          <Btn onClick={doSave} tone="good" title="save this design to your browser library">
            💾 save
          </Btn>
          <Btn
            onClick={() => setShowSaved((v) => !v)}
            active={showSaved}
            title="your saved designs"
          >
            📚 designs{saved.length ? ` (${saved.length})` : ""}
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
            </>
          )}
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
            <Section title={challenge.start === "empty" ? "🪙 zero → hero" : "⚔ challenge"}>
              <div className="panel rounded-xl p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="mono text-[9px] uppercase tracking-widest text-[var(--color-muted)]">
                    spent / budget
                  </span>
                  <span
                    className="mono text-[11px] font-bold"
                    style={{
                      color: grade.underBudget
                        ? "var(--color-good)"
                        : "var(--color-bad)",
                    }}
                  >
                    {fmtMoney(bill.total)} / {fmtMoney(challenge.budget)}
                  </span>
                </div>
                <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-well)]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, challenge.budget ? (bill.total / challenge.budget) * 100 : 0)}%`,
                      background: grade.underBudget
                        ? "var(--color-good)"
                        : "var(--color-bad)",
                    }}
                  />
                </div>

                <div className="mono flex flex-col gap-1 text-[10px]">
                  <Grade ok={grade.serves} label="serves the target load" />
                  <Grade ok={grade.holds} label="every component holds" />
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

                {challenge.start === "empty" && (
                  <button
                    onClick={() => {
                      const pool = CHALLENGES.filter(
                        (c) => c.start === "empty",
                      );
                      const c = pool[Math.floor(Math.random() * pool.length)];
                      if (c) loadChallenge(c);
                    }}
                    className="mono mt-2 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] py-1.5 text-[10px] text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
                  >
                    ↻ different target
                  </button>
                )}
                <button
                  onClick={() => setChallenge(null)}
                  className="mono mt-1.5 w-full text-[9px] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                >
                  exit challenge
                </button>
              </div>
            </Section>
          )}

          {mode === "hero" && (
            <Section title={`${HERO_STAGES[heroStage].glyph} zero → hero`}>
              <div className="panel rounded-xl p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[13px] font-bold text-[var(--color-ink)]">
                    {HERO_STAGES[heroStage].name}
                  </span>
                  <span className="mono text-[9px] uppercase text-[var(--color-muted)]">
                    month {hero.month}
                  </span>
                </div>
                <p className="mb-3 text-[10.5px] leading-snug text-[var(--color-muted)]">
                  {HERO_STAGES[heroStage].blurb}
                </p>

                <div className="mono mb-3 grid grid-cols-3 gap-1.5 text-[8.5px]">
                  <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-1.5 py-1.5">
                    <div className="uppercase text-[var(--color-muted)]">
                      mrr
                    </div>
                    <div className="text-[11.5px] font-bold text-[var(--color-good)]">
                      {fmtMoney(heroRevenue)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-1.5 py-1.5">
                    <div className="uppercase text-[var(--color-muted)]">
                      bill
                    </div>
                    <div className="text-[11.5px] font-bold text-[var(--color-ink)]">
                      {fmtMoney(bill.total)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-1.5 py-1.5">
                    <div className="uppercase text-[var(--color-muted)]">
                      net/mo
                    </div>
                    <div
                      className="text-[11.5px] font-bold"
                      style={{
                        color:
                          heroNet >= 0
                            ? "var(--color-good)"
                            : "var(--color-bad)",
                      }}
                    >
                      {heroNet >= 0 ? "+" : ""}
                      {fmtMoney(heroNet)}
                    </div>
                  </div>
                </div>

                <div className="mb-1 flex items-baseline justify-between">
                  <span className="mono text-[9px] uppercase text-[var(--color-muted)]">
                    bank
                  </span>
                  <span
                    className="mono text-[13px] font-bold"
                    style={{
                      color:
                        hero.cash >= 0
                          ? "var(--color-good)"
                          : "var(--color-bad)",
                    }}
                  >
                    {fmtMoney(hero.cash)}
                  </span>
                </div>
                <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-well)]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(2, Math.min(100, (hero.cash / Math.max(1, bill.total * 3)) * 100))}%`,
                      background:
                        hero.cash >= 0
                          ? "var(--color-good)"
                          : "var(--color-bad)",
                    }}
                  />
                </div>
                <div className="mono mb-2 text-[8.5px] leading-snug text-[var(--color-muted)]">
                  {heroNet < 0
                    ? `burning ${fmtMoney(-heroNet)}/mo — spend it all and you run out`
                    : `profitable — ${fmtMoney(heroNet)}/mo goes into the bank`}
                </div>

                <div
                  className="mono mb-3 rounded-lg border px-2 py-1.5 text-[9px] leading-snug"
                  style={{
                    borderColor: heroHasClient
                      ? "var(--color-line)"
                      : "var(--color-warn)",
                    color: heroHasClient
                      ? "var(--color-muted)"
                      : "var(--color-warn)",
                    background: "var(--color-well)",
                  }}
                >
                  {heroHasClient
                    ? `◉ earning — a client is connected, paying ${fmtMoney(heroRevenue)}/mo`
                    : "⚠ no client connected. Wire a 🌐 Web Browser or 📱 Mobile App into your backend — nobody pays until the app is actually shipped."}
                </div>

                {hero.freebies > 0 && (
                  <div className="mono mb-2 rounded-lg border border-[var(--color-good)] bg-[color-mix(in_srgb,var(--color-good)_10%,transparent)] px-2 py-1.5 text-[9.5px] leading-snug text-[var(--color-good)]">
                    🎁 {hero.freebies} free node
                    {hero.freebies === 1 ? "" : "s"} banked — your next
                    purchases cost nothing
                  </div>
                )}

                {heroNext && (
                  <div className="mono mb-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-2 py-1.5 text-[9px] leading-snug text-[var(--color-muted)]">
                    🔒 next unlock:{" "}
                    <span className="text-[var(--color-ink)]">
                      {heroNext.glyph} {heroNext.name}
                    </span>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--color-panel2)]">
                      <div
                        className="h-full rounded-full bg-[var(--color-accent)]"
                        style={{
                          width: `${Math.min(100, (users / heroNext.users) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1">
                      {fmt(users)} / {fmt(heroNext.users)} users
                    </div>
                  </div>
                )}

                <div className="mb-3 flex gap-1.5">
                  <button
                    onClick={() => rollMonths(1)}
                    className="mono flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] py-1.5 text-[10px] text-[var(--color-ink)] transition hover:border-[var(--color-accent)]"
                  >
                    ⏩ +1 month
                  </button>
                  <button
                    onClick={() => rollMonths(6)}
                    className="mono flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] py-1.5 text-[10px] text-[var(--color-ink)] transition hover:border-[var(--color-accent)]"
                  >
                    ⏩⏩ +6
                  </button>
                  <button
                    onClick={() => setHero((h) => ({ ...h, running: !h.running }))}
                    className={`mono rounded-lg border px-3 py-1.5 text-[10px] transition ${
                      hero.running
                        ? "border-[var(--color-bad)] bg-[color-mix(in_srgb,var(--color-bad)_12%,transparent)] text-[var(--color-bad)]"
                        : "border-[var(--color-line)] bg-[var(--color-well)] text-[var(--color-ink)] hover:border-[var(--color-accent)]"
                    }`}
                  >
                    {hero.running ? "⏸" : "▶"}
                  </button>
                </div>

                <div className="mono mb-1 text-[8px] uppercase tracking-widest text-[var(--color-muted)]">
                  business
                </div>
                <div className="mono mb-2 flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-2 py-1.5 text-[10px]">
                  <span>{biz.glyph}</span>
                  <span className="min-w-0 flex-1 truncate font-bold text-[var(--color-ink)]">
                    {biz.name}
                  </span>
                  <span className="shrink-0 text-[var(--color-muted)]">
                    ${biz.arpu.toFixed(2)}/user
                  </span>
                </div>
                <button
                  onClick={() => setShowPivot((v) => !v)}
                  className="mono mb-2 w-full rounded-lg border border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] py-1.5 text-[10px] text-[var(--color-accent)]"
                >
                  {showPivot ? "close" : "💼 change the business"}
                </button>

                {showPivot && (
                  <div className="mb-2 flex flex-col gap-1">
                    {BUSINESSES.filter((b) => b.id !== biz.id).map((b) => (
                      <button
                        key={b.id}
                        onClick={() => pivotTo(b)}
                        title={b.blurb}
                        className="mono rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-2 py-1.5 text-left text-[9.5px] transition hover:border-[var(--color-accent)]"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{b.glyph}</span>
                          <span className="min-w-0 flex-1 truncate font-bold text-[var(--color-ink)]">
                            {b.name}
                          </span>
                          <span className="shrink-0 text-[var(--color-muted)]">
                            ${b.arpu.toFixed(2)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[8.5px] leading-snug text-[var(--color-muted)]">
                          {b.blurb}
                        </div>
                      </button>
                    ))}
                    <div className="mono text-[8.5px] leading-snug text-[var(--color-bad)]">
                      ⚠ pivoting loses {Math.round(PIVOT_CHURN * 100)}% of your
                      users
                    </div>
                  </div>
                )}

                <button
                  onClick={() => pitchRoll(Math.random())}
                  className="mono w-full rounded-lg border border-[var(--color-good)] bg-[color-mix(in_srgb,var(--color-good)_10%,transparent)] py-2 text-[10px] font-bold text-[var(--color-good)] transition hover:bg-[color-mix(in_srgb,var(--color-good)_16%,transparent)]"
                >
                  🙏 ask for funding · {Math.round(heroOdds * 100)}% chance
                </button>
                <div className="mono mt-1 text-center text-[8.5px] leading-snug text-[var(--color-muted)]">
                  {hero.raises > 0
                    ? `${hero.raises} pitch${hero.raises === 1 ? "" : "es"} so far — investors get harder to impress`
                    : "a gamble: better traction means better odds"}
                </div>
                {pitchMsg && (
                  <div className="mono mt-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-2 py-1.5 text-[9.5px] leading-snug text-[var(--color-ink)]">
                    {pitchMsg}
                  </div>
                )}
              </div>
            </Section>
          )}

          {mode !== "hero" && (
            <>
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

          <Section title="real-world scale">
            <div className="grid grid-cols-2 gap-1.5">
              {SCALE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  title={`${p.name} — ${p.blurb}`}
                  className={`mono rounded-lg border px-2 py-1.5 text-left text-[9.5px] transition ${
                    users === p.users
                      ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-ink)]"
                      : "border-[var(--color-line)] bg-[var(--color-well)] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <div className="truncate font-bold">{p.name}</div>
                  <div className="truncate text-[8.5px] opacity-75">{p.blurb}</div>
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
            </>
          )}

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

          {mode !== "hero" && (
            <>
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

          {showExplain && (
            <Section title="📖 explain this design">
              <div className="panel rounded-xl p-3">
                <div className="flex flex-col gap-2">
                  {narration.map((line, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="mono shrink-0 text-[10px] font-bold text-[var(--color-accent)]">
                        {i + 1}
                      </span>
                      <span className="text-[11px] leading-relaxed text-[var(--color-ink)]">
                        {line}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {showSaved && (
            <Section title="📚 your designs">
              <div className="panel rounded-xl p-3">
                <div className="mb-2 flex gap-1.5">
                  <input
                    value={savedName}
                    onChange={(e) => setSavedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") doSave();
                    }}
                    placeholder="name this design…"
                    className="mono min-w-0 flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-2 py-1.5 text-[10px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]"
                  />
                  <button
                    onClick={doSave}
                    className="mono shrink-0 rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-2 py-1.5 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  >
                    save
                  </button>
                </div>
                {saved.length === 0 ? (
                  <div className="mono text-[9.5px] leading-relaxed text-[var(--color-muted)]">
                    Nothing saved yet. Saved designs live in this browser only —
                    use 🔗 share for a link that works anywhere.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {saved.map((d) => (
                      <div
                        key={d.id}
                        className="mono flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-2 py-1.5 text-[9.5px]"
                      >
                        <button
                          onClick={() => doLoad(d)}
                          className="min-w-0 flex-1 truncate text-left text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                          title="load this design"
                        >
                          {d.name}
                        </button>
                        <button
                          onClick={() => doDeleteSaved(d.id)}
                          className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-bad)]"
                          title="delete"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>
          )}
            </>
          )}

          <Section title="add component">
            <Palette
              onAdd={addNode}
              unlocked={heroUnlocked}
              lockedHint={(k) => {
                const st = HERO_STAGES.find((s) => s.unlocks.includes(k));
                return st
                  ? `unlocks at ${fmt(st.users)} users · ${st.name}`
                  : null;
              }}
              priceOf={
                mode === "hero"
                  ? (k) => {
                      const p = purchasePrice(k);
                      return p === 0 ? "free" : fmtMoney(p);
                    }
                  : undefined
              }
              canAfford={
                mode === "hero"
                  ? (k) => hero.freebies > 0 || hero.cash >= purchasePrice(k)
                  : undefined
              }
            />
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

          {mode !== "hero" && (
            <>
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
            </>
          )}
        </aside>

        {/* ============ CANVAS ============ */}
        <main
          ref={wrapRef}
          className="dotgrid relative min-w-0 flex-1 overflow-hidden"
          onPointerDown={onBgPointerDown}
          onWheel={onWheel}
          style={{
            cursor: panning ? "grabbing" : linkMode ? "crosshair" : "default",
            touchAction: "none",
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

      {mode === "hero" && hero.bankrupt && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-[#0b112080] backdrop-blur-sm">
          <div className="fade-in w-[440px] max-w-[92vw] rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-center shadow-2xl">
            <div className="text-[34px]">💀</div>
            <div className="mono mt-1 text-[10px] uppercase tracking-widest text-[var(--color-bad)]">
              out of money
            </div>
            <h2 className="mt-2 text-[20px] font-extrabold text-[var(--color-ink)]">
              You ran out of cash
            </h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-muted)]">
              You got all the way to{" "}
              <span className="text-[var(--color-ink)]">
                {HERO_STAGES[heroStage].name}
              </span>{" "}
              with {fmt(users)} users over {hero.month} months — then the bill
              caught up with the bank. Keep spending below what you earn, or
              raise money before the well runs dry.
            </p>
            <button
              onClick={heroRestart}
              className="mono mt-5 w-full rounded-lg border border-[var(--color-good)] bg-[color-mix(in_srgb,var(--color-good)_12%,transparent)] py-2.5 text-[11px] font-bold text-[var(--color-good)]"
            >
              ↺ start again from nothing
            </button>
            <button
              onClick={changeMode}
              className="mono mt-2 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] py-2 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              back to modes
            </button>
          </div>
        </div>
      )}

      {tourStep !== null && tourStep < TOUR.length && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-[#0b112080] backdrop-blur-sm">
          <div className="fade-in w-[440px] max-w-[92vw] rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 shadow-2xl">
            <div className="mono mb-2 flex items-center justify-between text-[9px] uppercase tracking-widest text-[var(--color-accent)]">
              <span>
                step {tourStep + 1} / {TOUR.length}
              </span>
              <button
                onClick={closeTour}
                className="text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              >
                skip
              </button>
            </div>
            <div className="text-[16px] font-bold text-[var(--color-ink)]">
              {TOUR[tourStep].title}
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-muted)]">
              {TOUR[tourStep].body}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-1.5">
                {TOUR.map((_, i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background:
                        i === tourStep ? "var(--color-accent)" : "var(--color-line)",
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-1.5">
                {tourStep > 0 && (
                  <button
                    onClick={() => setTourStep(Math.max(0, tourStep - 1))}
                    className="mono rounded-lg border border-[var(--color-line)] bg-[var(--color-well)] px-3 py-1.5 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  >
                    back
                  </button>
                )}
                <button
                  onClick={() =>
                    tourStep + 1 >= TOUR.length
                      ? closeTour()
                      : setTourStep(tourStep + 1)
                  }
                  className="mono rounded-lg border border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] px-3 py-1.5 text-[10px] text-[var(--color-accent)]"
                >
                  {tourStep + 1 >= TOUR.length ? "got it" : "next"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
