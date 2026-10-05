#!/usr/bin/env python3
"""
make_challenge.py — generate Flow Studio challenges.

Writes a typed TypeScript file that the app imports. Each challenge is either:

  empty  — "from nothing": you start at $0 spent on a blank canvas and build a
           system that serves the target load without blowing the budget.
  broken — "repair it": you're handed a design that melts, and must fix it.

Budgets are derived from a reference stack priced with the *same* cost model the
app uses, so every generated challenge is actually solvable (and tight enough to
be interesting).

Usage:
    python3 scripts/make_challenge.py                     # 8 challenges
    python3 scripts/make_challenge.py --count 20 --seed 7
    python3 scripts/make_challenge.py --out src/lib/challenges.generated.ts
    python3 scripts/make_challenge.py --stdout            # print, don't write
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from pathlib import Path

# ── the app's cost model ────────────────────────────────────────────────────
SECONDS_PER_MONTH = 2_592_000

# kind -> (natural capacity rps, base $/mo per instance, $ per 1M requests)
PRICES = {
    "loadbalancer": (150_000, 25, 0.008),
    "api": (100_000, 35, 0.4),
    "cache": (120_000, 45, 0.05),
    "database": (5_000, 220, 0.25),
    "replica": (40_000, 160, 0.1),
    "queue": (80_000, 30, 0.4),
    "worker": (8_000, 30, 0.2),
    "monitoring": (100_000, 60, 0.2),
    "gateway": (150_000, 40, 0.9),
    "cdn": (200_000, 10, 0.6),
}


def node_cost(kind: str, inflow_rps: float) -> float:
    """Monthly cost of one component, mirroring src/lib/design.ts costOf()."""
    natural, base, per_m = PRICES[kind]
    units = max(1.0, math.ceil((inflow_rps / natural) * 1.25))
    fixed = base * units
    variable = (inflow_rps * SECONDS_PER_MONTH / 1_000_000) * per_m
    return fixed + variable


def reference_cost(users: int) -> float:
    """
    Price a sensible, minimal stack that would actually hold at this load.
    Used as the baseline for the budget so challenges stay winnable.
    """
    rps = users / 10.0
    total = 0.0
    total += node_cost("loadbalancer", rps)
    total += node_cost("api", rps)
    total += node_cost("cache", rps)          # absorbs ~95% of reads
    total += node_cost("database", rps * 0.05)  # only misses reach disk
    total += node_cost("replica", rps * 0.5)    # read traffic
    total += node_cost("replica", rps * 0.5)
    total += node_cost("queue", rps * 0.2)
    total += node_cost("worker", rps * 0.2)
    return total


# ── challenge flavour ───────────────────────────────────────────────────────
TITLES = [
    "FROM NOTHING",
    "COLD START",
    "LAUNCH DAY",
    "VIRAL FRIDAY",
    "ZERO TO HERO",
    "GREENFIELD",
    "THE BLANK PAGE",
    "FIRST CUSTOMER",
    "THE BIG BET",
    "SCALE OR DIE",
    "NO BUDGET, ALL VIBES",
    "SHIP IT",
]

BLURBS = [
    "An empty account and a load target. Build the whole thing yourself and stay inside your budget.",
    "Nothing exists yet. Wire up something that holds — you're paying for every box you place.",
    "You've got a blank canvas, a traffic forecast, and a finance team watching the meter.",
    "New project, new cloud bill starting at zero. Every component you add moves the needle.",
]

REPAIR_TITLES = [
    "THE MELT",
    "SWEATING BULLETS",
    "FIRST INCIDENT",
    "THE 3AM PAGE",
    "TRAFFIC SPIKE",
]

REPAIR_BLURBS = [
    "This design melts under load. Fix it without rebuilding from scratch — and stay under budget.",
    "One component is dying and taking everything with it. Find it and fix it.",
]


def make_challenge(rng: random.Random, index: int, start: str) -> dict:
    # traffic target: log-ish spread from a small app to a serious one
    users = int(round(10 ** rng.uniform(3.7, 6.2) / 1000.0) * 1000)
    users = max(5_000, min(3_000_000, users))

    ref = reference_cost(users)
    # tight but winnable: 1.15x–1.5x a competent minimal stack
    factor = rng.uniform(1.15, 1.5)
    budget = int(round(ref * factor / 1000.0) * 1000)
    budget = max(5_000, budget)

    require_no_spof = rng.random() < 0.35

    if start == "empty":
        nodes, edges = [], []
        title = rng.choice(TITLES)
        brief = (
            f"{rng.choice(BLURBS)} Target: {users:,} users "
            f"(~{int(users / 10):,} req/s) for under ${budget:,}/month."
        )
    else:
        nodes = [
            {"id": "u", "kind": "client", "x": 120, "y": 260},
            {"id": "api", "kind": "api", "x": 460, "y": 260},
            {"id": "db", "kind": "database", "x": 800, "y": 260},
        ]
        edges = [
            {"id": "u->api", "from": "u", "to": "api", "mode": "read"},
            {"id": "api->db", "from": "api", "to": "db", "mode": "write"},
        ]
        title = rng.choice(REPAIR_TITLES)
        brief = (
            f"{rng.choice(REPAIR_BLURBS)} Target: {users:,} users "
            f"(~{int(users / 10):,} req/s) for under ${budget:,}/month."
        )

    if require_no_spof:
        brief += " No single point of failure allowed."

    return {
        "id": f"gen-{start}-{index}-{rng.randrange(10_000):04d}",
        "title": title,
        "brief": brief,
        "budget": budget,
        "users": users,
        "requireNoSpof": require_no_spof,
        "start": start,
        "generated": True,
        "nodes": nodes,
        "edges": edges,
    }


def to_typescript(challenges: list[dict]) -> str:
    body = json.dumps(challenges, indent=2)
    return (
        "// AUTO-GENERATED by scripts/make_challenge.py — do not edit by hand.\n"
        "// Regenerate with:  python3 scripts/make_challenge.py\n"
        'import type { Challenge } from "./design";\n\n'
        f"export const GENERATED_CHALLENGES: Challenge[] = {body};\n"
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate Flow Studio challenges.")
    ap.add_argument("--count", type=int, default=8, help="how many to generate")
    ap.add_argument("--seed", type=int, default=None, help="RNG seed (reproducible)")
    ap.add_argument(
        "--empty-ratio",
        type=float,
        default=0.6,
        help="fraction that start from a blank canvas (rest are repair jobs)",
    )
    ap.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent.parent
        / "src"
        / "lib"
        / "challenges.generated.ts",
        help="output file",
    )
    ap.add_argument("--stdout", action="store_true", help="print instead of writing")
    args = ap.parse_args()

    rng = random.Random(args.seed)
    challenges = []
    for i in range(args.count):
        start = "empty" if rng.random() < args.empty_ratio else "broken"
        challenges.append(make_challenge(rng, i, start))

    ts = to_typescript(challenges)

    if args.stdout:
        print(ts)
        return 0

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(ts, encoding="utf-8")

    empties = sum(1 for c in challenges if c["start"] == "empty")
    print(f"wrote {len(challenges)} challenges -> {args.out}")
    print(f"  {empties} build-from-nothing, {len(challenges) - empties} repair jobs")
    for c in challenges:
        flag = "no-SPOF" if c["requireNoSpof"] else "spof-ok"
        print(
            f"  [{c['start']:6}] {c['title']:<16} "
            f"{c['users']:>9,} users  ${c['budget']:>10,}/mo  ({flag})"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
