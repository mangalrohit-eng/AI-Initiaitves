/**
 * In-memory LRU cache for the strategist outputs. Keyed by
 * `inputHash + modelId + promptVersion` so a scope flip (which changes
 * `inputHash` via `buildStrategistInput`) always misses cache.
 *
 * Server-only — same lifetime as the Next.js Node process.
 */
import type { StrategistOutputs } from "@/lib/strategist/types";

type CacheEntry = {
  key: string;
  outputs: StrategistOutputs;
};

const MAX_ENTRIES = 32;
const cache = new Map<string, CacheEntry>();

function keyOf(
  inputHash: string,
  modelId: string,
  promptVersion: string,
): string {
  return `${promptVersion}::${modelId}::${inputHash}`;
}

export function getCachedStrategistOutputs(
  inputHash: string,
  modelId: string,
  promptVersion: string,
): StrategistOutputs | null {
  const k = keyOf(inputHash, modelId, promptVersion);
  const hit = cache.get(k);
  if (!hit) return null;
  // LRU touch.
  cache.delete(k);
  cache.set(k, hit);
  return hit.outputs;
}

export function putCachedStrategistOutputs(outputs: StrategistOutputs): void {
  const k = keyOf(outputs.inputHash, outputs.modelId, outputs.promptVersion);
  cache.delete(k);
  cache.set(k, { key: k, outputs });
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cache.delete(oldest);
  }
}
