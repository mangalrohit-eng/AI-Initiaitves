/**
 * Versant context pack — the static, public facts the LLM should always
 * be able to reach. Sourced from `.cursor/rules/versant-forge.mdc` and
 * `docs/context.md`. These are the public-10K narrative figures, not the
 * Accenture-modeled numbers — they are NOT redacted by ClientMode.
 *
 * Server-only: keep this off the client bundle so the brand/people list is
 * a single source of truth.
 */

export type VersantContext = {
  company: { name: string; ticker: string; ceo: string; cfo: string };
  brands: string[];
  /** Real Versant leaders the LLM may name without inventing. */
  people: { name: string; role: string }[];
  /** Public-10K narrative figures. Safe to quote regardless of ClientMode. */
  publicFinancials: { metric: string; value: string }[];
  /** Concrete vendor names that have appeared in real briefs. */
  knownVendors: string[];
};

export const VERSANT_CONTEXT: VersantContext = {
  company: {
    name: "Versant Media Group",
    ticker: "VSNT",
    ceo: "Mark Lazarus",
    cfo: "Anand Kini",
  },
  brands: [
    "MS NOW",
    "CNBC",
    "Golf Channel",
    "GolfNow",
    "GolfPass",
    "USA Network",
    "E!",
    "Syfy",
    "Oxygen True Crime",
    "Fandango",
    "Rotten Tomatoes",
    "SportsEngine",
    "Free TV Networks",
  ],
  people: [
    { name: "Mark Lazarus", role: "CEO" },
    { name: "Anand Kini", role: "CFO / COO" },
    { name: "Deep Bagchee", role: "Chief Product & Technology Officer, News" },
    { name: "Rebecca Kutler", role: "President, MS NOW" },
    { name: "KC Sullivan", role: "President, CNBC" },
    { name: "Brian Carovillano", role: "Editorial Standards" },
    { name: "Nate Balogh", role: "EVP / CIO" },
  ],
  publicFinancials: [
    { metric: "Revenue (FY)", value: "$6.69B" },
    { metric: "Distribution revenue", value: "$4.09B" },
    { metric: "Advertising revenue", value: "$1.58B" },
    { metric: "Platforms revenue", value: "$826M" },
    { metric: "Programming costs", value: "$2.45B" },
    { metric: "Adjusted EBITDA", value: "$2.43B" },
    { metric: "Debt outstanding", value: "$2.75B (BB-)" },
    { metric: "Cash on hand", value: "$1.09B" },
    { metric: "Quarterly dividend", value: "$0.375 / share" },
    { metric: "Buyback authorization", value: "$1B" },
  ],
  knownVendors: [
    "BlackLine",
    "Eightfold",
    "Descript",
    "Amagi",
    "Piano",
    "LiveRamp",
    "Deepgram",
    "CrowdStrike",
    "Abnormal Security",
    "Anthropic",
    "OpenAI",
    "Salesforce",
    "Workday",
    "ServiceNow",
  ],
};

/** Compact, prompt-friendly serialization. */
export function versantContextForPrompt(): string {
  const lines: string[] = [];
  lines.push(`Company: ${VERSANT_CONTEXT.company.name} (NASDAQ: ${VERSANT_CONTEXT.company.ticker})`);
  lines.push(`CEO: ${VERSANT_CONTEXT.company.ceo}, CFO/COO: ${VERSANT_CONTEXT.company.cfo}`);
  lines.push(`Brands: ${VERSANT_CONTEXT.brands.join(", ")}`);
  lines.push("Key people:");
  for (const p of VERSANT_CONTEXT.people) {
    lines.push(`  - ${p.name} (${p.role})`);
  }
  lines.push("Public financials (10-K narrative — safe to quote regardless of ClientMode):");
  for (const f of VERSANT_CONTEXT.publicFinancials) {
    lines.push(`  - ${f.metric}: ${f.value}`);
  }
  lines.push(`Known vendors (used in briefs): ${VERSANT_CONTEXT.knownVendors.join(", ")}`);
  return lines.join("\n");
}
