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
