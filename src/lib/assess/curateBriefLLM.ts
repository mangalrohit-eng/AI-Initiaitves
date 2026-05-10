/**
 * Lazy LLM path: full `Process` JSON for the four-lens initiative view.
 * Implementation lives in `curateBriefProcessLLM.ts`.
 */
export {
  curateBriefWithLLM,
  isLLMConfigured,
  buildFallbackProcess,
  legacyGeneratedBriefToProcess,
  normalizeLlmProcess,
  normSolutionBrief,
  deriveSolutionBriefFromProcess,
  TOWER_BRAND_HINT,
  CURATE_BRIEF_PROMPT_VERSION,
  getCurateBriefInferenceMeta,
  LLMError,
  type CurateBriefLLMInput,
  type CurateBriefLLMOptions,
} from "./curateBriefProcessLLM";
