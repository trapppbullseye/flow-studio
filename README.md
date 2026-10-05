# Flow Studio

Link components together — see how the system holds.

A system-design playground. Drag infrastructure blocks onto the canvas, wire
them together, crank the user count, and watch traffic propagate through the
graph. Whatever runs past its capacity lights up red as the bottleneck.

## What it does

- **Drag-and-drop canvas** — pan, zoom, drag nodes.
- **Link mode** — click 🔗 then two nodes to wire them (read / write / async).
- **Live traffic simulation** — a fixed-point propagation pass pushes requests
  per second through the graph. Caches and CDNs absorb their share; the rest
  flows downstream.
- **Bottleneck detection** — every node shows a load meter. Anything over 100%
  of capacity turns red and gets called out in the banner.
- **Tunable capacity** — select a node and slide its capacity to see the
  tipping point move.

## Components

Users · CDN · Load Balancer · API Server · Cache · Database · Read Replica ·
Shard · Queue · Worker · AI Model — each with realistic capacity numbers.

## Scenarios

Five guided builds that walk from failure to a system that holds:

1. **The Pressure Test** — millions of users, one database.
2. **Cache the Reads** — 95% of traffic is reads.
3. **Read Replicas** — split reads from writes.
4. **Shard the Writes** — scale writes horizontally.
5. **Full Scale** — every layer doing one job.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · TypeScript. All
simulation logic is client-side — no backend required.
