export type NodeKind =
  // entry
  | "client"
  | "browser"
  | "mobile"
  | "iot"
  // edge
  | "dns"
  | "cdn"
  | "waf"
  | "proxy"
  | "gateway"
  // compute
  | "loadbalancer"
  | "api"
  | "serverless"
  | "container"
  | "orchestrator"
  | "microservice"
  | "graphql"
  | "bff"
  | "auth"
  | "ratelimit"
  | "circuit"
  | "scheduler"
  // data
  | "cache"
  | "database"
  | "nosql"
  | "warehouse"
  | "lake"
  | "objectstore"
  | "search"
  | "timeseries"
  | "vectordb"
  | "replica"
  | "shard"
  | "config"
  // async
  | "queue"
  | "pubsub"
  | "eventbus"
  | "stream"
  | "worker"
  | "dlq"
  // ai
  | "model"
  | "embedding"
  | "rag"
  | "gpu"
  // ops
  | "monitoring"
  | "logging"
  | "tracing"
  | "registry"
  | "secrets"
  | "notify"
  | "payment";

export type Layer =
  | "entry"
  | "edge"
  | "compute"
  | "data"
  | "async"
  | "ai"
  | "ops";

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
  /** traffic origin — emits load instead of receiving it */
  source?: boolean;
}

export const CATALOG: Record<NodeKind, CatalogEntry> = {
  /* ────────────────────────── ENTRY ────────────────────────── */
  client: {
    kind: "client",
    name: "Users",
    glyph: "◍",
    tagline: "the crowd",
    about:
      "Every phone, laptop and API consumer hitting your product at once. They are the source of all traffic — and they never wait.",
    capacity: Infinity,
    passthrough: 1,
    color: "#0ea5e9",
    layer: "entry",
    source: true,
  },
  browser: {
    kind: "browser",
    name: "Web Browser",
    glyph: "⌂",
    tagline: "SPA / SSR frontend",
    about:
      "The React or Next.js app running in the tab. Renders the UI, fires API calls, and holds the session cookie.",
    capacity: Infinity,
    passthrough: 1,
    color: "#0284c7",
    layer: "entry",
    source: true,
  },
  mobile: {
    kind: "mobile",
    name: "Mobile App",
    glyph: "▪",
    tagline: "iOS / Android client",
    about:
      "The native app on the phone. Talks to your API over the network, caches aggressively, and retries on flaky connections.",
    capacity: Infinity,
    passthrough: 1,
    color: "#0d9488",
    layer: "entry",
    source: true,
  },
  iot: {
    kind: "iot",
    name: "IoT Device",
    glyph: "◉",
    tagline: "sensors & edge hardware",
    about:
      "Thousands of tiny devices streaming telemetry. Low bandwidth each, but they never sleep and they multiply.",
    capacity: Infinity,
    passthrough: 1,
    color: "#14b8a6",
    layer: "entry",
    source: true,
  },

  /* ────────────────────────── EDGE ────────────────────────── */
  dns: {
    kind: "dns",
    name: "DNS",
    glyph: "⌘",
    tagline: "name → address",
    about:
      "Turn 'myapp.com' into an IP. The first hop of every request; here you steer traffic between regions and providers.",
    capacity: 500000,
    passthrough: 1,
    color: "#6366f1",
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
    color: "#8b5cf6",
    layer: "edge",
  },
  waf: {
    kind: "waf",
    name: "Firewall / WAF",
    glyph: "⛊",
    tagline: "blocks the bad traffic",
    about:
      "Web application firewall. Drops SQL injection, bots and DDoS floods at the door so they never touch your app servers.",
    capacity: 120000,
    passthrough: 1,
    color: "#dc2626",
    layer: "edge",
  },
  proxy: {
    kind: "proxy",
    name: "Reverse Proxy",
    glyph: "⇄",
    tagline: "nnginx / envoy in front",
    about:
      "Terminates TLS, compresses responses, and hands the request to the right backend. The friendly doorman for your fleet.",
    capacity: 180000,
    passthrough: 1,
    color: "#0891b2",
    layer: "edge",
  },
  gateway: {
    kind: "gateway",
    name: "API Gateway",
    glyph: "⧉",
    tagline: "one front door",
    about:
      "Auth, rate limits, routing and request shaping for every API — so each microservice doesn't reinvent it. One door, many rooms.",
    capacity: 150000,
    passthrough: 1,
    color: "#2563eb",
    layer: "edge",
  },

  /* ────────────────────────── COMPUTE ────────────────────────── */
  loadbalancer: {
    kind: "loadbalancer",
    name: "Load Balancer",
    glyph: "⋈",
    tagline: "spreads the crowd",
    about:
      "One address in, many servers out. It round-robins every request across your API fleet so no single box eats the whole wave.",
    capacity: 150000,
    passthrough: 1,
    color: "#06b6d4",
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
    color: "#16a34a",
    layer: "compute",
  },
  serverless: {
    kind: "serverless",
    name: "Serverless Fn",
    glyph: "λ",
    tagline: "lambda — pay per call",
    about:
      "Runs only when invoked, scales to zero when idle. Perfect for spiky jobs; cold starts are the tax you pay.",
    capacity: 60000,
    passthrough: 1,
    color: "#7c3aed",
    layer: "compute",
  },
  container: {
    kind: "container",
    name: "Container",
    glyph: "⧫",
    tagline: "docker image, one process",
    about:
      "Your app sealed in an image with its dependencies. Immutable, reproducible, and identical on every machine.",
    capacity: 80000,
    passthrough: 1,
    color: "#0ea5e9",
    layer: "compute",
  },
  orchestrator: {
    kind: "orchestrator",
    name: "Orchestrator (K8s)",
    glyph: "⎈",
    tagline: "schedules the fleet",
    about:
      "Kubernetes. Decides which container runs where, restarts the dead, and scales replicas up when traffic climbs.",
    capacity: 200000,
    passthrough: 1,
    color: "#326ce5",
    layer: "compute",
  },
  microservice: {
    kind: "microservice",
    name: "Microservice",
    glyph: "◧",
    tagline: "one bounded role",
    about:
      "A small service that owns exactly one job — orders, users, billing. Small blast radius, independent deploys.",
    capacity: 40000,
    passthrough: 1,
    color: "#22c55e",
    layer: "compute",
  },
  graphql: {
    kind: "graphql",
    name: "GraphQL API",
    glyph: "◎",
    tagline: "one query shape",
    about:
      "Clients ask for exactly the fields they need. Powerful, but a single nested query can fan out into a dozen backend calls.",
    capacity: 30000,
    passthrough: 1,
    color: "#d63384",
    layer: "compute",
  },
  bff: {
    kind: "bff",
    name: "BFF",
    glyph: "◑",
    tagline: "backend-for-frontend",
    about:
      "A thin layer tailored to one client — mobile gets mobile-shaped data, web gets web-shaped data. Fans out to many services.",
    capacity: 50000,
    passthrough: 1,
    color: "#f43f5e",
    layer: "compute",
  },
  auth: {
    kind: "auth",
    name: "Auth / Identity",
    glyph: "⚿",
    tagline: "who are you?",
    about:
      "Login, tokens, sessions and permissions. Every guarded request pays a visit; cache the verdicts or it becomes the hot path.",
    capacity: 60000,
    passthrough: 1,
    color: "#9333ea",
    layer: "compute",
  },
  ratelimit: {
    kind: "ratelimit",
    name: "Rate Limiter",
    glyph: "⊘",
    tagline: "keeps the hordes fair",
    about:
      "Caps how many requests a client may send per second. Absorbs abuse and smooths spikes before they reach your core.",
    capacity: 250000,
    passthrough: 0.9,
    color: "#ea580c",
    layer: "compute",
  },
  circuit: {
    kind: "circuit",
    name: "Circuit Breaker",
    glyph: "⊗",
    tagline: "fail fast, recover",
    about:
      "When a downstream dependency starts failing, it trips open and rejects instantly — sparing your service a cascade of timeouts.",
    capacity: 300000,
    passthrough: 1,
    color: "#e11d48",
    layer: "compute",
  },
  scheduler: {
    kind: "scheduler",
    name: "Scheduler / Cron",
    glyph: "◷",
    tagline: "runs jobs on a clock",
    about:
      "Triggers recurring work — nightly reports, cache warmups, cleanup. Stays idle until the timer fires.",
    capacity: 30000,
    passthrough: 1,
    color: "#ca8a04",
    layer: "compute",
  },

  /* ────────────────────────── DATA ────────────────────────── */
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
    name: "Database (SQL)",
    glyph: "▣",
    tagline: "read + write, one box",
    about:
      "Your single source of truth. Every read and every write on one machine — fast, until it isn't. This is the box that sweats.",
    capacity: 5000,
    passthrough: 0,
    color: "#e11d48",
    layer: "data",
  },
  nosql: {
    kind: "nosql",
    name: "NoSQL DB",
    glyph: "▦",
    tagline: "documents, flexible schema",
    about:
      "MongoDB / DynamoDB. Schemaless and easy to shard, at the cost of joins and strict guarantees. Great for fast-changing shapes.",
    capacity: 12000,
    passthrough: 0,
    color: "#db2777",
    layer: "data",
  },
  warehouse: {
    kind: "warehouse",
    name: "Data Warehouse",
    glyph: "▧",
    tagline: "analytics at scale",
    about:
      "Snowflake / BigQuery. Columnar storage built for giant analytical scans, not thousands of tiny row lookups.",
    capacity: 3000,
    passthrough: 0,
    color: "#9333ea",
    layer: "data",
  },
  lake: {
    kind: "lake",
    name: "Data Lake",
    glyph: "▨",
    tagline: "raw files, forever",
    about:
      "Cheap object storage holding every raw event and log in its original form. Structure is applied later, on read.",
    capacity: 2000,
    passthrough: 0,
    color: "#0d9488",
    layer: "data",
  },
  objectstore: {
    kind: "objectstore",
    name: "Object Storage",
    glyph: "▩",
    tagline: "S3 — files & blobs",
    about:
      "Durable, infinitely scalable buckets for images, videos, backups and static assets. HTTP in, HTTP out.",
    capacity: 20000,
    passthrough: 0,
    color: "#ea580c",
    layer: "data",
  },
  search: {
    kind: "search",
    name: "Search Index",
    glyph: "⌕",
    tagline: "elasticsearch / full-text",
    about:
      "Inverted indexes that answer 'find everything matching…' in milliseconds. Kept in sync with the primary store.",
    capacity: 15000,
    passthrough: 0,
    color: "#0284c7",
    layer: "data",
  },
  timeseries: {
    kind: "timeseries",
    name: "Time-Series DB",
    glyph: "◭",
    tagline: "metrics & events over time",
    about:
      "InfluxDB / Prometheus. Optimized for append-only timestamped points — perfect for metrics, IoT and monitoring data.",
    capacity: 8000,
    passthrough: 0,
    color: "#0891b2",
    layer: "data",
  },
  vectordb: {
    kind: "vectordb",
    name: "Vector DB",
    glyph: "◆",
    tagline: "similarity search",
    about:
      "Stores embeddings and finds nearest neighbours. The memory layer behind RAG, recommendations and semantic search.",
    capacity: 4000,
    passthrough: 0,
    color: "#7c3aed",
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
    color: "#f43f5e",
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
    color: "#d946ef",
    layer: "data",
  },
  config: {
    kind: "config",
    name: "Config Store",
    glyph: "⊞",
    tagline: "feature flags & settings",
    about:
      "Central home for feature flags, tunables and runtime config. Flip a switch and every service updates without a deploy.",
    capacity: 50000,
    passthrough: 0,
    color: "#64748b",
    layer: "data",
  },

  /* ────────────────────────── ASYNC ────────────────────────── */
  queue: {
    kind: "queue",
    name: "Message Queue",
    glyph: "≡",
    tagline: "work for later",
    about:
      "Kafka / SQS buffer. Slow jobs — emails, image processing, exports — get parked here and handled off the request path. Nothing is lost.",
    capacity: 80000,
    passthrough: 1,
    color: "#ca8a04",
    layer: "async",
  },
  pubsub: {
    kind: "pubsub",
    name: "Pub/Sub",
    glyph: "⇶",
    tagline: "one message, many listeners",
    about:
      "Publish once, every subscriber gets a copy. Decouples the sender from an unknown crowd of interested services.",
    capacity: 100000,
    passthrough: 1,
    color: "#f59e0b",
    layer: "async",
  },
  eventbus: {
    kind: "eventbus",
    name: "Event Bus",
    glyph: "⋯",
    tagline: "the system's nervous system",
    about:
      "Every state change becomes an event. Services react to what happened instead of being told what to do.",
    capacity: 90000,
    passthrough: 1,
    color: "#d97706",
    layer: "async",
  },
  stream: {
    kind: "stream",
    name: "Stream Processor",
    glyph: "≋",
    tagline: "transform in flight",
    about:
      "Flink / Spark Streaming. Filters, joins and aggregates events as they fly past — before they land in storage.",
    capacity: 30000,
    passthrough: 1,
    color: "#0891b2",
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
    color: "#16a34a",
    layer: "async",
  },
  dlq: {
    kind: "dlq",
    name: "Dead Letter Queue",
    glyph: "⊟",
    tagline: "where bad jobs go",
    about:
      "Messages that failed too many times land here instead of looping forever. A graveyard you can inspect and replay.",
    capacity: 5000,
    passthrough: 0,
    color: "#dc2626",
    layer: "async",
  },

  /* ────────────────────────── AI ────────────────────────── */
  model: {
    kind: "model",
    name: "AI Model",
    glyph: "✦",
    tagline: "inference, GPU-bound",
    about:
      "The expensive one. Runs on GPUs, costs real money per token, and saturates fast. Batch it, cache it, or route only the requests that deserve it.",
    capacity: 500,
    passthrough: 0,
    color: "#6366f1",
    layer: "ai",
  },
  embedding: {
    kind: "embedding",
    name: "Embedding Service",
    glyph: "⁂",
    tagline: "text → vectors",
    about:
      "Turns text into vectors for search and memory. Cheap compared to generation, but called constantly.",
    capacity: 2000,
    passthrough: 0,
    color: "#8b5cf6",
    layer: "ai",
  },
  rag: {
    kind: "rag",
    name: "RAG Pipeline",
    glyph: "⊛",
    tagline: "retrieve, then generate",
    about:
      "Fetches relevant context from the vector store, stuffs it into the prompt, then asks the model. Grounds answers in your data.",
    capacity: 800,
    passthrough: 0,
    color: "#d946ef",
    layer: "ai",
  },
  gpu: {
    kind: "gpu",
    name: "GPU Cluster",
    glyph: "⛁",
    tagline: "raw compute for models",
    about:
      "The hardware that actually runs inference and training. Scarce, expensive, and always the thing you wish you had more of.",
    capacity: 3000,
    passthrough: 0,
    color: "#7c3aed",
    layer: "ai",
  },

  /* ────────────────────────── OPS ────────────────────────── */
  monitoring: {
    kind: "monitoring",
    name: "Monitoring",
    glyph: "⍟",
    tagline: "dashboards & alerts",
    about:
      "Prometheus / Grafana. Scrapes every component and screams when a metric crosses its threshold. Your early-warning radar.",
    capacity: 100000,
    passthrough: 0,
    color: "#0ea5e9",
    layer: "ops",
  },
  logging: {
    kind: "logging",
    name: "Log Aggregator",
    glyph: "≣",
    tagline: "every line, one place",
    about:
      "Ships logs from every service into one searchable store — ELK or Loki. The first place you look when something breaks.",
    capacity: 150000,
    passthrough: 0,
    color: "#ca8a04",
    layer: "ops",
  },
  tracing: {
    kind: "tracing",
    name: "APM / Tracing",
    glyph: "⊹",
    tagline: "follow one request",
    about:
      "Distributed tracing stitches one request's journey across every service into a single timeline. Finds the slow hop.",
    capacity: 80000,
    passthrough: 0,
    color: "#0284c7",
    layer: "ops",
  },
  registry: {
    kind: "registry",
    name: "Service Registry",
    glyph: "⊜",
    tagline: "who's alive right now",
    about:
      "Keeps a live directory of healthy service instances so callers always know where to send traffic. Consul / etcd.",
    capacity: 100000,
    passthrough: 0,
    color: "#6366f1",
    layer: "ops",
  },
  secrets: {
    kind: "secrets",
    name: "Secrets Manager",
    glyph: "⛨",
    tagline: "keys, tokens, certs",
    about:
      "Vault / AWS Secrets Manager. Hands out credentials at runtime so nothing sensitive ever lives in your repo.",
    capacity: 60000,
    passthrough: 0,
    color: "#dc2626",
    layer: "ops",
  },
  notify: {
    kind: "notify",
    name: "Notification Svc",
    glyph: "✱",
    tagline: "email, SMS, push",
    about:
      "Fans a single event out to email, SMS and push providers. Retries, templates and delivery tracking in one place.",
    capacity: 20000,
    passthrough: 0,
    color: "#f59e0b",
    layer: "ops",
  },
  payment: {
    kind: "payment",
    name: "Payment Service",
    glyph: "⊚",
    tagline: "money changes hands",
    about:
      "Stripe / Adyen integration. Idempotent, audited, and the one service you truly cannot afford to drop a request on.",
    capacity: 10000,
    passthrough: 0,
    color: "#16a34a",
    layer: "ops",
  },
};

export const ALL_KINDS = Object.keys(CATALOG) as NodeKind[];

export const PALETTE_GROUPS: { layer: Layer; label: string }[] = [
  { layer: "entry", label: "entry" },
  { layer: "edge", label: "edge" },
  { layer: "compute", label: "compute" },
  { layer: "data", label: "data" },
  { layer: "async", label: "async" },
  { layer: "ai", label: "ai" },
  { layer: "ops", label: "ops" },
];

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
  {
    id: "ai",
    index: "06",
    title: "AI STACK",
    blurb: "Retrieval, embeddings, a GPU-bound model — and one bridge.",
    users: 300000,
    nodes: [
      N("u", "client", COL[0] - 40, 300),
      N("gw", "gateway", COL[0] + 200, 300),
      N("bff", "bff", COL[1] - 20, 180),
      N("emb", "embedding", COL[1] - 20, 430),
      N("vec", "vectordb", COL[2] + 40, 430),
      N("rag", "rag", COL[2] + 40, 180),
      N("llm", "model", COL[3] + 60, 120),
      N("gpu", "gpu", COL[3] + 60, 300),
      N("cach", "cache", COL[2] + 40, 620),
    ],
    edges: [
      E("u", "gw"),
      E("gw", "bff"),
      E("gw", "emb"),
      E("emb", "vec"),
      E("bff", "rag"),
      E("rag", "vec", "read", 1),
      E("rag", "llm", "read", 1),
      E("llm", "gpu", "read", 1),
      E("bff", "cach", "read", 0.4),
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
  const sources = nodes.filter((n) => CATALOG[n.kind].source);
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
      const inFlow = entry.source ? seed : (flow.get(n.id) ?? 0);
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
    const sn: SimNode = {
      node: n,
      entry,
      capacity,
      inflow,
      load,
      overloaded: load > 1,
    };
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
  n >= 1000
    ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
    : `${Math.round(n)}`;

export const fmtUsers = (n: number) =>
  n >= 1000000 ? `${(n / 1000000).toFixed(2)}M` : fmt(n);

export const newId = (kind: NodeKind) =>
  `${kind}-${Math.random().toString(36).slice(2, 6)}`;

/* ============================================================
   COST MODEL — rough monthly cloud bill per component
   base   : $/month per instance (amortised managed service / VM)
   perM   : $ per 1,000,000 requests handled
   ============================================================ */
export interface Price {
  base: number;
  perM: number;
}

export const COST: Record<NodeKind, Price> = {
  client: { base: 0, perM: 0 },
  browser: { base: 0, perM: 0 },
  mobile: { base: 0, perM: 0 },
  iot: { base: 0, perM: 0 },
  dns: { base: 0, perM: 0.4 },
  cdn: { base: 10, perM: 0.6 },
  waf: { base: 30, perM: 0.6 },
  proxy: { base: 20, perM: 0.02 },
  gateway: { base: 40, perM: 0.9 },
  loadbalancer: { base: 25, perM: 0.008 },
  api: { base: 35, perM: 0.4 },
  serverless: { base: 0, perM: 0.2 },
  container: { base: 30, perM: 0.3 },
  orchestrator: { base: 75, perM: 0.01 },
  microservice: { base: 30, perM: 0.35 },
  graphql: { base: 45, perM: 0.5 },
  bff: { base: 35, perM: 0.4 },
  auth: { base: 25, perM: 0.1 },
  ratelimit: { base: 15, perM: 0.02 },
  circuit: { base: 10, perM: 0.01 },
  scheduler: { base: 10, perM: 0.01 },
  cache: { base: 45, perM: 0.05 },
  database: { base: 220, perM: 0.25 },
  nosql: { base: 120, perM: 0.15 },
  warehouse: { base: 500, perM: 1.2 },
  lake: { base: 60, perM: 0.02 },
  objectstore: { base: 25, perM: 0.02 },
  search: { base: 180, perM: 0.5 },
  timeseries: { base: 90, perM: 0.3 },
  vectordb: { base: 150, perM: 0.4 },
  replica: { base: 160, perM: 0.1 },
  shard: { base: 150, perM: 0.2 },
  config: { base: 20, perM: 0.01 },
  queue: { base: 30, perM: 0.4 },
  pubsub: { base: 30, perM: 0.5 },
  eventbus: { base: 40, perM: 0.45 },
  stream: { base: 120, perM: 0.6 },
  worker: { base: 30, perM: 0.2 },
  dlq: { base: 10, perM: 0.05 },
  model: { base: 0, perM: 400 },
  embedding: { base: 0, perM: 120 },
  rag: { base: 50, perM: 300 },
  gpu: { base: 3000, perM: 60 },
  monitoring: { base: 60, perM: 0.2 },
  logging: { base: 80, perM: 0.35 },
  tracing: { base: 70, perM: 0.3 },
  registry: { base: 30, perM: 0.02 },
  secrets: { base: 40, perM: 0.01 },
  notify: { base: 20, perM: 0.6 },
  payment: { base: 0, perM: 2.9 },
};

export const SECONDS_PER_MONTH = 2_592_000;

export interface NodeCost {
  instances: number;
  fixed: number;
  variable: number;
  total: number;
}

/**
 * Cost = units × base + traffic × perM.
 * A "unit" is one catalog-sized instance. You pay for whichever is greater:
 * what the load demands (inflow / natural capacity) or what you provisioned
 * (your capacity override / natural capacity). So scaling up costs more, and
 * adding traffic costs more — both directions are monotonic.
 */
export function costOf(sn: SimNode): NodeCost {
  const p = COST[sn.node.kind];
  const natural = sn.entry.capacity;
  let units = 0;
  if (!sn.entry.source && natural !== Infinity && natural > 0) {
    units = Math.max(1, sn.inflow / natural, sn.capacity / natural);
  }
  const instances = Math.ceil(units);
  const fixed = p.base * units;
  const monthlyReq = sn.inflow * SECONDS_PER_MONTH;
  const variable = (monthlyReq / 1_000_000) * p.perM;
  return { instances, fixed, variable, total: fixed + variable };
}

export interface Bill {
  total: number;
  rows: { id: string; name: string; color: string; cost: NodeCost }[];
}

export function billOf(sim: Sim): Bill {
  let total = 0;
  const rows = Object.values(sim.nodes).map((sn) => {
    const cost = costOf(sn);
    total += cost.total;
    return {
      id: sn.node.id,
      name: sn.entry.name,
      color: sn.entry.color,
      cost,
    };
  });
  rows.sort((a, b) => b.cost.total - a.cost.total);
  return { total, rows };
}

export const fmtMoney = (n: number) => {
  if (!isFinite(n)) return "∞";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 10_000 ? 1 : 2)}k`;
  return `$${n.toFixed(n < 100 ? 2 : 0)}`;
};

/* ============================================================
   SMART STACK — an opinionated, scalable default architecture.
   Built to hold: after wiring, each component is auto-sized so
   nothing sits over capacity at the given user count.
   ============================================================ */
export function smartStack(users: number): {
  nodes: FlowNode[];
  edges: Edge[];
} {
  const C = [60, 340, 620, 900, 1180];
  const nodes: FlowNode[] = [
    N("u", "client", C[0], 430),
    N("dns", "dns", C[1], 90),
    N("waf", "waf", C[1], 330),
    N("cdn", "cdn", C[1], 570),
    N("lb", "loadbalancer", C[2], 330),
    N("api1", "api", C[3], 210),
    N("api2", "api", C[3], 450),
    N("cache", "cache", C[4], 90),
    N("db", "database", C[4], 330),
    N("r1", "replica", C[4], 570),
    N("r2", "replica", C[4], 810),
    N("q", "queue", C[3], 700),
    N("w1", "worker", C[4], 1050),
    N("mon", "monitoring", C[2], 700),
  ];
  const edges: Edge[] = [
    E("u", "dns", "read", 1),
    E("u", "waf", "read", 1),
    E("u", "cdn", "read", 1),
    E("dns", "lb", "read", 1),
    E("waf", "lb", "read", 1),
    E("cdn", "lb", "read", 0.35),
    E("lb", "api1", "read", 1),
    E("lb", "api2", "read", 1),
    E("api1", "cache", "read", 1),
    E("api1", "r1", "read", 1),
    E("api1", "db", "write", 0.15),
    E("api1", "q", "async", 0.3),
    E("api2", "cache", "read", 1),
    E("api2", "r2", "read", 1),
    E("api2", "db", "write", 0.15),
    E("api2", "q", "async", 0.3),
    E("q", "w1", "async", 1),
    E("api1", "mon", "read", 0.1),
  ];

  const s = simulate(nodes, edges, users);
  const sized = nodes.map((n) => {
    const sn = s.nodes[n.id];
    if (!sn || sn.capacity === Infinity || !sn.overloaded) return n;
    return { ...n, capacity: Math.ceil((sn.inflow * 1.3) / 100) * 100 };
  });
  return { nodes: sized, edges };
}
