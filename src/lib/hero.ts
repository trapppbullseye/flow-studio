import { CATALOG, COST, type NodeKind } from "./design";

/* ============================================================
   ZERO → HERO — a progression, not a puzzle.

   You start with nothing: $0 in the bank, 25 users (your friends),
   no revenue model at all, and only a free tier's worth of
   components unlocked.

   Each month: users arrive (or leave), they pay you, you pay your
   infrastructure bill, and the difference moves your bank balance.
   Cross a user threshold and you unlock a whole new tier of
   components — and the funding that comes with it.

   Three levers, all under your control:
     • PIVOT      — change what kind of business you are. ARPU and
                    growth are a straight trade-off: consumer apps
                    grow fast and pay pennies, B2B pays a fortune
                    and grows like a glacier. Pivoting costs you users.
     • PITCH      — ask investors for money. It's a gamble: the odds
                    depend on your traction, and you might get nothing.
     • SPEND      — every component is a monthly bill. Spend it all and
                    you run out of money. Then you're dead.
   ============================================================ */

export interface HeroStage {
  id: string;
  glyph: string;
  name: string;
  blurb: string;
  /** users needed to ENTER this stage */
  users: number;
  /** funding granted the moment you enter it */
  grant: number;
  grantLabel: string;
  /** free node purchases handed to you on entering this stage */
  grantNodes: number;
  unlocks: NodeKind[];
}

/* You only earn money once an actual client — a website or a mobile app —
   is wired up to your backend. Raw traffic isn't a business. */
export const REVENUE_CLIENTS: NodeKind[] = ["browser", "mobile"];

export function countsAsClient(kind: NodeKind): boolean {
  return REVENUE_CLIENTS.includes(kind);
}

/** one-off price to buy a node and put it on the canvas */
export function purchasePrice(kind: NodeKind): number {
  const e = CATALOG[kind];
  if (e.source) return 0; // your users' own devices — not something you buy
  const base = COST[kind].base;
  if (base === 0) return 0; // free tier
  return Math.max(50, Math.round(base * 3));
}

/** liquidate a node you no longer want */
export function sellPrice(kind: NodeKind): number {
  return Math.round(purchasePrice(kind) * 0.5);
}

export const HERO_STAGES: HeroStage[] = [
  {
    id: "side",
    glyph: "🌱",
    name: "Side project",
    blurb: "A weekend idea. You've got a free tier and 25 friends using it.",
    users: 0,
    grant: 0,
    grantLabel: "",
    grantNodes: 0,
    unlocks: ["client", "browser", "mobile", "iot", "serverless", "objectstore"],
  },
  {
    id: "traction",
    glyph: "🌿",
    name: "Getting traction",
    blurb: "People are telling people. Time for a real API and a database.",
    users: 5_000,
    grant: 2_000,
    grantLabel: "🌱 Angel cheque",
    grantNodes: 2,
    unlocks: ["api", "database", "cache", "monitoring", "logging"],
  },
  {
    id: "ramen",
    glyph: "📈",
    name: "Ramen profitable",
    blurb: "Enough revenue to survive. Now make it fast and dependable.",
    users: 25_000,
    grant: 25_000,
    grantLabel: "💸 Seed round",
    grantNodes: 3,
    unlocks: [
      "loadbalancer",
      "cdn",
      "dns",
      "replica",
      "worker",
      "queue",
      "config",
      "auth",
      "ratelimit",
      "scheduler",
      "circuit",
      "proxy",
    ],
  },
  {
    id: "funded",
    glyph: "💰",
    name: "Funded",
    blurb: "You raised. Headcount, microservices, and a real on-call rota.",
    users: 150_000,
    grant: 250_000,
    grantLabel: "🚀 Series A",
    grantNodes: 5,
    unlocks: [
      "gateway",
      "waf",
      "microservice",
      "container",
      "orchestrator",
      "graphql",
      "bff",
      "nosql",
      "shard",
      "search",
      "timeseries",
      "pubsub",
      "eventbus",
      "stream",
      "dlq",
      "secrets",
      "registry",
      "notify",
      "payment",
      "tracing",
    ],
  },
  {
    id: "business",
    glyph: "🏢",
    name: "Business",
    blurb: "A real company. Multiple regions, warehouses, and your own AI.",
    users: 750_000,
    grant: 0,
    grantLabel: "🏆 Scale-up",
    grantNodes: 8,
    unlocks: [
      "region",
      "lake",
      "warehouse",
      "vectordb",
      "model",
      "embedding",
      "rag",
      "gpu",
    ],
  },
];

/* ── what kind of business you are ─────────────────────────── */

export interface Business {
  id: string;
  glyph: string;
  name: string;
  blurb: string;
  /** $ per user per month */
  arpu: number;
  /** monthly growth rate while healthy */
  growth: number;
}

export const BUSINESSES: Business[] = [
  {
    id: "hobby",
    glyph: "🧪",
    name: "Hobby project",
    blurb: "Free users and good vibes. No revenue model yet — nothing to eat.",
    arpu: 0,
    growth: 0.4,
  },
  {
    id: "media",
    glyph: "📰",
    name: "Media / ads",
    blurb: "An enormous audience paying fractions of a cent. Volume is everything.",
    arpu: 0.05,
    growth: 0.45,
  },
  {
    id: "consumer",
    glyph: "📱",
    name: "Consumer app",
    blurb: "Millions of users, pennies each. Growth is your oxygen.",
    arpu: 0.1,
    growth: 0.38,
  },
  {
    id: "game",
    glyph: "🎮",
    name: "Game (IAP)",
    blurb: "A few whales carry the whole thing. Spiky, but real money.",
    arpu: 0.45,
    growth: 0.28,
  },
  {
    id: "marketplace",
    glyph: "🏪",
    name: "Marketplace",
    blurb: "You take a cut of every transaction. Two-sided and fiddly.",
    arpu: 1.2,
    growth: 0.2,
  },
  {
    id: "saas",
    glyph: "🛒",
    name: "SaaS tool",
    blurb: "Fewer users, proper money, monthly churn is the enemy.",
    arpu: 2.5,
    growth: 0.13,
  },
  {
    id: "b2b",
    glyph: "🏢",
    name: "B2B platform",
    blurb: "Enterprise contracts. Enormous cheques, glacial sales cycle.",
    arpu: 9,
    growth: 0.06,
  },
];

export function businessById(id: string): Business {
  return BUSINESSES.find((b) => b.id === id) ?? BUSINESSES[0];
}

/* ── tuning knobs ──────────────────────────────────────────── */

export const HERO_START_USERS = 25;
export const HERO_START_CASH = 0;
export const HERO_START_BUSINESS = "hobby";
/** growth is at least this many users a month so the early game moves */
export const GROWTH_FLOOR = 10;
/** flat growth while you're holding but losing money */
export const BROKE_GROWTH = 0.05;
/** users lost when you pivot (they didn't sign up for the new thing) */
export const PIVOT_CHURN = 0.3;
/** below this balance you're bankrupt */
export const BANKRUPT_AT = -2_000;

export function revenueFor(users: number, arpu: number): number {
  return users * arpu;
}

/** highest stage index whose threshold the user count has passed */
export function stageIndexFor(users: number): number {
  let idx = 0;
  for (let i = 0; i < HERO_STAGES.length; i++) {
    if (users >= HERO_STAGES[i].users) idx = i;
  }
  return idx;
}

/** every node kind unlocked at or before this stage */
export function unlockedUpTo(stageIndex: number): Set<NodeKind> {
  const set = new Set<NodeKind>();
  for (let i = 0; i <= Math.min(stageIndex, HERO_STAGES.length - 1); i++) {
    for (const k of HERO_STAGES[i].unlocks) set.add(k);
  }
  return set;
}

export function nextStage(stageIndex: number): HeroStage | null {
  return HERO_STAGES[stageIndex + 1] ?? null;
}

/* ── asking investors for money ────────────────────────────── */

export interface PitchInput {
  users: number;
  stageIndex: number;
  /** monthly revenue minus monthly bill */
  net: number;
  healthy: boolean;
  /** months of runway already raised, so you can't farm it forever */
  raises: number;
}

/** honest odds, shown to the player before they gamble */
export function pitchOdds(inp: PitchInput): number {
  let p = 0.16;
  // traction: 10 users ≈ +0.05, 1M users ≈ +0.30
  p += Math.min(0.3, (Math.log10(Math.max(1, inp.users)) / 6) * 0.3);
  if (inp.net > 0) p += 0.12;
  if (inp.healthy) p += 0.1;
  p += inp.stageIndex * 0.05;
  // investors get bored of you
  p -= inp.raises * 0.05;
  return Math.max(0.05, Math.min(0.85, p));
}

/** how big the cheque is if it lands */
export function pitchAmount(inp: {
  revenue: number;
  stageIndex: number;
}): number {
  const byStage = [2_000, 15_000, 60_000, 250_000, 750_000];
  const floor = byStage[Math.min(inp.stageIndex, byStage.length - 1)];
  // at least six months of revenue, or the stage floor, whichever is bigger
  return Math.max(floor, Math.round(inp.revenue * 6));
}

/* ── the month tick ────────────────────────────────────────── */

export interface HeroTickInput {
  users: number;
  cash: number;
  month: number;
  stageIndex: number;
  businessId: string;
  /** monthly infrastructure bill */
  cost: number;
  /** is a traffic source actually wired to something downstream? */
  serving: boolean;
  /** no component over capacity */
  healthy: boolean;
  /** free node purchases already banked */
  freebies: number;
}

export interface HeroTickResult {
  users: number;
  cash: number;
  month: number;
  revenue: number;
  net: number;
  grew: boolean;
  churned: boolean;
  stageIndex: number;
  stageChanged: boolean;
  grant: number;
  grantLabel: string;
  /** free node purchases banked after this month */
  freebies: number;
  /** free nodes handed over this month */
  granted: number;
  bankrupt: boolean;
}

export function heroTick(inp: HeroTickInput): HeroTickResult {
  const biz = businessById(inp.businessId);
  const revenue = inp.serving ? revenueFor(inp.users, biz.arpu) : 0;
  const net = revenue - inp.cost;
  let cash = inp.cash + net;
  let users = inp.users;
  let grew = false;
  let churned = false;

  if (!inp.serving) {
    // nothing is served: nobody new turns up and nobody pays you
  } else if (!inp.healthy) {
    // over capacity — users hit errors and walk
    users = Math.max(1, Math.round(users * (1 - 0.1)));
    churned = true;
  } else if (net >= 0) {
    users += Math.max(Math.round(users * biz.growth), GROWTH_FLOOR);
    grew = true;
  } else {
    // holding, but burning cash — word of mouth crawls
    users += Math.max(Math.round(users * BROKE_GROWTH), 5);
    grew = true;
  }

  const stageIndex = stageIndexFor(users);
  const stageChanged = stageIndex > inp.stageIndex;
  let grant = 0;
  let grantLabel = "";
  let granted = 0;
  if (stageChanged) {
    for (let i = inp.stageIndex + 1; i <= stageIndex; i++) {
      grant += HERO_STAGES[i].grant;
      granted += HERO_STAGES[i].grantNodes;
      if (HERO_STAGES[i].grantLabel) grantLabel = HERO_STAGES[i].grantLabel;
    }
    cash += grant;
  }

  return {
    users,
    cash,
    month: inp.month + 1,
    revenue,
    net,
    grew,
    churned,
    stageIndex,
    stageChanged,
    grant,
    grantLabel,
    freebies: inp.freebies + granted,
    granted,
    bankrupt: cash < BANKRUPT_AT,
  };
}
