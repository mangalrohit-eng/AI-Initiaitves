/**
 * Curated starter prompts shown when the conversation is empty. Categorized
 * so the empty state reads as a guided tour, not a search box.
 *
 * Phrasing matters — these are the first thing the executive sees. Every
 * question is concrete, named (MS NOW / CNBC / P1), and answerable from the
 * grounded context.
 */

export type StarterCategory =
  | "headcount"
  | "offshoring"
  | "savings"
  | "initiatives"
  | "brands";

export type StarterQuestion = {
  category: StarterCategory;
  prompt: string;
  /** True when the question depends on workshop quantitative data. */
  needsWorkshop: boolean;
};

export const STARTER_QUESTIONS: StarterQuestion[] = [
  // ---------- Headcount ----------
  { category: "headcount", prompt: "Which tower has the most FTEs?", needsWorkshop: true },
  { category: "headcount", prompt: "What's the total program FTE?", needsWorkshop: true },
  { category: "headcount", prompt: "Top 5 L3 Job Families by headcount", needsWorkshop: true },
  { category: "headcount", prompt: "Onshore vs offshore split, by tower", needsWorkshop: true },

  // ---------- Offshoring ----------
  { category: "offshoring", prompt: "What L4 is most outsourced today?", needsWorkshop: true },
  { category: "offshoring", prompt: "Which towers have the most aggressive offshore plans?", needsWorkshop: true },
  { category: "offshoring", prompt: "Top 10 L4 rows by offshore plan percentage", needsWorkshop: true },
  { category: "offshoring", prompt: "Where are the biggest deltas between current and planned offshore?", needsWorkshop: true },

  // ---------- Savings ----------
  { category: "savings", prompt: "Where are the highest modeled savings?", needsWorkshop: true },
  { category: "savings", prompt: "Compare modeled offshore vs AI savings, by tower", needsWorkshop: true },
  { category: "savings", prompt: "Top 10 L4 rows by total modeled saving", needsWorkshop: true },
  { category: "savings", prompt: "Which tower has the largest AI dial uplift?", needsWorkshop: true },

  // ---------- Initiatives ----------
  { category: "initiatives", prompt: "Which P1 AI initiatives target Editorial & News?", needsWorkshop: false },
  { category: "initiatives", prompt: "List every P1 initiative across the program", needsWorkshop: false },
  { category: "initiatives", prompt: "Top vendors mentioned across briefs", needsWorkshop: false },
  { category: "initiatives", prompt: "Which agents appear in the most initiatives?", needsWorkshop: false },

  // ---------- Brands ----------
  { category: "brands", prompt: "Where does MS NOW appear in the corpus?", needsWorkshop: false },
  { category: "brands", prompt: "Which initiatives mention CNBC?", needsWorkshop: false },
  { category: "brands", prompt: "Brand exposure across the AI initiative pipeline", needsWorkshop: false },
  { category: "brands", prompt: "Show key roles and headcount notes for MS NOW", needsWorkshop: false },
];

export const STARTER_CATEGORY_META: Record<
  StarterCategory,
  { title: string; subtitle: string; iconId: string }
> = {
  headcount: {
    title: "Headcount",
    subtitle: "Who works where",
    iconId: "users",
  },
  offshoring: {
    title: "Offshoring",
    subtitle: "Plans and deltas",
    iconId: "globe-2",
  },
  savings: {
    title: "Savings",
    subtitle: "Modeled financial impact",
    iconId: "trending-down",
  },
  initiatives: {
    title: "Initiatives",
    subtitle: "P1/P2 AI agendas",
    iconId: "sparkles",
  },
  brands: {
    title: "Brands",
    subtitle: "MS NOW · CNBC · Golf · USA · E! · Syfy",
    iconId: "building-2",
  },
};

export const STARTER_CATEGORY_ORDER: StarterCategory[] = [
  "headcount",
  "offshoring",
  "savings",
  "initiatives",
  "brands",
];
