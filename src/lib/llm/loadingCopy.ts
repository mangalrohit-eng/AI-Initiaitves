/**
 * Versant LLM loading copy — single source of truth for the user-facing
 * "this may take a moment" messages.
 *
 * Why centralize. Every Step has at least one button that fires an LLM
 * call (Step 1 generate L5 / re-score, Step 2 dial inference, Step 4
 * curation, Step 5 brief authoring, Cross-Tower plan, Ask Forge). Each
 * caller used to ship its own ad-hoc spinner copy with no time hint —
 * users would see "Generating…" for 30-90 seconds and reasonably assume
 * the app had hung. This module defines the shared time-window phrasing
 * so every banner / toast / drawer reads the same tempo.
 *
 * Each call shape gets its own typical-window estimate, calibrated from
 * empirical runs against gpt-5.5 + Responses API + reasoning="medium":
 *   - dial inference (Step 2):     1 batched call → 20-60s
 *   - L5 generation  (Step 1):     1 batched call → 20-60s
 *   - curation       (Step 4):     1 streamed call per L4, fan-out 6 →
 *                                  20-90s total for a typical tower
 *   - brief authoring (Step 5):    1 call per leaf → 20-90s per brief
 *   - cross-tower plan:            1 call per cohort + 1 synthesis →
 *                                  60-180s for a full program
 *   - ask:                         1 call per turn → 10-60s
 *
 * Copy rules — must match the design system:
 *   - Declarative voice ("This is calling the model" — not "May we please…").
 *   - State the time window numerically; users can plan around 20-60s.
 *   - Anti-anxiety phrase: "Don't refresh — your work is saved."
 *   - Never hedge ("could potentially") — see versantPromptKit.HEDGE_PHRASES.
 */

export type LLMCallShape =
  /** One batched LLM call for offshore + AI dial inference (Step 2). */
  | "infer-defaults"
  /** One batched LLM call for L5 Activity name generation (Step 1). */
  | "generate-l5"
  /** Per-L4 streamed fan-out for AI initiative curation (Step 4). */
  | "curate-initiatives"
  /** Single deep brief authoring call (Step 5 / Tower brief page). */
  | "curate-brief"
  /** Per-cohort + synthesis chain for the cross-tower AI plan. */
  | "cross-tower-plan"
  /** Single Ask Forge turn. */
  | "ask";

export type LLMLoadingCopy = {
  /** Short title for buttons / banners ("Scoring…", "Authoring…"). */
  buttonShort: string;
  /** One-line headline for toast `loadingTitle` and banner descriptions. */
  toastTitle: string;
  /** Two-sentence body — names the time window and the don't-refresh rule. */
  description: string;
  /** Quick numeric time window string for inline pills ("20-60s", "30-90s"). */
  timeWindow: string;
};

const LOADING_COPY: Record<LLMCallShape, LLMLoadingCopy> = {
  "infer-defaults": {
    buttonShort: "Scoring...",
    toastTitle: "Scoring offshore + AI dials with the Versant model",
    description:
      "Calls the Versant-grounded model once for the whole tower. Typically 20-60 seconds — don't refresh, your inputs are saved.",
    timeWindow: "20-60s",
  },
  "generate-l5": {
    buttonShort: "Generating...",
    toastTitle: "Generating L5 Activities with the Versant model",
    description:
      "Calls the Versant-grounded model once for the whole tower. Typically 20-60 seconds — don't refresh, your map is saved.",
    timeWindow: "20-60s",
  },
  "curate-initiatives": {
    buttonShort: "Refreshing...",
    toastTitle: "Curating AI initiatives with the Versant model",
    description:
      "Calls the model once per Activity Group (six in parallel) and streams results as each row lands. Typically 30-90 seconds for a full tower — rows fill in as they finish; don't refresh.",
    timeWindow: "30-90s",
  },
  "curate-brief": {
    buttonShort: "Authoring...",
    toastTitle: "Authoring the four-lens brief with the Versant model",
    description:
      "Calls the model with reasoning to draft Work, Workforce, Workbench, and Digital Core in one pass. Typically 20-90 seconds — your tab can stay open; results are saved to the workshop when complete.",
    timeWindow: "20-90s",
  },
  "cross-tower-plan": {
    buttonShort: "Authoring...",
    toastTitle: "Authoring the Cross-Tower AI plan with the Versant model",
    description:
      "One model call per cohort (six in parallel), then one program synthesis call. Typically 60-180 seconds for a full Versant program — don't refresh, the plan persists when complete.",
    timeWindow: "60-180s",
  },
  ask: {
    buttonShort: "Thinking...",
    toastTitle: "Asking the Versant model",
    description:
      "Calls the model with the full Versant context. Typically 10-60 seconds — heavier reasoning answers may need the full minute.",
    timeWindow: "10-60s",
  },
};

/** Returns the loading copy for a given LLM call shape. */
export function llmLoadingCopy(shape: LLMCallShape): LLMLoadingCopy {
  return LOADING_COPY[shape];
}

/**
 * Helper for the curation banner — formats a "scored X of Y" progress
 * string with a fallback to the static description while the count is
 * still zero.
 */
export function curationProgressLine(scored: number, total: number): string {
  if (total === 0) return llmLoadingCopy("curate-initiatives").description;
  if (scored === 0) {
    return `Calling the Versant model for ${total} Activity Group${total === 1 ? "" : "s"}. Rows fill in as each finishes — don't refresh.`;
  }
  if (scored < total) {
    return `Scored ${scored} of ${total} Activity Group${total === 1 ? "" : "s"} so far. Rows fill in as each finishes — don't refresh.`;
  }
  return `Scored all ${total} Activity Group${total === 1 ? "" : "s"} — finalizing.`;
}
