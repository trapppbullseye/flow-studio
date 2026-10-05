import {
  CATALOG,
  fmt,
  type Edge,
  type FlowNode,
  type NodeKind,
  type Sim,
} from "./design";
import { fmtMs } from "./analysis";

/* ============================================================
   SHARE — encode the whole design into a URL hash
   ============================================================ */
export interface DesignState {
  nodes: FlowNode[];
  edges: Edge[];
  users: number;
  dead: string[];
}

function toB64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64(s: string): string {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b.length % 4 ? "=".repeat(4 - (b.length % 4)) : "";
  const bin = atob(b + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

type PackedNode = [string, NodeKind, number, number, number?];
type PackedEdge = [string, string, Edge["mode"], number?];

export function encodeDesign(s: DesignState): string {
  const payload = {
    u: s.users,
    d: s.dead,
    n: s.nodes.map((n): PackedNode =>
      n.capacity !== undefined
        ? [n.id, n.kind, Math.round(n.x), Math.round(n.y), n.capacity]
        : [n.id, n.kind, Math.round(n.x), Math.round(n.y)],
    ),
    e: s.edges.map((e): PackedEdge =>
      e.weight !== undefined && e.weight !== 1
        ? [e.from, e.to, e.mode, e.weight]
        : [e.from, e.to, e.mode],
    ),
  };
  return toB64(JSON.stringify(payload));
}

export function decodeDesign(str: string): DesignState | null {
  try {
    const raw = JSON.parse(fromB64(str)) as {
      u: number;
      d: string[];
      n: PackedNode[];
      e: PackedEdge[];
    };
    if (!Array.isArray(raw.n) || !Array.isArray(raw.e)) return null;
    return {
      users: raw.u,
      dead: raw.d ?? [],
      nodes: raw.n.map(([id, kind, x, y, capacity]) =>
        capacity !== undefined ? { id, kind, x, y, capacity } : { id, kind, x, y },
      ),
      edges: raw.e.map(([from, to, mode, weight]) => ({
        id: `${from}->${to}`,
        from,
        to,
        mode,
        weight,
      })),
    };
  } catch {
    return null;
  }
}

export function shareUrl(s: DesignState): string {
  const base =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : "";
  return `${base}#d=${encodeDesign(s)}`;
}

export function readSharedDesign(): DesignState | null {
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(/d=([A-Za-z0-9_-]+)/);
  return m ? decodeDesign(m[1]) : null;
}

/* ============================================================
   SAVED DESIGNS — a small local library in localStorage
   ============================================================ */
const SAVED_KEY = "flowstudio.designs";

export interface SavedDesign {
  id: string;
  name: string;
  at: number;
  payload: string;
}

export function listSaved(): SavedDesign[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    const arr = raw ? (JSON.parse(raw) as SavedDesign[]) : [];
    return arr.sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

function writeSaved(arr: SavedDesign[]) {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(arr));
  } catch {
    /* storage full or blocked — ignore */
  }
}

export function saveDesign(name: string, s: DesignState): SavedDesign[] {
  const arr = listSaved();
  const entry: SavedDesign = {
    id: `ds-${Date.now().toString(36)}`,
    name: name.trim() || "untitled",
    at: Date.now(),
    payload: encodeDesign(s),
  };
  const next = [entry, ...arr].slice(0, 40);
  writeSaved(next);
  return next.sort((a, b) => b.at - a.at);
}

export function deleteSaved(id: string): SavedDesign[] {
  const next = listSaved().filter((d) => d.id !== id);
  writeSaved(next);
  return next;
}

export function loadSavedDesign(d: SavedDesign): DesignState | null {
  return decodeDesign(d.payload);
}

/* ============================================================
   EXPORT — render the canvas to a standalone SVG (and PNG)
   ============================================================ */
const NODE_W = 172;
const NODE_H = 104;

export interface ExportOpts {
  theme: "light" | "dark";
  showLatency?: boolean;
  showCost?: boolean;
  costOf?: (id: string) => number;
  latencyOf?: (id: string) => number;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function designToSVG(
  nodes: FlowNode[],
  edges: Edge[],
  sim: Sim,
  opts: ExportOpts,
): string {
  if (!nodes.length) return "";
  const dark = opts.theme === "dark";
  const bg = dark ? "#060a12" : "#eef2f7";
  const panel = dark ? "#0c1320" : "#ffffff";
  const line = dark ? "#1b2740" : "#d3dce8";
  const ink = dark ? "#e6edf7" : "#0f1c2e";
  const muted = dark ? "#7d8ba6" : "#5b6b83";
  const edgeCol: Record<Edge["mode"], string> = {
    read: dark ? "#38bdf8" : "#0284c7",
    write: dark ? "#f43f5e" : "#e11d48",
    async: dark ? "#facc15" : "#ca8a04",
  };

  const pad = 60;
  const minX = Math.min(...nodes.map((n) => n.x)) - pad;
  const minY = Math.min(...nodes.map((n) => n.y)) - pad - 40;
  const maxX = Math.max(...nodes.map((n) => n.x + NODE_W)) + pad;
  const maxY = Math.max(...nodes.map((n) => n.y + NODE_H)) + pad + 40;
  const w = Math.round(maxX - minX);
  const h = Math.round(maxY - minY);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">`,
  );
  parts.push(`<rect width="${w}" height="${h}" fill="${bg}"/>`);
  parts.push(
    `<text x="24" y="34" fill="${ink}" font-size="17" font-weight="700">FLOW STUDIO</text>`,
  );
  parts.push(
    `<text x="150" y="34" fill="${muted}" font-size="11">${nodes.length} components · ${edges.length} links · ${fmt(
      sim.rps,
    )} req/s</text>`,
  );

  // edges
  for (const e of edges) {
    const a = nodes.find((n) => n.id === e.from);
    const b = nodes.find((n) => n.id === e.to);
    if (!a || !b) continue;
    const x1 = a.x + NODE_W - minX;
    const y1 = a.y + NODE_H / 2 - minY;
    const x2 = b.x - minX;
    const y2 = b.y + NODE_H / 2 - minY;
    const mx = (x1 + x2) / 2;
    const bad = sim.edges[e.id]?.overloaded;
    const col = bad ? (dark ? "#ef4444" : "#dc2626") : edgeCol[e.mode];
    parts.push(
      `<path d="M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" fill="none" stroke="${col}" stroke-width="2.2" marker-end="url(#ar-${e.mode})"/>`,
    );
  }

  // nodes
  for (const n of nodes) {
    const entry = CATALOG[n.kind];
    const sn = sim.nodes[n.id];
    const x = n.x - minX;
    const y = n.y - minY;
    const pct = sn.capacity === Infinity ? 0 : Math.round(sn.load * 100);
    const bad = !!(sn.overloaded || sn.dead);
    const border = bad ? (dark ? "#ef4444" : "#dc2626") : line;
    parts.push(
      `<rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="12" fill="${panel}" stroke="${border}" stroke-width="1.5"/>`,
    );
    parts.push(
      `<text x="${x + 14}" y="${y + 24}" fill="${entry.color}" font-size="14">${esc(entry.glyph)}</text>`,
    );
    parts.push(
      `<text x="${x + 34}" y="${y + 24}" fill="${ink}" font-size="12.5" font-weight="600">${esc(entry.name)}</text>`,
    );
    const sub = opts.showLatency && opts.latencyOf
      ? fmtMs(opts.latencyOf(n.id))
      : opts.showCost && opts.costOf
        ? `$${Math.round(opts.costOf(n.id)).toLocaleString()}/mo`
        : entry.tagline;
    parts.push(
      `<text x="${x + 14}" y="${y + 40}" fill="${muted}" font-size="9.5">${esc(sub.slice(0, 24))}</text>`,
    );
    parts.push(
      `<text x="${x + 14}" y="${y + 88}" fill="${muted}" font-size="9">${sn.dead ? "DOWN" : "load"}</text>`,
    );
    parts.push(
      `<text x="${x + NODE_W - 14}" y="${y + 88}" text-anchor="end" fill="${bad ? (dark ? "#ef4444" : "#dc2626") : entry.color}" font-size="10" font-weight="700">${sn.dead ? "—" : `${pct}%`}</text>`,
    );
    parts.push(
      `<rect x="${x + 14}" y="${y + 93}" width="${NODE_W - 28}" height="4" rx="2" fill="${dark ? "#0a1120" : "#e9eef5"}"/>`,
    );
    parts.push(
      `<rect x="${x + 14}" y="${y + 93}" width="${((NODE_W - 28) * Math.min(100, pct)) / 100}" height="4" rx="2" fill="${bad ? (dark ? "#ef4444" : "#dc2626") : entry.color}"/>`,
    );
  }

  parts.push(
    `<defs>${(["read", "write", "async"] as const)
      .map(
        (m) =>
          `<marker id="ar-${m}" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="${edgeCol[m]}"/></marker>`,
      )
      .join("")}</defs>`,
  );
  parts.push("</svg>");
  return parts.join("");
}

export function download(filename: string, data: string, mime: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Rasterise an SVG string to a PNG download. */
export function svgToPng(svg: string, filename: string, scale = 2) {
  const m = svg.match(/width="(\d+)" height="(\d+)"/);
  const w = m ? Number(m[1]) : 1200;
  const h = m ? Number(m[2]) : 800;
  const img = new Image();
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob((b) => {
      if (!b) return;
      const purl = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = purl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(purl);
    });
  };
  img.src = url;
}
