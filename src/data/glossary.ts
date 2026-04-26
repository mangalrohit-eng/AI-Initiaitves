/**
 * Glossary data — single source of truth for both:
 *   1. The full glossary page at `/glossary` (renders the array, grouped by category)
 *   2. The inline <Term /> tooltips used throughout the workshop
 *
 * Each entry has an `id` (URL anchor + stable key for tooltips), a category, a
 * term label, a one-liner (`short`), and an optional `long` description.
 *
 * `getGlossaryEntry()` is the case-insensitive lookup used by <Term />; it
 * matches against `id` and `term`.
 */

export type GlossaryCategory =
  | "Operating model"
  | "Agents & architecture"
  | "Prioritisation & delivery"
  | "People & change";

export type GlossaryEntry = {
  id: string;
  category: GlossaryCategory;
  term: string;
  short: string;
  long?: string;
};

export const glossary: GlossaryEntry[] = [
  // ---- Operating model -------------------------------------------------
  {
    id: "l2",
    category: "Operating model",
    term: "L2",
    short: "Tower sub-function. Roughly the area a director or VP runs.",
    long: "Level-2 capability. Below the tower (L1), above L3 sub-processes. Example for HR: 'Talent Acquisition'.",
  },
  {
    id: "l3",
    category: "Operating model",
    term: "L3",
    short: "Process within an L2. The unit a manager owns.",
    long: "Level-3 process. Sits inside an L2 sub-function. Example: 'Sourcing & Screening' inside 'Talent Acquisition'.",
  },
  {
    id: "l4",
    category: "Operating model",
    term: "L4",
    short: "Activity within a process. The level we score for offshore + AI.",
    long: "Level-4 activity. The lowest grain captured in the workshop, scored for offshore-movability and AI impact, with FTE / contractor headcount attached.",
  },
  {
    id: "capability-map",
    category: "Operating model",
    term: "Capability map",
    short: "The L1-L4 hierarchy that describes what a tower does.",
    long: "Capability maps are authored once per tower and serve as the canonical structure the workshop dials and AI initiatives are scored against.",
  },
  {
    id: "fte",
    category: "Operating model",
    term: "FTE",
    short: "Full-time equivalent — one person at standard hours.",
    long: "We track FTE separately from contractors so the headcount reflects Versant's actual hire mix.",
  },
  {
    id: "contractor",
    category: "Operating model",
    term: "Contractor",
    short: "Non-FTE labour — agency, vendor, or per-project staff.",
    long: "Tracked separately from FTE because contractor cost-to-serve and offshorability often differ.",
  },

  // ---- Prioritisation & delivery --------------------------------------
  {
    id: "offshore-dial",
    category: "Prioritisation & delivery",
    term: "Offshore dial",
    short: "0-100 share of an L4 activity that could plausibly move offshore.",
    long: "Captures the editorial / news / political-brand sensitivity of the work, the location requirement, and the complexity. Defaults seeded from heuristics; tower leads override per row.",
  },
  {
    id: "ai-impact-dial",
    category: "Prioritisation & delivery",
    term: "AI impact dial",
    short: "0-100 estimate of AI-driven automation or augmentation headroom for the L4.",
    long: "Combines task structuredness, data availability, and review burden. Defaults seeded from heuristics; tower leads override per row. Read alongside the AI Initiatives module for the agents that realise this headroom.",
  },
  {
    id: "modeled-value",
    category: "Prioritisation & delivery",
    term: "Modeled value",
    short: "Workshop estimate, illustrative only. Not Versant-reported.",
    long: "All $ figures in this portal are workshop modelling, not a system of record. They use the user-entered blended rates and the dials per L4. Use them to compare towers and prioritise, not to commit.",
  },
  {
    id: "baseline",
    category: "Prioritisation & delivery",
    term: "Baseline",
    short: "The tower-level offshore + AI starting point used in roll-ups.",
    long: "When an L4 has no specific dial, the tower baseline is used in weighted summaries so every tower contributes a number rather than a blank.",
  },
  {
    id: "scenario",
    category: "Prioritisation & delivery",
    term: "Scenario",
    short: "A stress-test of the baseline on the summary page.",
    long: "Scenarios let you push the dials beyond the workshop baseline (for executive what-ifs) without overwriting the per-L4 inputs.",
  },
  {
    id: "priority-tier",
    category: "Prioritisation & delivery",
    term: "Priority tier (P1 / P2 / P3)",
    short: "When an AI initiative is realistically in flight.",
    long: "P1 — Immediate (0-6 months) requires only existing data and lightweight integrations. P2 — Near-term (6-12 months) needs minor platform work. P3 — Medium-term (12-24 months) depends on data infrastructure or model maturity that isn't fully in place yet.",
  },
  {
    id: "impact-tier",
    category: "Prioritisation & delivery",
    term: "Impact tier",
    short: "Qualitative size of opportunity — High / Medium / Low.",
    long: "We use tiers, not point estimates. High = ≥ $20M annualised modelled impact for an initiative; ≥ $200M for a tower. Medium = $5-20M / $50-200M. Low = below those bands. Discovery refines specific numbers.",
  },

  // ---- Agents & architecture ------------------------------------------
  {
    id: "agent",
    category: "Agents & architecture",
    term: "Agent",
    short: "A persistent AI worker with a role, tools, and guardrails.",
    long: "Each agent has a defined role (Specialist / Monitor / Router / Executor / Orchestrator), the tools it can use, the guardrails on its actions, and the metric it's optimising. Agents in this portal are designed for human review on consequential outputs.",
  },
  {
    id: "orchestrator",
    category: "Agents & architecture",
    term: "Orchestrator",
    short: "The top-level agent that routes work to specialists.",
    long: "Reads the inbound request, decides which downstream agent or tool runs, and is the point where humans intervene if confidence is low.",
  },
  {
    id: "specialist",
    category: "Agents & architecture",
    term: "Specialist",
    short: "Domain-focused agent — owns a narrow, well-defined task.",
    long: "Examples: a Reconciliation specialist for finance close, a Captioning specialist for editorial. Specialists are the unit of swap-out as models improve.",
  },
  {
    id: "guardrail",
    category: "Agents & architecture",
    term: "Guardrail",
    short: "A rule the agent must satisfy before acting.",
    long: "Includes confidence thresholds, prohibited content categories, dollar limits, mandatory human review steps, and audit logging. Guardrails are how the platform stays safe at scale.",
  },

  // ---- People & change -------------------------------------------------
  {
    id: "persona",
    category: "People & change",
    term: "Persona",
    short: "Who you are in the workshop — Versant lead, Accenture lead, or executive.",
    long: "Determines the home-page CTA, default views, and which collaboration surfaces are available to you.",
  },
  {
    id: "tower-lead",
    category: "People & change",
    term: "Tower lead",
    short: "The person responsible for a tower's content and dials.",
    long: "Tower leads upload the L1-L4 capability map and headcount, set offshore + AI dials, and sign the tower off as reviewed when it is ready for the rollup.",
  },
  {
    id: "tsa",
    category: "People & change",
    term: "TSA",
    short: "Transition Services Agreement with NBCUniversal.",
    long: "Versant runs on NBCU shared services until the TSA expires; many of the new initiatives in this portal are about preparing for that transition (ad sales, finance close, IT, security).",
  },
];

// ---------- Inline-tooltip lookup ---------------------------------------

const ENTRY_BY_KEY = (() => {
  const map: Record<string, GlossaryEntry> = {};
  for (const e of glossary) {
    map[e.id.toLowerCase()] = e;
    map[e.term.toLowerCase()] = e;
  }
  return map;
})();

export function getGlossaryEntry(term: string): GlossaryEntry | null {
  if (!term) return null;
  return ENTRY_BY_KEY[term.trim().toLowerCase()] ?? null;
}

export function listGlossaryEntries(): GlossaryEntry[] {
  return [...glossary];
}

/**
 * Legacy alias used by `<TermTip />`. Prefer `getGlossaryEntry()`.
 */
export const findTerm = getGlossaryEntry;
