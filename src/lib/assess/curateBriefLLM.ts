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
  TOWER_BRAND_HINT,
  getCurateBriefInferenceMeta,
  LLMError,
  type CurateBriefLLMInput,
  type CurateBriefLLMOptions,
} from "./curateBriefProcessLLM";
