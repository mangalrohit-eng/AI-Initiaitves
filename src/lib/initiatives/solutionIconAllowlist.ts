/**
 * Curated Lucide icon allowlist for AI Solution and Tower visuals.
 *
 * Two consumers share this single source of truth:
 *   1. Per-solution icons — `L3Initiative.iconKey`, picked by the curator
 *      LLM during `curateL3InitiativesLLM`. The prompt embeds this list
 *      with one-word usage hints so the model picks meaningfully.
 *   2. Per-tower motifs — `Tower.iconKey`, hand-set on each tower slice.
 *
 * Why curated (not "any Lucide icon"):
 *   - Bundle size — only icons in this list are imported.
 *   - Visual consistency — one allowed visual vocabulary across the app.
 *   - Validator safety — invalid / hallucinated keys fall back to a
 *     deterministic per-tower-domain bucket pick, then a final
 *     feasibility-based default (Rocket / Compass) — so legacy cache
 *     never renders as a wall of identical icons.
 *
 * The allowlist deliberately spans every Versant tower domain (Finance,
 * Editorial, Rights, HR, Ad Sales, Content Ops, Cybersecurity, Tech,
 * Marketing, Legal, Production, Programming, Service, Research/Analytics,
 * Corp Services, Operations/Tech) so no L3 Job Family is starved of
 * meaningful options.
 */
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  AlignJustify,
  Award,
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  Building2,
  Calculator,
  CalendarRange,
  Camera,
  Captions,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Cloud,
  Code2,
  Compass,
  Cpu,
  CreditCard,
  Database,
  DollarSign,
  Eye,
  FileSearch,
  FileText,
  Filter,
  Flag,
  Gauge,
  Gavel,
  GitBranch,
  GitMerge,
  Globe,
  GraduationCap,
  Handshake,
  Headphones,
  HeartPulse,
  Inbox,
  KeyRound,
  Languages,
  Layers,
  LineChart,
  Lock,
  Mail,
  Map as MapIcon,
  Megaphone,
  MessageSquare,
  Mic,
  MonitorPlay,
  Music2,
  Network,
  Newspaper,
  Package,
  PenTool,
  PieChart,
  PlayCircle,
  Radar,
  Receipt,
  Rocket,
  Scale,
  Scissors,
  ScrollText,
  Search,
  Send,
  Server,
  Settings,
  Share2,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Signpost,
  Sparkles,
  Star,
  Tag,
  Tags,
  Target,
  Telescope,
  Tv,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Vault,
  Video,
  Wallet,
  Wand2,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";

/**
 * One entry per allowed icon. `hint` is the one-word / short-phrase
 * usage cue embedded into the LLM prompt so the model picks meaningfully.
 */
export type SolutionIconEntry = {
  key: string;
  Icon: LucideIcon;
  /** Short usage hint shown to the LLM (and developers) — what this icon connotes. */
  hint: string;
};

/**
 * The curated allowlist. Order is stable so the LLM sees a consistent
 * prompt; new entries are appended, never reordered.
 */
export const SOLUTION_ICON_ALLOWLIST: ReadonlyArray<SolutionIconEntry> = [
  // ── Finance / Accounting ──────────────────────────────────────────────
  { key: "Wallet", Icon: Wallet, hint: "cash, treasury, payables" },
  { key: "Banknote", Icon: Banknote, hint: "cash, liquidity, payments" },
  { key: "Receipt", Icon: Receipt, hint: "invoices, receipts, expense" },
  { key: "Calculator", Icon: Calculator, hint: "calculation, accounting, modeling" },
  { key: "DollarSign", Icon: DollarSign, hint: "monetary, billing, pricing" },
  { key: "CreditCard", Icon: CreditCard, hint: "card, spend, transactions" },
  { key: "Vault", Icon: Vault, hint: "secure store, treasury, holdings" },
  { key: "GitMerge", Icon: GitMerge, hint: "reconciliation, merge, consolidation" },
  { key: "ScrollText", Icon: ScrollText, hint: "filings, narrative, statements" },
  // ── Analytics / Forecasting ───────────────────────────────────────────
  { key: "TrendingUp", Icon: TrendingUp, hint: "forecast, growth, pacing" },
  { key: "LineChart", Icon: LineChart, hint: "trends, metrics, time series" },
  { key: "BarChart3", Icon: BarChart3, hint: "reporting, KPIs, dashboards" },
  { key: "PieChart", Icon: PieChart, hint: "share, mix, segmentation" },
  { key: "Gauge", Icon: Gauge, hint: "performance, dial, monitor" },
  { key: "Activity", Icon: Activity, hint: "live signal, monitoring, anomaly" },
  // ── Editorial / News ──────────────────────────────────────────────────
  { key: "Newspaper", Icon: Newspaper, hint: "news, editorial, copy" },
  { key: "FileText", Icon: FileText, hint: "document, drafting, brief" },
  { key: "PenTool", Icon: PenTool, hint: "authoring, editing, copywriting" },
  { key: "BookOpen", Icon: BookOpen, hint: "standards, manual, reference" },
  { key: "Languages", Icon: Languages, hint: "translation, localization, multilingual" },
  { key: "MessageSquare", Icon: MessageSquare, hint: "conversation, social, comments" },
  // ── Production / Studio ───────────────────────────────────────────────
  { key: "Mic", Icon: Mic, hint: "anchor, voice, audio capture" },
  { key: "Video", Icon: Video, hint: "video production, recording" },
  { key: "Camera", Icon: Camera, hint: "shoots, capture, imagery" },
  { key: "PlayCircle", Icon: PlayCircle, hint: "playout, streaming, on-demand" },
  { key: "MonitorPlay", Icon: MonitorPlay, hint: "broadcast, channel, linear" },
  { key: "Tv", Icon: Tv, hint: "broadcast, programming, distribution" },
  { key: "Music2", Icon: Music2, hint: "audio, score, music rights" },
  { key: "Captions", Icon: Captions, hint: "subtitles, accessibility, transcript" },
  { key: "Scissors", Icon: Scissors, hint: "clipping, edit, trim" },
  // ── Content Ops / Metadata ────────────────────────────────────────────
  { key: "Tag", Icon: Tag, hint: "single tag, label, classification" },
  { key: "Tags", Icon: Tags, hint: "metadata, tagging, classification" },
  { key: "Layers", Icon: Layers, hint: "library, catalog, structure" },
  { key: "Package", Icon: Package, hint: "bundling, packaging, asset" },
  // ── Rights / Legal / Compliance ───────────────────────────────────────
  { key: "Scale", Icon: Scale, hint: "legal, balance, compliance" },
  { key: "Gavel", Icon: Gavel, hint: "legal review, ruling, contract" },
  { key: "ShieldCheck", Icon: ShieldCheck, hint: "compliance, control, standards" },
  { key: "ShieldAlert", Icon: ShieldAlert, hint: "risk, threat, alert" },
  { key: "FileSearch", Icon: FileSearch, hint: "discovery, audit, contract review" },
  { key: "Lock", Icon: Lock, hint: "secure, restricted, locked" },
  { key: "KeyRound", Icon: KeyRound, hint: "access, credentials, secrets" },
  // ── Sales / Ad Sales / Marketing ──────────────────────────────────────
  { key: "Target", Icon: Target, hint: "targeting, audience, campaign" },
  { key: "Megaphone", Icon: Megaphone, hint: "marketing, comms, broadcast announcement" },
  { key: "Send", Icon: Send, hint: "outbound, dispatch, send" },
  { key: "Inbox", Icon: Inbox, hint: "inbound, intake, leads" },
  { key: "Mail", Icon: Mail, hint: "email, communications, notification" },
  { key: "Bell", Icon: Bell, hint: "alert, notification, reminder" },
  { key: "Handshake", Icon: Handshake, hint: "deals, partnerships, agreement" },
  { key: "ShoppingBag", Icon: ShoppingBag, hint: "commerce, purchase, retail" },
  // ── HR / Talent ───────────────────────────────────────────────────────
  { key: "Users", Icon: Users, hint: "team, staff, workforce" },
  { key: "UserCheck", Icon: UserCheck, hint: "hire, validate, onboard" },
  { key: "UserPlus", Icon: UserPlus, hint: "sourcing, recruit, add member" },
  { key: "GraduationCap", Icon: GraduationCap, hint: "learning, training, development" },
  { key: "Award", Icon: Award, hint: "recognition, performance, awards" },
  { key: "Briefcase", Icon: Briefcase, hint: "role, job, career" },
  { key: "ClipboardCheck", Icon: ClipboardCheck, hint: "checklist, completion, verification" },
  { key: "ClipboardList", Icon: ClipboardList, hint: "tracking, status, list" },
  // ── Tech / Engineering / Platform ─────────────────────────────────────
  { key: "Server", Icon: Server, hint: "infrastructure, ops, hosting" },
  { key: "Database", Icon: Database, hint: "data, store, warehouse" },
  { key: "Cloud", Icon: Cloud, hint: "cloud, SaaS, distributed" },
  { key: "Cpu", Icon: Cpu, hint: "compute, processing, AI" },
  { key: "Code2", Icon: Code2, hint: "engineering, code, development" },
  { key: "Workflow", Icon: Workflow, hint: "orchestration, pipeline, agents" },
  { key: "GitBranch", Icon: GitBranch, hint: "versioning, branches, releases" },
  { key: "Network", Icon: Network, hint: "graph, routing, connections" },
  { key: "Settings", Icon: Settings, hint: "configuration, controls, admin" },
  { key: "Wrench", Icon: Wrench, hint: "maintenance, fix, tooling" },
  { key: "Bot", Icon: Bot, hint: "agent, bot, autonomous" },
  { key: "Wand2", Icon: Wand2, hint: "automation, magic, transformation" },
  { key: "Sparkles", Icon: Sparkles, hint: "AI, generative, smart" },
  { key: "Brain", Icon: Brain, hint: "intelligence, model, cognition" },
  { key: "Zap", Icon: Zap, hint: "fast, real-time, instant" },
  // ── Customer Service / Support ────────────────────────────────────────
  { key: "Headphones", Icon: Headphones, hint: "support, contact center, listen" },
  { key: "HeartPulse", Icon: HeartPulse, hint: "wellbeing, health, NPS" },
  // ── Cybersecurity ─────────────────────────────────────────────────────
  { key: "Radar", Icon: Radar, hint: "detection, scan, threat-hunting" },
  { key: "AlertTriangle", Icon: AlertTriangle, hint: "warning, escalation, severity" },
  { key: "Eye", Icon: Eye, hint: "monitoring, observability, visibility" },
  // ── Search / Discovery / Routing ──────────────────────────────────────
  { key: "Search", Icon: Search, hint: "search, lookup, discover" },
  { key: "Filter", Icon: Filter, hint: "filtering, triage, prioritize" },
  { key: "Telescope", Icon: Telescope, hint: "horizon, foresight, exploration" },
  { key: "Compass", Icon: Compass, hint: "exploration, direction, investigate" },
  { key: "Map", Icon: MapIcon, hint: "atlas, planning, geography" },
  { key: "Signpost", Icon: Signpost, hint: "routing, decision, direction" },
  { key: "Globe", Icon: Globe, hint: "global, international, worldwide" },
  { key: "Building2", Icon: Building2, hint: "enterprise, building, organization" },
  // ── Time / Cadence ────────────────────────────────────────────────────
  { key: "Clock", Icon: Clock, hint: "timing, cadence, scheduling" },
  { key: "CalendarRange", Icon: CalendarRange, hint: "calendar, schedule, windowing" },
  // ── Generic actions ───────────────────────────────────────────────────
  { key: "Share2", Icon: Share2, hint: "distribution, syndication, sharing" },
  { key: "Star", Icon: Star, hint: "highlight, premium, rating" },
  { key: "Flag", Icon: Flag, hint: "milestone, flag, escalation" },
  { key: "Rocket", Icon: Rocket, hint: "launch, ship-ready, momentum" },
  { key: "AlignJustify", Icon: AlignJustify, hint: "structured ops, alignment, layout" },
];

/**
 * Map for fast lookup: key -> entry. Keys are case-sensitive (PascalCase
 * matching the Lucide export name) so the validator and renderer agree
 * byte-for-byte on what the LLM returned.
 */
export const SOLUTION_ICON_BY_KEY: ReadonlyMap<string, SolutionIconEntry> =
  new Map(SOLUTION_ICON_ALLOWLIST.map((e) => [e.key, e]));

/** True when the key resolves to a real allow-listed icon. */
export function isAllowedIconKey(key: string | undefined | null): boolean {
  if (!key || typeof key !== "string") return false;
  return SOLUTION_ICON_BY_KEY.has(key);
}

/**
 * Per-tower-domain fallback icon buckets, keyed by the tower's own
 * `iconKey`. When an `L3Initiative` has no `iconKey` (legacy cache from
 * before the prompt change) we deterministically pick a domain-relevant
 * icon from the bucket using `hash(seed) % bucket.length`. This stops
 * the tower view from rendering a wall of identical fallback glyphs.
 *
 * Every bucket starts with the tower's motif icon so the visual family
 * is consistent with the hero / switcher tile.
 */
const TOWER_FALLBACK_BUCKETS: Record<string, ReadonlyArray<string>> = {
  Calculator: [
    "Calculator",
    "Receipt",
    "Banknote",
    "Wallet",
    "Vault",
    "GitMerge",
    "ScrollText",
  ],
  Newspaper: [
    "Newspaper",
    "FileText",
    "PenTool",
    "BookOpen",
    "Languages",
    "MessageSquare",
  ],
  Camera: [
    "Camera",
    "Video",
    "MonitorPlay",
    "Captions",
    "Scissors",
    "Music2",
    "Mic",
  ],
  Users: [
    "Users",
    "UserPlus",
    "UserCheck",
    "GraduationCap",
    "Award",
    "Briefcase",
  ],
  Scale: ["Scale", "Gavel", "FileSearch", "ShieldCheck", "Lock", "KeyRound"],
  Cpu: ["Cpu", "Server", "Database", "Cloud", "Code2", "Bot", "Brain"],
  Workflow: ["Workflow", "GitBranch", "Network", "Settings", "Wrench"],
  Target: ["Target", "Send", "Inbox", "Handshake", "Megaphone"],
  Megaphone: ["Megaphone", "Tag", "Tags", "Bell", "Mail", "Send"],
  Headphones: ["Headphones", "MessageSquare", "HeartPulse", "Bell"],
  BarChart3: [
    "BarChart3",
    "LineChart",
    "PieChart",
    "Telescope",
    "Search",
    "Activity",
  ],
  MonitorPlay: [
    "MonitorPlay",
    "Tv",
    "PlayCircle",
    "Layers",
    "Share2",
    "Package",
  ],
  Building2: [
    "Building2",
    "Briefcase",
    "AlignJustify",
    "Globe",
    "Settings",
  ],
  ShieldCheck: [
    "ShieldCheck",
    "ShieldAlert",
    "Radar",
    "Eye",
    "Lock",
    "AlertTriangle",
  ],
};

/**
 * Deterministic 32-bit string hash (djb2). Returns a non-negative
 * integer so callers can `% N` safely. Used to spread legacy
 * fallback icons across a tower's domain bucket.
 */
function hashSeed(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 33) ^ seed.charCodeAt(i);
  }
  return h >>> 0;
}

export type ResolveSolutionIconOptions = {
  /** Feasibility-tier ultimate fallback (Rocket / Compass). */
  feasibility?: "ship-ready" | "investigate";
  /** Tower motif iconKey — drives the domain fallback bucket. */
  towerIconKey?: string;
  /** Stable per-card seed (typically the L3Initiative.id). */
  seed?: string;
};

/**
 * Resolve an iconKey to its Lucide component.
 *
 * Resolution order:
 *   1. LLM-picked `key` if present and on the allowlist.
 *   2. Deterministic pick from the tower's domain bucket
 *      (`TOWER_FALLBACK_BUCKETS[towerIconKey]`) keyed by `hash(seed)`.
 *      Gives every solution in a tower a different but domain-relevant
 *      icon even when the cached initiative predates the prompt
 *      change.
 *   3. Feasibility-aware ultimate default (Rocket / Compass).
 *
 * The legacy two-arg signature (`resolveSolutionIcon(key, "ship-ready")`)
 * is preserved for back-compat with non-card consumers (TowerSwitcher,
 * TowerHeroV2). Callers who want per-card variety should pass the
 * `ResolveSolutionIconOptions` object form.
 */
export function resolveSolutionIcon(
  key: string | undefined | null,
  fallback?: "ship-ready" | "investigate" | ResolveSolutionIconOptions,
): LucideIcon {
  if (key && SOLUTION_ICON_BY_KEY.has(key)) {
    return SOLUTION_ICON_BY_KEY.get(key)!.Icon;
  }

  let feasibility: "ship-ready" | "investigate" = "investigate";
  let towerIconKey: string | undefined;
  let seed: string | undefined;

  if (typeof fallback === "string") {
    feasibility = fallback;
  } else if (fallback) {
    feasibility = fallback.feasibility ?? "investigate";
    towerIconKey = fallback.towerIconKey;
    seed = fallback.seed;
  }

  if (towerIconKey && seed) {
    const bucket = TOWER_FALLBACK_BUCKETS[towerIconKey];
    if (bucket && bucket.length > 0) {
      const pick = bucket[hashSeed(seed) % bucket.length];
      const entry = pick ? SOLUTION_ICON_BY_KEY.get(pick) : undefined;
      if (entry) return entry.Icon;
    }
  }

  return feasibility === "ship-ready" ? Rocket : Compass;
}

/**
 * Build the human-readable allowlist block embedded in the LLM prompt.
 * Lines look like: `Wallet — cash, treasury, payables`. Truncating to
 * a single string lets the prompt stay under token budgets even as the
 * list grows.
 */
export function buildIconAllowlistPromptBlock(): string {
  return SOLUTION_ICON_ALLOWLIST.map((e) => `${e.key} — ${e.hint}`).join("\n");
}

/**
 * Comma-separated key list — used in the prompt's "STRICT JSON" section
 * to make the constraint set surgical (the model echoes one of these
 * keys verbatim). Kept as a separate helper from the multiline block so
 * the prompt can place the list in two contexts without duplicating the
 * source.
 */
export function buildIconAllowlistKeyCsv(): string {
  return SOLUTION_ICON_ALLOWLIST.map((e) => e.key).join(", ");
}
