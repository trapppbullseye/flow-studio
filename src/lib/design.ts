export type NodeKind =
  | "client"
  | "cdn"
  | "loadbalancer"
  | "api"
  | "cache"
  | "database"
  | "replica"
  | "shard"
  | "queue"
  | "worker"
  | "model";

export type Layer = "edge" | "compute" | "data" | "async" | "ai";

export interface CatalogEntry {
  kind: NodeKind;
  name: string;
  glyph: string;
  tagline: string;
  about: string;
  /** max sustained requests/sec before it chokes */
  capacity: number;
  /** fraction of incoming traffic forwarded downstream (a cache absorbs hits) */
  passthrough: number;
  color: string;
  layer: Layer;
}

export const CATALOG: Record<NodeKind, CatalogEntry> = {
  client: {
    kind: "client",
    name: "Users",
    glyph: "◍",
    tagline: "the crowd",
    about:
      "Every phone, laptop and API consumer hitting your product at once. They are the source of all traffic — and they never wait.",
    capacity: Infinity,
    passthrough: 1,
    color: "#38bdf8",
    layer: "edge",
  },
  cdn: {
    kind: "cdn",
    name: "CDN",
    glyph: "◈",
    tagline: "static, cached at the edge",
    about:
      "Serves images, JS and CSS from a server physically near the user. It absorbs the static traffic before it ever reaches your origin — only misses continue.",
    capacity: 200000,
    passthrough: 0.35,
    color: "#a78bfa",
    layer: "edge",
  },
  loadbalancer: {
    kind: "loadbalancer",
    name: "Load Balancer",
    glyph: "⋈",
    tagline: "spreads the crowd",
    about:
      "One address in, many servers out. It round-robins every request across your API fleet so no single box eats the whole wave.",
    capacity: 150000,
    passthrough: 1,
    color: "#22d3ee",
    layer: "compute",
  },
  api: {
    kind: "api",
    name: "API Server",
    glyph: "▤",
    tagline: "your application logic",
    about:
      "Validates requests, runs business logic, talks to the data layer. Stateless and cheap to clone — just add more behind the balancer.",
    capacity: 100000,
    passthrough: 1,
    color: "#22c55e",
    layer: "compute",
  },
  cache: {
    kind: "cache",
    name: "Cache",
    glyph: "⚡",
    tagline: "in-memory, forgets nothing",
    about:
      "Redis / Memcached in front of the database. It answers ~95% of reads from RAM in microseconds, so only misses ever reach the disk.",
    capacity: 120000,
    passthrough: 0.05,
    color: "#f59e0b",
    layer: "data",
  },
  database: {
    kind: "database",
    name: "Database",
    glyph: "▣",
    tagline: "read + write, one box",
    about:
      "Your single source of truth. Every read and every write on one machine — fast, until it isn't. This is the box that sweats.",
    capacity: 5000,
    passthrough: 1,
    color: "#f43f5e",
    layer: "data",
  },
  replica: {
    kind: "replica",
    name: "Read Replica",
    glyph: "▥",
    tagline: "a read-only copy",
    about:
      "A live copy of the database that accepts reads only. Push read traffic here and let the primary focus on writes. Slightly stale by design.",
    capacity: 40000,
    passthrough: 0,
    color: "#fb7185",
    layer: "data",
  },
  shard: {
    kind: "shard",
    name: "Shard",
    glyph: "◫",
    tagline: "a slice of the data",
    about:
      "Split the database by key — users A–F here, G–M there. Each shard owns a fraction of the rows, so writes scale horizontally instead of vertically.",
    capacity: 20000,
    passthrough: 0,
    color: "#e879f9",
    layer: "data",
  },
  queue: {
    kind: "queue",
    name: "Queue",
    glyph: "≡",
    tagline: "work for later",
    about:
      "Kafka / SQS buffer. Slow jobs — emails, image processing, exports — get parked here and handled off the request path. Nothing is lost.",
    capacity: 80000,
    passthrough: 1,
    color: "#facc15",
    layer: "async",
  },
  worker: {
    kind: "worker",
    name: "Worker",
    glyph: "⚙",
    tagline: "background muscle",
    about:
      "Pulls jobs off the queue and grinds through them. Scales independently of your web tier — burn one, spawn another.",
    capacity: 8000,
    passthrough: 0,
    color: "#4ade80",
    layer: "async",
  },
  model: {
    kind: "model",
    name: "AI Model",
    glyph: "✦",
    tagline: "inference, GPU-bound",
    about:
      "The expensive one. Runs on GPUs, costs real money per token, and saturates fast. Batch it, cache it, or route only the requests that deserve it.",
    capacity: 500,
    passthrough: 0,
    color: "#818cf8",
    layer: "ai",
  },
};

export interface FlowNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  /** optional capacity override (requests/sec) */
  capacity?: number;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  mode: "read" | "write" | "async";
  /** relative share of the source's forwarded traffic (default 1) */
  weight?: number;
}

export interface Scenario {
  id: string;
  index: string;
  title: string;
  blurb: string;
  users: number;
  nodes: FlowNode[];
  edges: Edge[];
}

const N = (id: string, kind: NodeKind, x: number, y: number): FlowNode => ({
  id,
  kind,
  x,
  y,
});
const E = (
  from: string,
  to: string,
  mode: Edge["mode"] = "read",
  weight = 1,
): Edge => ({ id: `${from}->${to}`, from, to, mode, weight });

const COL = [120, 440, 780, 1120];

export const SCENARIOS: Scenario[] = [
  {
    id: "pressure",
    index: "01",
    title: "THE PRESSURE TEST",
    blurb: "Your app goes viral. Millions of users. One database.",
    users: 750000,
    nodes: [
      N("u", "client", COL[0], 280),
      N("api", "api", COL[1], 280),
      N("db", "database", COL[2], 280),
    ],
    edges: [E("u", "api"), E("api", "db", "write")],
  },
  {
    id: "cache",
    index: "02",
    title: "CACHE THE READS",
    blurb: "95% of traffic is reads. Reads don't need the disk.",
    users: 750000,
    nodes: [
      N("u", "client", COL[0], 280),
      N("api", "api", COL[1], 280),
      N("cache", "cache", COL[2], 150),
      N("db", "database", COL[3], 300),
    ],
    edges: [E("u", "api"), E("api", "cache"), E("cache", "db")],
  },
  {
    id: "replicas",
    index: "03",
    title: "READ REPLICAS",
    blurb: "Writes are rare, reads are not. Split the job in two.",
    users: 700000,
    nodes: [
      N("u", "client", COL[0], 280),
      N("api", "api", COL[1], 280),
      N("db", "database", COL[2], 110),
      N("r1", "replica", COL[2], 300),
      N("r2", "replica", COL[2], 470),
    ],
    edges: [
      E("u", "api"),
      E("api", "db", "write", 0.15),
      E("api", "r1", "read", 1),
      E("api", "r2", "read", 1),
    ],
  },
  {
    id: "shard",
    index: "04",
    title: "SHARD THE WRITES",
    blurb: "Reads are solved. Now the writes are drowning.",
    users: 600000,
    nodes: [
      N("u", "client", COL[0], 300),
      N("api", "api", COL[1], 300),
      N("s1", "shard", COL[2], 90),
      N("s2", "shard", COL[2], 260),
      N("s3", "shard", COL[2], 430),
      N("s4", "shard", COL[2], 600),
    ],
    edges: [
      E("u", "api"),
      E("api", "s1", "write"),
      E("api", "s2", "write"),
      E("api", "s3", "write"),
      E("api", "s4", "write"),
    ],
  },
  {
    id: "full",
    index: "05",
    title: "FULL SCALE",
    blurb: "Every layer doing one job. This is a system that holds.",
    users: 800000,
    nodes: [
      N("u", "client", COL[0] - 40, 300),
      N("cdn", "cdn", COL[0] + 200, 110),
      N("lb", "loadbalancer", COL[0] + 200, 420),
      N("api1", "api", COL[1] - 20, 280),
      N("api2", "api", COL[1] - 20, 480),
      N("cache", "cache", COL[2] + 40, 130),
      N("db", "database", COL[3] + 60, 90),
      N("r1", "replica", COL[3] + 60, 250),
      N("r2", "replica", COL[3] + 60, 400),
      N("q", "queue", COL[2] + 40, 620),
      N("w1", "worker", COL[3] + 60, 560),
      N("w2", "worker", COL[3] + 60, 700),
    ],
    edges: [
      E("u", "cdn"),
      E("u", "lb"),
      E("cdn", "lb", "read", 0.35),
      E("lb", "api1"),
      E("lb", "api2"),
      E("api1", "cache"),
      E("api1", "r1"),
      E("api1", "q", "async", 0.3),
      E("api2", "cache"),
      E("api2", "r2"),
      E("api2", "q", "async", 0.3),
      E("q", "w1", "async"),
      E("q", "w2", "async"),
    ],
  },
];

export interface SimNode {
  node: FlowNode;
  entry: CatalogEntry;
  capacity: number;
  inflow: number;
  load: number;
  overloaded: boolean;
}
export interface SimEdge {
  edge: Edge;
  flow: number;
  load: number;
  overloaded: boolean;
}
export interface Sim {
  nodes: Record<string, SimNode>;
  edges: Record<string, SimEdge>;
  rps: number;
  worst: SimNode | null;
}

export const usersToRps = (users: number) => users / 10;

export const weightOf = (e: Edge) => (e.weight ?? 1);

/**
 * Fixed-point traffic propagation. Sources emit; every node forwards its
 * `passthrough` fraction, split across outgoing edges by edge weight.
 */
export function simulate(nodes: FlowNode[], edges: Edge[], users: number): Sim {
  const rps = usersToRps(users);
  const sources = nodes.filter((n) => n.kind === "client");
  const outgoing = new Map<string, Edge[]>();
  for (const e of edges) {
    const arr = outgoing.get(e.from) ?? [];
    arr.push(e);
    outgoing.set(e.from, arr);
  }

  const seed = sources.length ? rps / sources.length : 0;
  let flow = new Map<string, number>();
  for (let iter = 0; iter < 48; iter++) {
    const next = new Map<string, number>();
    for (const s of sources) next.set(s.id, (next.get(s.id) ?? 0) + seed);
    for (const n of nodes) {
      const entry = CATALOG[n.kind];
      const inFlow = flow.get(n.id) ?? (sources.includes(n) ? seed : 0);
      const outs = outgoing.get(n.id) ?? [];
      if (!outs.length) continue;
      const forwarded = inFlow * entry.passthrough;
      if (forwarded <= 0.5) continue;
      const totalW = outs.reduce((a, e) => a + weightOf(e), 0) || 1;
      for (const e of outs) {
        const share = (forwarded * weightOf(e)) / totalW;
        next.set(e.to, (next.get(e.to) ?? 0) + share);
      }
    }
    flow = next;
  }

  const simNodes: Record<string, SimNode> = {};
  let worst: SimNode | null = null;
  for (const n of nodes) {
    const entry = CATALOG[n.kind];
    const capacity = n.capacity ?? entry.capacity;
    const inflow = flow.get(n.id) ?? 0;
    const load = capacity === Infinity ? 0 : inflow / capacity;
    const sn: SimNode = { node: n, entry, capacity, inflow, load, overloaded: load > 1 };
    simNodes[n.id] = sn;
    if (sn.overloaded && (worst === null || load > worst.load)) worst = sn;
  }

  const simEdges: Record<string, SimEdge> = {};
  for (const e of edges) {
    const src = simNodes[e.from];
    const entry = CATALOG[src.node.kind];
    const outs = outgoing.get(e.from) ?? [];
    const totalW = outs.reduce((a, x) => a + weightOf(x), 0) || 1;
    const flowVal = (src.inflow * entry.passthrough * weightOf(e)) / totalW;
    const load = src.capacity === Infinity ? 0 : src.inflow / src.capacity;
    simEdges[e.id] = { edge: e, flow: flowVal, load, overloaded: load > 1 };
  }

  return { nodes: simNodes, edges: simEdges, rps, worst };
}

export const fmt = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${Math.round(n)}`;

export const fmtUsers = (n: number) =>
  n >= 1000000 ? `${(n / 1000000).toFixed(2)}M` : fmt(n);

export const newId = (kind: NodeKind) =>
  `${kind}-${Math.random().toString(36).slice(2, 6)}`;
