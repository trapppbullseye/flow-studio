import {
  CATALOG,
  fmt,
  fmtMoney,
  fmtUsers,
  shortName,
  type Edge,
  type FlowNode,
  type Sim,
} from "./design";
import { fmtMs, type LatencyReport } from "./analysis";

export interface ExplainInput {
  nodes: FlowNode[];
  edges: Edge[];
  users: number;
  sim: Sim;
  total: number;
  lat: LatencyReport;
  spofs: Set<string>;
  dead: string[];
  topCost: { name: string; total: number }[];
}

/**
 * Writes a plain-English read of the current design: what it does, where it
 * breaks, what it costs, how slow it is, and where it's fragile.
 */
export function explainDesign(x: ExplainInput): string[] {
  const { nodes, edges, users, sim, total, lat, spofs, dead, topCost } = x;
  if (!nodes.length) return ["Nothing on the canvas yet — add a component from the palette, then drag a ● port to wire it up."];

  const out: string[] = [];
  const sources = nodes.filter((n) => CATALOG[n.kind].source).length;

  out.push(
    `This design moves about ${fmt(sim.rps)} requests/sec from ${fmtUsers(users)} users through ${nodes.length} components and ${edges.length} links.`,
  );

  if (dead.length) {
    const names = dead
      .map((id) => nodes.find((n) => n.id === id))
      .filter(Boolean)
      .map((n) => shortName(n!.kind));
    out.push(
      `${names.join(" and ")} ${names.length > 1 ? "are" : "is"} DOWN, dropping ${fmt(sim.dropped)} req/s on the floor.`,
    );
  }

  if (sim.worst) {
    const name = CATALOG[sim.worst.node.kind].name;
    const pct = Math.round(sim.worst.load * 100);
    out.push(
      `${name} is the bottleneck — it's at ${pct}% of capacity, so everything behind it queues up. That single component is what your users actually feel.`,
    );
  } else if (sources && nodes.some((n) => !CATALOG[n.kind].source)) {
    out.push(
      "Every component is under its capacity, so the design holds at this load.",
    );
  }

  if (lat.endToEnd > 0) {
    const slow = lat.slowestId
      ? nodes.find((n) => n.id === lat.slowestId)
      : undefined;
    const base = slow ? lat.basePerNode[slow.id] : 0;
    const queued = slow ? lat.perNode[slow.id] > base * 1.6 : false;
    out.push(
      `End to end it answers in about ${fmtMs(lat.endToEnd)} at p99` +
        (slow
          ? `, and the slowest hop is ${shortName(slow.kind)} at ${fmtMs(lat.perNode[slow.id])}` +
            (queued
              ? " — mostly queueing delay, not raw work, so it gets better as soon as you take load off it."
              : ".")
          : "."),
    );
  }

  if (total > 0) {
    const top = topCost[0];
    const share = top && total ? Math.round((top.total / total) * 100) : 0;
    out.push(
      `Running it costs roughly ${fmtMoney(total)}/month` +
        (top ? `, and ${top.name} alone is ${share}% of the bill (${fmtMoney(top.total)}).` : "."),
    );
  }

  if (spofs.size) {
    const names = Array.from(spofs)
      .map((id) => nodes.find((n) => n.id === id))
      .filter(Boolean)
      .map((n) => shortName(n!.kind));
    out.push(
      `${spofs.size} component${spofs.size > 1 ? "s are" : " is"} a single point of failure (${names.slice(0, 4).join(", ")}${names.length > 4 ? "…" : ""}) — lose one and part of the system goes dark.`,
    );
  } else if (nodes.some((n) => !CATALOG[n.kind].source)) {
    out.push(
      "Nothing is a single point of failure — every path has a backup.",
    );
  }

  // cheapest next move
  if (sim.worst) {
    const kind = sim.worst.node.kind;
    const tip =
      kind === "database"
        ? "Add Read Replicas for the reads and Shards for the writes — or put a Cache in front and most traffic never reaches the disk."
        : kind === "cache" || kind === "api" || kind === "microservice"
          ? "Add a second instance in parallel (or bump this one's capacity) — stateless tiers scale out cheaply."
          : kind === "model" || kind === "gpu"
            ? "Cache results, batch requests, or route only the traffic that genuinely needs the model. Per-token cost doesn't shrink with more hardware."
            : "Raise its capacity, or split traffic across two of them.";
    out.push(`Cheapest next move: ${tip}`);
  }

  return out;
}
