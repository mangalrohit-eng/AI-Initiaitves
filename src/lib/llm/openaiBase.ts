/**
 * Shared OpenAI base-URL resolver. Every server-side LLM caller routes
 * through this helper so a single env var (`OPENAI_BASE_URL`) flips the
 * entire deployment over to Azure / a proxy / a self-hosted gateway.
 *
 * Originally lived in `crossTowerPlanLLM.ts`; extracted when Ask Forge
 * (`/api/ask`) became the second consumer.
 */

export function resolveOpenAiBaseUrl(): string {
  const raw = process.env.OPENAI_BASE_URL?.trim();
  if (raw && raw.length > 0) {
    // Trim trailing slashes for predictable concatenation.
    return raw.replace(/\/+$/, "");
  }
  return "https://api.openai.com";
}
