# Flow Studio

Link components together — see how the system holds.

A system-design playground. Drag infrastructure blocks onto the canvas, wire
them together, crank the user count, and watch traffic propagate through the
graph. Whatever runs past its capacity lights up red as the bottleneck.

## What it does

- **Drag-and-drop canvas** — pan, zoom, drag nodes.
- **Drag-to-connect** — grab the ● port on a node's right edge and drop it on
  another node to wire them. Repeat to fan one node out to as many targets as
  you like; drop direction sets the arrow.
- **Multi-select** — shift-click to add nodes, or shift-drag a box around a
  group. Drag any selected node to move the whole group together.
- **Connection modes** — each link is tagged read / write / async.
- **Live traffic simulation** — a fixed-point propagation pass pushes requests
  per second through the graph. Caches and CDNs absorb their share; the rest
  flows downstream.
- **Bottleneck detection** — every node shows a load meter. Anything over 100%
  of capacity turns red and gets called out in the banner.
- **Tunable capacity** — select a node and slide its capacity to see the
  tipping point move.
- **50 components**, searchable and grouped by tier.
- **Light & dark themes** — light by default, toggle in the header.

## Components (50)

| Tier | Components |
| --- | --- |
| **entry** | Users · Web Browser · Mobile App · IoT Device |
| **edge** | DNS · CDN · Firewall/WAF · Reverse Proxy · API Gateway |
| **compute** | Load Balancer · API Server · Serverless Fn · Container · Orchestrator (K8s) · Microservice · GraphQL API · BFF · Auth/Identity · Rate Limiter · Circuit Breaker · Scheduler/Cron |
| **data** | Cache · Database (SQL) · NoSQL DB · Data Warehouse · Data Lake · Object Storage · Search Index · Time-Series DB · Vector DB · Read Replica · Shard · Config Store |
| **async** | Message Queue · Pub/Sub · Event Bus · Stream Processor · Worker · Dead Letter Queue |
| **ai** | AI Model · Embedding Service · RAG Pipeline · GPU Cluster |
| **ops** | Monitoring · Log Aggregator · APM/Tracing · Service Registry · Secrets Manager · Notification Svc · Payment Service |

## Scenarios

Six guided builds that walk from failure to a system that holds:

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
simulation logic is client-side — no backend required. Theming is driven by
CSS custom properties, so `[data-theme="dark"]` flips the entire palette.
