# Flow Studio

Link components together — see how the system holds.

A system-design playground. Drag infrastructure blocks onto the canvas, wire
them together, crank the user count, and watch traffic propagate through the
graph. Whatever runs past its capacity lights up red as the bottleneck — then
find out what it costs, how slow it is, and whether it survives losing a node.

## What it does

- **Drag-and-drop canvas** — pan, zoom, drag nodes.
- **Drag-to-connect** — grab the ● port on a node's right edge and drop it on
  another node. Repeat to fan one node out to as many targets as you like.
- **Multi-select** — shift-click to add nodes, or shift-drag a box around a
  group. Drag any selected node to move the whole group together.
- **Live traffic simulation** — a fixed-point propagation pass pushes requests
  per second through the graph. Caches and CDNs absorb their share; the rest
  flows downstream.
- **Bottleneck detection** — every node shows a load meter. Anything over 100%
  of capacity turns red and gets called out in the banner.

## The analysis layer

| Feature | What it tells you |
| --- | --- |
| **💰 Cost model** | Monthly bill per component (fixed instances + per-request fees), a total, and your top 5 cost drivers. Toggle `$ cost` to print `$/mo` on every node. Scaling up costs more, and so does adding traffic. |
| **⏱ Latency model** | Every hop has a p99. Saturated hops balloon with queueing delay (M/M/1), so the end-to-end number is the *slowest path*. Toggle `⏱ latency` to see per-node p99. |
| **💥 Chaos mode** | Kill any node and watch the fallout — traffic that was flowing through it is dropped and everything downstream starves. `↺ revive all` brings it back. |
| **🕳 SPOF detector** | Flags every node whose removal strands the rest of the graph, plus lone data stores with no replica. Amber ring + `SPOF` badge. |
| **🎬 Watch the fix** | Time-lapse: revives everything, then sizes each bottleneck clear of its load, one at a time. |
| **📊 Cost vs latency chart** | Records each design you build as a point. Cheapest sits bottom-left, fastest top-left — the sweet spot is low and left. |
| **🔗 Shareable designs** | Encodes the whole graph into a URL. Send it to anyone; it loads exactly as you built it. |
| **🖼 Export** | Download the canvas as a standalone SVG or a 2× PNG — or export the design as **Terraform** (`main.tf`) or a runnable **`docker-compose.yml`** with the right images and `depends_on` wiring. |
| **⚔️ Challenge mode** | Three graded puzzles — make it hold, stay under budget, and (optionally) survive any single failure. |
| **🌍 Multi-region** | Clones the stack into a second region behind a region router that splits traffic 50/50. Watch p99 collapse and the bill climb. |

## Quality of life

| Feature | What it does |
| --- | --- |
| **↩ Undo / redo** | `⌘Z` / `⌘⇧Z` (or the toolbar buttons) step through every change. A drag counts as one step, not fifty. |
| **💾 Saved designs** | A small library in `localStorage` — name a design, reload it later. Per-browser; use 🔗 share for a portable link. |
| **📖 Explain this design** | Writes a plain-English read of what you built: traffic, the bottleneck, p99, the bill and its biggest line item, the single points of failure, and the cheapest next move. |
| **📐 Real-world scale presets** | Side project → Growing startup → Scaling fast → Hyperscale. One click, and you watch the *same* design buckle at four different sizes. |
| **🎓 Guided tour** | Six steps on first visit (and behind `? help`) covering wiring, load, the numbers, and the failure tools. |
| **⌨️ Keyboard shortcuts** | `⌘Z` undo · `⌘⇧Z` redo · `Delete`/`Backspace` remove selection · `Esc` deselect. |
| **📱 Touch** | The canvas takes touch input, so drag-to-connect and panning work on a phone or tablet. |

## Capacity is always real

Auto-scale never invents a number. Capacity is always a whole number of
catalog-sized instances and never below the default that component ships with —
a database at 75k req/s becomes **19 × 5,000 = 95,000 rps**, not some arbitrary
figure below the real product. The Inspector shows the current multiplier (`×19`)
and lets you dial it in, with a **reset to 1×**. Same rule drives the cost model
and both IaC exports, so the diagram, the bill and the generated code agree.

## Components (51)

| Tier | Components |
| --- | --- |
| **entry** | Users · Web Browser · Mobile App · IoT Device |
| **edge** | DNS · CDN · Firewall/WAF · Reverse Proxy · API Gateway · Region Router |
| **compute** | Load Balancer · API Server · Serverless Fn · Container · Orchestrator (K8s) · Microservice · GraphQL API · BFF · Auth/Identity · Rate Limiter · Circuit Breaker · Scheduler/Cron |
| **data** | Cache · Database (SQL) · NoSQL DB · Data Warehouse · Data Lake · Object Storage · Search Index · Time-Series DB · Vector DB · Read Replica · Shard · Config Store |
| **async** | Message Queue · Pub/Sub · Event Bus · Stream Processor · Worker · Dead Letter Queue |
| **ai** | AI Model · Embedding Service · RAG Pipeline · GPU Cluster |
| **ops** | Monitoring · Log Aggregator · APM/Tracing · Service Registry · Secrets Manager · Notification Svc · Payment Service |

Names are abbreviated on the cards (`SQL DB`, `K8s`, `TSDB`, `Embeddings`) so
labels stay readable; hover a palette entry for the full name and description.

## Scenarios

1. **The Pressure Test** — millions of users, one database.
2. **Cache the Reads** — 95% of traffic is reads.
3. **Read Replicas** — split reads from writes.
4. **Shard the Writes** — scale writes horizontally.
5. **Full Scale** — every layer doing one job.
6. **AI Stack** — retrieval, embeddings, a GPU-bound model, and one bridge.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · TypeScript. All
simulation, costing, latency and graph analysis is client-side — no backend
required. Theming is driven by CSS custom properties, so `[data-theme="dark"]`
flips the entire palette.

Source layout:

- `src/lib/design.ts` — catalog, pricing, latency constants, simulator, scenarios, challenges, presets
- `src/lib/analysis.ts` — latency propagation and single-point-of-failure detection
- `src/lib/explain.ts` — the plain-English design narrator
- `src/lib/iac.ts` — Terraform and docker-compose generation
- `src/lib/share.ts` — URL encoding/decoding, saved-design library, SVG/PNG export
- `src/components/FlowStudio.tsx` — the studio shell and all interactions
