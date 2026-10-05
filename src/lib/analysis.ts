import {
  CATALOG,
  LATENCY,
  type Edge,
  type FlowNode,
  type NodeKind,
  type Sim,
  type SimNode,
} from "./design";

/* ============================================================
   LATENCY
   ============================================================ */

/**
 * Effective p99 for one hop, including queueing delay. Below capacity it's
 * close to the base number; as utilisation approaches 1 the queue explodes
 * (the classic M/M/1 curve), which is exactly what you feel in production.
 */
export function latencyOf(sn: SimNode): number {
  const base = LATENCY[sn.node.kind];
  if (!base || sn.dead) return 0;
  const util = Math.min(0.97, Math.max(0, sn.load));
  const factor = util <= 0 ? 1 : 1 / Math.max(0.05, 1 - util);
  return base * factor;
}

export interface LatencyReport {
  /** effective p99 per node, ms */
  perNode: Record<string, number>;
  /** base p99 per node, ms (no contention) */
  basePerNode: Record<string, number>;
  /** slowest path through the graph, ms */
  endToEnd: number;
  /** the hop that contributes the most latency */
  slowestId: string | null;
  slowestMs: number;
}

/**
 * End-to-end p99 = the slowest path through the graph, summing each hop's
 * effective latency. Cycles are broken with a visiting guard so this always
 * terminates even if the user wires a loop.
 */
export function analyzeLatency(
  nodes: FlowNode[],
  edges: Edge[],
  sim: Sim,
): LatencyReport {
  const incoming = new Map<string, Edge[]>();
  for (const e of edges) {
    const arr = incoming.get(e.to) ?? [];
    arr.push(e);
    incoming.set(e.to, arr);
  }

  const perNode: Record<string, number> = {};
  const basePerNode: Record<string, number> = {};
  for (const n of nodes) {
    perNode[n.id] = latencyOf(sim.nodes[n.id]);
    basePerNode[n.id] = LATENCY[n.kind];
  }

  const memo = new Map<string, number>();
  const pathTo = (id: string, stack: Set<string>): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (stack.has(id)) return 0;
    stack.add(id);
    let best = 0;
    for (const e of incoming.get(id) ?? []) {
      if (!sim.nodes[e.from]) continue;
      const up = pathTo(e.from, stack) + (perNode[e.from] ?? 0);
      if (up > best) best = up;
    }
    stack.delete(id);
    memo.set(id, best);
    return best;
  };

  let endToEnd = 0;
  for (const n of nodes) endToEnd = Math.max(endToEnd, pathTo(n.id, new Set()) + (perNode[n.id] ?? 0));

  let slowestId: string | null = null;
  let slowestMs = 0;
  for (const n of nodes) {
    if ((perNode[n.id] ?? 0) > slowestMs) {
      slowestMs = perNode[n.id];
      slowestId = n.id;
    }
  }

  return { perNode, basePerNode, endToEnd, slowestId, slowestMs };
}

export const fmtMs = (ms: number) => {
  if (!isFinite(ms)) return "∞";
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 2)}s`;
  if (ms >= 10) return `${Math.round(ms)}ms`;
  return `${ms.toFixed(1)}ms`;
};

/* ============================================================
   SINGLE POINT OF FAILURE
   ============================================================ */

/** kinds that count as redundancy for a given store */
const REDUNDANCY: Partial<Record<NodeKind, NodeKind[]>> = {
  database: ["database", "replica", "shard", "nosql"],
  nosql: ["nosql", "database", "replica", "shard"],
  cache: ["cache"],
  search: ["search"],
  vectordb: ["vectordb"],
  timeseries: ["timeseries"],
  warehouse: ["warehouse"],
  lake: ["lake"],
  objectstore: ["objectstore"],
};

/**
 * A node is a single point of failure if either:
 *  (a) removing it strands some other node so no source can reach it, or
 *  (b) it's a data store carrying traffic with no redundant sibling.
 */
export function findSpofs(nodes: FlowNode[], edges: Edge[]): string[] {
  const reach = (removed: string | null): Set<string> => {
    const outs = new Map<string, string[]>();
    for (const e of edges) {
      if (e.from === removed || e.to === removed) continue;
      const arr = outs.get(e.from) ?? [];
      arr.push(e.to);
      outs.set(e.from, arr);
    }
    const seen = new Set<string>();
    const stack = nodes
      .filter((n) => CATALOG[n.kind].source && n.id !== removed)
      .map((n) => n.id);
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const t of outs.get(id) ?? []) if (!seen.has(t)) stack.push(t);
    }
    return seen;
  };

  const base = reach(null);
  const kindCount = new Map<NodeKind, number>();
  for (const n of nodes) kindCount.set(n.kind, (kindCount.get(n.kind) ?? 0) + 1);

  const spofs: string[] = [];
  for (const n of nodes) {
    if (CATALOG[n.kind].source) continue;

    // (a) graph disconnection
    const without = reach(n.id);
    let stranded = false;
    for (const id of base) {
      if (id === n.id) continue;
      if (!without.has(id)) {
        stranded = true;
        break;
      }
    }
    if (stranded) {
      spofs.push(n.id);
      continue;
    }

    // (b) lone data store with no redundancy
    const family = REDUNDANCY[n.kind];
    if (family) {
      let siblings = 0;
      for (const other of nodes) {
        if (other.id === n.id) continue;
        if (family.includes(other.kind)) siblings++;
      }
      if (siblings === 0) spofs.push(n.id);
    }
  }
  return spofs;
}
