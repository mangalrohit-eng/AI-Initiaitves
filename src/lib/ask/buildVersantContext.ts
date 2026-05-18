/**
 * Versant context pack — the static, public facts the LLM should always
 * be able to reach. Sourced from `.cursor/rules/versant-forge.mdc` and
 * `docs/context.md`. These are the public-10K narrative figures, not the
 * Accenture-modeled numbers — they are NOT redacted by ClientMode.
 *
 * Server-only: keep this off the client bundle so the brand / role
 * catalog / vendor catalog is a single source of truth.
 *
 * Voice contract (per `.cursor/rules/versant-forge.mdc`):
 *   - PEOPLE are referenced by role in any user-visible output. The
 *     `people` field below keeps the name → role mapping as raw
 *     reference data so /ask can recognize a user-typed name in a
 *     question (e.g., "what does Anand own?"), but the system prompt
 *     emitted by `versantContextForPrompt` renders ROLE ONLY — names
 *     never leak into the model's grounding block. The recognition
 *     mapping is exposed by `nameToRoleLookup()` for callers that need
 *     to translate a user-typed name into the role string.
 *   - VENDORS are illustrative. `knownVendors` is now a category catalog
 *     so the prompt frames every vendor mention as
 *     `category (e.g., Anchor1, Anchor2)`.
 */

export type VersantContext = {
  company: { name: string; ticker: string; ceoRole: string; cfoRole: string };
  brands: string[];
  /**
   * Raw name → role mapping. Used only for recognising user-typed names
   * in /ask queries. NEVER serialised into the LLM system prompt.
   */
  people: { name: string; role: string }[];
  /** Public-10K narrative figures. Safe to quote regardless of ClientMode. */
  publicFinancials: { metric: string; value: string }[];
  /**
   * Vendor catalog grouped by capability category. Every vendor mention
   * in output is framed as illustrative ("e.g., …") by the voice rules.
   */
  knownVendors: { category: string; anchors: string[] }[];
};

export const VERSANT_CONTEXT: VersantContext = {
  company: {
    name: "Versant Media Group",
    ticker: "VSNT",
    ceoRole: "CEO",
    cfoRole: "CFO and COO",
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
    { name: "Anand Kini", role: "CFO and COO" },
    { name: "Deep Bagchee", role: "CPTO News" },
    { name: "Rebecca Kutler", role: "President MS NOW" },
    { name: "KC Sullivan", role: "President CNBC" },
    { name: "Matthew Hong", role: "President Sports" },
    { name: "Brian Carovillano", role: "SVP Standards and Editorial" },
    { name: "Nate Balogh", role: "CIO" },
    { name: "Caroline Richardson", role: "CISO" },
    { name: "Frank Tanki", role: "CMO Entertainment and Sports" },
    { name: "Tom Clendenin", role: "CMO CNBC and MS NOW" },
    { name: "David Novak", role: "Board Chair" },
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
    { category: "Finance / close / treasury", anchors: ["BlackLine", "FloQast", "Workiva", "Trintech"] },
    { category: "HR / people", anchors: ["Workday HCM", "Eightfold", "Greenhouse"] },
    { category: "Content / editorial", anchors: ["Descript", "Veritone", "Deepgram"] },
    { category: "Broadcast / playout / distribution", anchors: ["Amagi", "Akamai", "AWS Elemental"] },
    { category: "Ad sales / monetization / DTC", anchors: ["FreeWheel", "Operative", "LiveRamp", "Piano"] },
    { category: "Legal / compliance / contracts", anchors: ["Ironclad", "Evisort", "Harvey", "DocuSign"] },
    { category: "IT / cybersecurity / developer platform", anchors: ["Microsoft 365", "Okta", "ServiceNow", "CrowdStrike", "Abnormal Security"] },
    { category: "Cloud / hyperscaler AI", anchors: ["AWS", "Azure", "Google Cloud", "AWS Bedrock"] },
    { category: "CRM / service", anchors: ["Salesforce", "ServiceNow"] },
    { category: "Foundation model APIs", anchors: ["Anthropic", "OpenAI"] },
  ],
};

/**
 * Returns a Map keyed by lower-cased Versant executive name → role
 * string. Used by /ask grounding to recognise user-typed names and
 * translate them to role-only references before the LLM ever sees the
 * conversation tail.
 */
export function nameToRoleLookup(): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of VERSANT_CONTEXT.people) {
    m.set(p.name.toLowerCase(), p.role);
  }
  return m;
}

/**
 * Compact, prompt-friendly serialization. Roles only — names never
 * leak into the LLM system prompt. Vendor catalog is rendered with
 * explicit illustrative framing.
 */
export function versantContextForPrompt(): string {
  const lines: string[] = [];
  lines.push(`Company: ${VERSANT_CONTEXT.company.name} (NASDAQ: ${VERSANT_CONTEXT.company.ticker})`);
  lines.push(`Top roles: ${VERSANT_CONTEXT.company.ceoRole}, ${VERSANT_CONTEXT.company.cfoRole}`);
  lines.push(`Brands: ${VERSANT_CONTEXT.brands.join(", ")}`);
  lines.push("Executive roles (refer to leadership by ROLE ONLY — names are deliberately suppressed):");
  const uniqueRoles = Array.from(new Set(VERSANT_CONTEXT.people.map((p) => p.role)));
  for (const role of uniqueRoles) {
    lines.push(`  - ${role}`);
  }
  lines.push("Public financials (10-K narrative — safe to quote regardless of ClientMode):");
  for (const f of VERSANT_CONTEXT.publicFinancials) {
    lines.push(`  - ${f.metric}: ${f.value}`);
  }
  lines.push("Vendor catalog (ILLUSTRATIVE — phrase every vendor mention as 'category (e.g., Anchor1, Anchor2)'. Bare vendor names are forbidden in output):");
  for (const v of VERSANT_CONTEXT.knownVendors) {
    lines.push(`  - ${v.category}: e.g., ${v.anchors.join(", ")}`);
  }
  return lines.join("\n");
}
