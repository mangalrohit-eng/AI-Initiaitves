// Hand-authored history of meaningful changes to the explorer.
// Consumed by both /changelog (human timeline) and /feed.xml (Atom feed).
// Sorted newest first at consumption time; keep entries concise.

export type ChangelogKind =
  | "release"
  | "tower"
  | "initiative"
  | "brief"
  | "fix";

export type ChangelogEntry = {
  id: string;
  // ISO date or datetime. Date-only entries are rendered as 00:00 UTC.
  date: string;
  kind: ChangelogKind;
  // Optional target identifier — tower slug, process id, brief id.
  targetId?: string;
  title: string;
  summary: string;
  // Deep link to the relevant surface. Use absolute paths (leading slash)
  // so both the in-app timeline and the RSS feed stay portable.
  href?: string;
};

export const changelog: ChangelogEntry[] = [
  {
    id: "illustrative-voice-2026-05-18",
    date: "2026-05-18",
    kind: "fix",
    title: "Illustrative voice: roles in, names out; vendors framed as anchors",
    summary:
      "Initiative cards, Tower Workbenches, the Orchestration Layer, briefs, the glossary, and the /ask responder now refer to Versant executives by role only — never by name — and frame every vendor mention as an illustrative anchor (`category (e.g., BlackLine, FloQast)`), not a committed pick. The exception is a new `committedVendors` field on the `Tower` type that lets a Versant intake form confirm a capability/vendor pair, at which point that specific pair renders definitively for that tower only. The prompt kit was rebuilt around `EXECUTIVE_ROLES` and `VENDOR_CATEGORY_CATALOG` so LLM-regenerated content carries the new voice forward. Existing LLM caches will refresh organically the next time a tower's initiatives are re-curated.",
    href: "/changelog#illustrative-voice-2026-05-18",
  },
  {
    id: "tower-workbench-launch",
    date: "2026-05-18",
    kind: "release",
    title: "Tower Workbenches + canonical Orchestration Layer",
    summary:
      "Step 4 now defaults to a per-tower Workbench tab — the custom-built, consolidated app behind which a tower's point-solution AI agents are stitched (one per tower, 14 in total). Each Workbench ships 4-8 surfaces in the tower's native vernacular (Finance: Close, Reconcile, Draft MD&A; Production: Cue, Browse archive, Package; Ad Sales: Pace, Yield, Score) and fuzzy-matches to the live AI Solutions catalog. The Cross-Tower Orchestration Layer tab now leads with a canonical hand-authored fabric: layered architecture diagram, 8 data architecture components (Identity Graph, Knowledge Graph, Content Lake, Event Bus, Vector Store, Financial Ledger Hub, Audit Log, Feature Store); 21 illustrative API integrations to vendor categories (e.g., BlackLine, Eightfold, Harvey, Amagi, Deepgram, Veritone, LiveRamp, Piano, Nielsen, CrowdStrike, ServiceNow); 8 cross-cutting AI agents; and 5 governance policies (SOX/SEC, FCC, editorial AI gate, PII/CCPA, AI model risk). The LLM-generated strategist narrative is retained as secondary commentary beneath the canonical artifact.",
    href: "/changelog#tower-workbench-launch",
  },
  {
    id: "p1-local-collab",
    date: "2026-04-22",
    kind: "release",
    title: "P1 — Local-first collaboration",
    summary:
      "Pin towers and initiatives to 'My program', add private notes, share annotated links, receive 'Updated since your last visit' cues, and subscribe to the program RSS feed. No backend, no account — everything stays on your device.",
    href: "/changelog#p1-local-collab",
  },
  {
    id: "p0-tower-lead-ux",
    date: "2026-04-22",
    kind: "release",
    title: "P0 — Tower-lead UX",
    summary:
      "Rewrote the homepage around 'how AI can help your tower', added a 60-second walkthrough, a searchable tower grid, a glossary with inline tooltips, narrative-first tower pages with a Top-3 opportunities strip, a business-case block on every initiative, and a share / print / PDF bar.",
    href: "/changelog#p0-tower-lead-ux",
  },
  {
    id: "p0-priority-palette",
    date: "2026-04-22",
    kind: "fix",
    title: "Retired red as a priority colour",
    summary:
      "P1 priority is now navy (#0F3460). Red is reserved for risk surfaces (mission-critical criticality) so priority no longer reads as alarm.",
  },
  {
    id: "briefs-launch",
    date: "2026-04-15",
    kind: "release",
    title: "102 AI process briefs added",
    summary:
      "Every P1 and P2 sub-process that doesn't warrant a full four-lens page now has a lightweight brief covering pre-state, post-state, agents, tools, roles impacted, and dependencies.",
  },
  {
    id: "operating-model",
    date: "2026-04-08",
    kind: "release",
    title: "Operating model + priority roadmap",
    summary:
      "Every tower ships with a categorised process landscape and a three-column AI roadmap (Immediate / Near-term / Medium-term).",
  },
  {
    id: "four-lens",
    date: "2026-04-01",
    kind: "release",
    title: "Four-lens initiative detail for all 47 processes",
    summary:
      "Each AI-eligible initiative now renders the full Work, Team, Tools & apps, and Platform lenses with named agents and an interactive orchestration diagram.",
  },
];
