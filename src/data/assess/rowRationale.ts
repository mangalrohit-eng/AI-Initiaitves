import type { L3WorkforceRow, TowerId } from "./types";

/**
 * Generates a 1 to 2 line rationale for the offshore% / AI% starter default
 * applied to a single L3 row.
 *
 * The rules below mirror `seedAssessmentDefaults.ts` — when the seed bumps a
 * row up or down on offshore or AI, the rationale here should explain why so a
 * tower lead trusts the dial without having to crack open the heuristic file.
 *
 * Output is short, declarative, and Versant-aware (NBCU TSA expiration, BB-
 * credit, on-air talent, multi-entity JV close, political brand sensitivity).
 */
export type RowRationale = {
  offshore: string;
  ai: string;
};

const TOWER_NOTES: Record<TowerId, RowRationale> = {
  finance: {
    offshore:
      "Multi-entity JV close (7+ Versant entities) means routine close work is offshore-ready; treasury / covenant / SEC reporting stay onshore.",
    ai:
      "Reconciliation, AP, FP&A forecasting are well-suited to agent-led automation against BlackLine and the GL. Editorial-style judgment stays with the team.",
  },
  hr: {
    offshore:
      "Versant inherits standard HR processing volumes from NBCU. Benefits / case admin and people analytics offshore well; talent strategy and on-air negotiation stay onshore.",
    ai:
      "Eightfold-style talent matching, leave administration, and case triage convert quickly to agents. Executive comp / on-air talent stays human.",
  },
  "research-analytics": {
    offshore:
      "Data prep and dashboarding offshore well; political / news ratings interpretation stays close to the editorial calendar.",
    ai:
      "Forecasting, segmentation, and ratings analytics are strong AI candidates. Strategic insight narratives still need senior hands.",
  },
  legal: {
    offshore:
      "Document review and contract first-pass move offshore; outside counsel coordination, regulatory work, and political-brand counsel stay onshore.",
    ai:
      "Contract review, NDA generation, and litigation discovery are AI-ready. Disclosure / 10-K and crisis counsel need senior judgment.",
  },
  "corp-services": {
    offshore:
      "Procurement processing and category management offshore; facilities, real estate, and exec services stay onshore.",
    ai:
      "Spend analysis, vendor onboarding, and PO triage are AI-friendly. Real estate and physical security remain operational and human.",
  },
  "tech-engineering": {
    offshore:
      "Engineering build, QA, and infra ops are well-established offshore patterns. Architecture and editorial-system stewardship stay close to the product.",
    ai:
      "Code generation, QA, and observability are AI-leveraged. Architecture, security incident response, and political-brand systems remain senior-led.",
  },
  "operations-technology": {
    offshore:
      "Live broadcast, live production, and on-air ops stay onshore. Asset management, MAM, and back-office ops can move.",
    ai:
      "Transcription, captioning, and metadata are quick wins. Live ops and on-camera workflows need human judgment.",
  },
  sales: {
    offshore:
      "Direct-to-advertiser ad sales is a relationship game post NBCU TSA. Sales ops and pipeline hygiene offshore; carriage / agency relationships stay onshore.",
    ai:
      "Lead scoring, pipeline analytics, and forecast cleanup convert to agents. Negotiation and key-account work stays human.",
  },
  "marketing-comms": {
    offshore:
      "Campaign ops, asset production, and listings can offshore. Brand strategy across MS NOW / CNBC / Golf / Free TV stays onshore.",
    ai:
      "Personalisation, segmentation, and content tagging are strong AI plays. Creative direction and crisis comms stay human.",
  },
  service: {
    offshore:
      "Versant inherits NBCU's helpdesk / shared services patterns. Tier-1 support and back-office ops offshore well.",
    ai:
      "Chatbot triage, ticket categorisation, and first-line responses are agent-ready. Escalations stay human.",
  },
  "editorial-news": {
    offshore:
      "MS NOW and CNBC keep editorial decisions, anchoring, and reporting in-house. Only post-production utility work moves.",
    ai:
      "AI assists with research, transcription, and fact-check support. Editorial standards, story selection, and political brand judgment stay with the team.",
  },
  production: {
    offshore:
      "Live production, studio, and on-camera work stay onshore. Post-production utility tasks can move.",
    ai:
      "Captioning, metadata, transcription, and asset tagging are strong AI candidates. Set, wardrobe, and on-camera direction stay human.",
  },
  "programming-dev": {
    offshore:
      "Sports rights ops and back-office programming admin can offshore. Programming strategy and live-event decisions stay onshore.",
    ai:
      "Rights metadata, match-up analytics, and programming forecasts convert to agents. Talent and sports-rights deal-making stay human.",
  },
};

const KEYWORD_NOTES: Array<{
  keywords: string[];
  offshore?: string;
  ai?: string;
}> = [
  {
    keywords: ["editorial", "journalism", "anchor", "reporter", "fact-check", "fact check", "news judgment"],
    offshore: "Editorial judgment is the brand. Stays onshore on MS NOW / CNBC / E! desks.",
    ai: "AI supports research and transcription only — editorial standards stay with the team.",
  },
  {
    keywords: ["live broadcast", "live production", "on-air", "on-camera", "host", "talent management"],
    offshore: "Live ops and talent need to be in-room. Stays onshore.",
    ai: "Live timing and on-camera direction stay human; AI supports the prep.",
  },
  {
    keywords: ["reconciliation", "intercompany", "reconcile"],
    offshore: "Multi-entity JV reconciliation is high-volume, codified — strong offshore + agent fit.",
    ai: "Reconciliation Agent matches transactions across 7+ Versant entities, auto-resolves timing diffs.",
  },
  {
    keywords: ["accounts payable", "invoice processing", "invoice approval"],
    offshore: "AP processing is a textbook offshore lever once BlackLine and the GL are settled.",
    ai: "85%+ straight-through invoice processing is the named target with agent extraction + matching.",
  },
  {
    keywords: ["payroll"],
    offshore: "Payroll runs offshore in most NBCU shared-services models — Versant follows.",
    ai: "Payroll exception triage is the AI lever; on-air comp stays manual.",
  },
  {
    keywords: ["helpdesk", "service desk", "tier 1", "l1 support", "first line support"],
    offshore: "Tier-1 helpdesk is a standard offshore pattern.",
    ai: "Chatbot triage takes the routine ticket volume; humans handle escalations.",
  },
  {
    keywords: ["transcrib", "captioning", "metadata"],
    offshore: "Transcription / metadata are AI-first; the human residual is small.",
    ai: "Deepgram + agent metadata pipelines are direct hits here.",
  },
  {
    keywords: ["negotiat", "deal making", "key account", "carriage"],
    offshore: "Negotiation and key accounts are relationship-driven. Stays onshore.",
    ai: "AI supports prep and pipeline hygiene; the conversation stays human.",
  },
  {
    keywords: ["regulator", "regulatory", "10-k", "10-q", "disclosure", "securities filing", "lobby", "political"],
    offshore: "New-public-company SEC and political-brand work stays close to leadership.",
    ai: "Compliance support is AI-assisted; the disclosure decision stays senior.",
  },
];

const FALLBACK: RowRationale = {
  offshore:
    "Starter blended from the tower prior plus L3 keyword cues (complexity, US requirement, AI feasibility).",
  ai: "Starter blended from the tower prior plus L3 keyword cues for AI fit.",
};

/**
 * Returns offshore + AI starter rationale for a row. The keyword rules apply
 * additively: if a row matches multiple, the most specific override wins for
 * each lever (last match in the array). Falls back to the tower-level note.
 */
export function rowStarterRationale(towerId: TowerId, row: L3WorkforceRow): RowRationale {
  const towerNote = TOWER_NOTES[towerId] ?? FALLBACK;
  const text = `${row.l2} ${row.l3}`.toLowerCase();
  let offshore = towerNote.offshore;
  let ai = towerNote.ai;
  for (const rule of KEYWORD_NOTES) {
    if (rule.keywords.some((k) => text.includes(k))) {
      if (rule.offshore) offshore = rule.offshore;
      if (rule.ai) ai = rule.ai;
    }
  }
  return { offshore, ai };
}
