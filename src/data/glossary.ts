export type GlossaryCategory =
  | "Agents & architecture"
  | "Operating model"
  | "Prioritisation & delivery"
  | "People & change";

export type GlossaryTerm = {
  id: string;
  term: string;
  short: string; // one-line definition for tooltips
  long?: string; // optional longer definition for the glossary page
  category: GlossaryCategory;
  aliases?: string[]; // alternate labels that should resolve to this term
};

export const glossary: GlossaryTerm[] = [
  {
    id: "agentic-ai",
    term: "Agentic AI",
    short:
      "AI that acts on your behalf — takes inputs, uses tools, makes decisions, and produces outcomes with human oversight.",
    long: "Agentic AI systems combine large language models with tools, memory, and a controlled set of actions. Instead of only answering a question, they can plan steps, call systems, and produce outcomes (e.g. generating a draft, reconciling accounts, triaging a ticket) — always within the boundaries and approvals you define.",
    category: "Agents & architecture",
  },
  {
    id: "orchestrator",
    term: "Orchestrator",
    short:
      "The lead agent that coordinates the others — decides who does what, in what order, and handles exceptions.",
    category: "Agents & architecture",
  },
  {
    id: "specialist",
    term: "Specialist",
    short:
      "An agent focused on one skill (e.g. drafting, extracting data, summarising) and called by the orchestrator.",
    category: "Agents & architecture",
  },
  {
    id: "monitor",
    term: "Monitor",
    short:
      "An agent that watches for signals or exceptions and alerts humans or other agents when thresholds are crossed.",
    category: "Agents & architecture",
  },
  {
    id: "router",
    term: "Router",
    short:
      "An agent that classifies an incoming item and hands it to the right downstream specialist.",
    category: "Agents & architecture",
  },
  {
    id: "executor",
    term: "Executor",
    short:
      "An agent that performs the actual action in a system (e.g. creates the ticket, posts the journal entry).",
    category: "Agents & architecture",
  },
  {
    id: "llm",
    term: "LLM",
    short:
      "Large Language Model — the reasoning engine behind agents that handle language-heavy work.",
    category: "Agents & architecture",
  },
  {
    id: "orchestration-pattern",
    term: "Orchestration pattern",
    short:
      "How the agents are wired together — pipeline, parallel, sequential, hierarchical, or hub-and-spoke.",
    long: "A pipeline runs steps in order, each feeding the next. Parallel runs steps simultaneously. Sequential is like a pipeline but without data transformation between stages. Hierarchical has a lead agent delegating to sub-agents. Hub-and-spoke has a central router dispatching to many specialists.",
    category: "Agents & architecture",
  },
  {
    id: "pipeline",
    term: "Pipeline",
    short: "Steps run one after another, each feeding the next — good for linear processes.",
    category: "Agents & architecture",
  },
  {
    id: "hub-and-spoke",
    term: "Hub-and-Spoke",
    short:
      "A central agent routes work to many specialists — good when inputs vary widely.",
    category: "Agents & architecture",
  },
  {
    id: "hierarchical",
    term: "Hierarchical",
    short: "A lead agent breaks work into sub-tasks and delegates to specialists.",
    category: "Agents & architecture",
  },
  {
    id: "parallel",
    term: "Parallel",
    short: "Multiple agents work on sub-tasks at the same time; results are merged at the end.",
    category: "Agents & architecture",
  },
  {
    id: "sequential",
    term: "Sequential",
    short: "Agents execute in a fixed order, one after another, without forking.",
    category: "Agents & architecture",
  },
  {
    id: "work-lens",
    term: "Work lens",
    short:
      "How the work itself changes — the steps, handoffs, cycle times, and error rates before and after AI.",
    category: "Operating model",
    aliases: ["Work"],
  },
  {
    id: "workforce-lens",
    term: "Workforce lens",
    short:
      "How the team changes — roles, headcount, time allocation, and skills before and after AI.",
    category: "Operating model",
    aliases: ["Workforce"],
  },
  {
    id: "workbench-lens",
    term: "Workbench",
    short:
      "The tools and applications people and agents use to do the work.",
    category: "Operating model",
  },
  {
    id: "digital-core",
    term: "Digital core",
    short:
      "The underlying platforms, data, and integrations that agentic AI depends on.",
    long: "Typically includes a governed data layer, an LLM gateway, a vector store, identity and access controls, and connectors to the systems where agents read and write.",
    category: "Operating model",
  },
  {
    id: "ai-eligible",
    term: "AI-eligible",
    short:
      "A process where AI can meaningfully take on work — the rest are deliberately human-led.",
    category: "Operating model",
  },
  {
    id: "criticality",
    term: "Criticality",
    short:
      "How mission-critical the process is (Mission-critical, High, Medium, Low) — affects risk tolerance and governance.",
    category: "Operating model",
  },
  {
    id: "maturity",
    term: "Maturity",
    short:
      "How automated the process is today (Manual, Semi-automated, Automated, Not yet established).",
    category: "Operating model",
  },
  {
    id: "priority-tiers",
    term: "P1 / P2 / P3",
    short:
      "Priority tiers for when the initiative lands: P1 in 0–6 months, P2 in 6–12, P3 in 12–24.",
    category: "Prioritisation & delivery",
  },
  {
    id: "modeled",
    term: "Modeled",
    short:
      "A number derived from benchmarks and analogs — to be validated with the tower lead before commitment.",
    category: "Prioritisation & delivery",
  },
  {
    id: "validated",
    term: "Validated",
    short:
      "A number confirmed with the tower lead and/or piloted — higher confidence.",
    category: "Prioritisation & delivery",
  },
  {
    id: "fte",
    term: "FTE",
    short:
      "Full-Time Equivalent — one person working full-time, used to quantify workforce impact.",
    category: "People & change",
  },
  {
    id: "human-in-the-loop",
    term: "Human-in-the-loop",
    short:
      "A workflow where an agent proposes, drafts, or flags — but a person approves before action.",
    category: "People & change",
  },
];

export const glossaryById = new Map(glossary.map((t) => [t.id, t] as const));

const aliasMap = new Map<string, GlossaryTerm>();
for (const t of glossary) {
  aliasMap.set(t.term.toLowerCase(), t);
  for (const alias of t.aliases ?? []) aliasMap.set(alias.toLowerCase(), t);
}

export function findTerm(key: string): GlossaryTerm | undefined {
  return aliasMap.get(key.toLowerCase()) ?? glossaryById.get(key);
}
