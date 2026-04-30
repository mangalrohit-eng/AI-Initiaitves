/**
 * Tiny in-memory LRU cache for the Cross-Tower AI Plan server route.
 *
 * Keys combine `(inputHash, modelId, promptVersion)` so:
 *   - Two clients running an identical scenario hit the same cached plan.
 *   - Switching `CROSS_TOWER_PLAN_MODEL` invalidates without manual flush.
 *   - Bumping `PROMPT_VERSION` invalidates without manual flush.
 *
 * Lives in module scope on the Node runtime — survives across requests within
 * a single server instance, which is plenty for a workshop tool. On serverless
 * cold starts the cache resets, which is acceptable: the next request just
 * regenerates.
 */

import type { CrossTowerAiPlanLLM } from "@/lib/llm/prompts/crossTowerAiPlan.v1";

export type CachedPlanEntry = {
  plan: CrossTowerAiPlanLLM;
  modelId: string;
  promptVersion: string;
  inputHash: string;
  /** ISO timestamp when this entry was minted. */
  generatedAt: string;
  /** Token usage when the upstream provider returned it. */
  tokenUsage?: { prompt?: number; completion?: number; total?: number };
  latencyMs: number;
  /** Epoch ms after which this entry is expired. */
  expiresAtMs: number;
};

type CacheNode = {
  key: string;
  value: CachedPlanEntry;
  prev: CacheNode | null;
  next: CacheNode | null;
};

const MAX_ENTRIES = 32;

const cacheMap = new Map<string, CacheNode>();
let head: CacheNode | null = null; // most-recently-used
let tail: CacheNode | null = null; // least-recently-used

function defaultTtlMs(): number {
  const env = process.env.CROSS_TOWER_PLAN_CACHE_TTL_S?.trim();
  if (env) {
    const n = Number(env);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n) * 1000;
  }
  return 1800 * 1000; // 30 minutes
}

function makeKey(inputHash: string, modelId: string, promptVersion: string): string {
  return `${inputHash}::${modelId}::${promptVersion}`;
}

function detach(node: CacheNode): void {
  if (node.prev) node.prev.next = node.next;
  if (node.next) node.next.prev = node.prev;
  if (head === node) head = node.next;
  if (tail === node) tail = node.prev;
  node.prev = null;
  node.next = null;
}

function moveToHead(node: CacheNode): void {
  if (head === node) return;
  detach(node);
  node.next = head;
  if (head) head.prev = node;
  head = node;
  if (!tail) tail = node;
}

function evictIfFull(): void {
  while (cacheMap.size >= MAX_ENTRIES) {
    if (!tail) break;
    cacheMap.delete(tail.key);
    detach(tail);
  }
}

export function getCachedPlan(
  inputHash: string,
  modelId: string,
  promptVersion: string,
): CachedPlanEntry | undefined {
  // TTL = 0 disables cache entirely.
  if (defaultTtlMs() === 0) return undefined;
  const key = makeKey(inputHash, modelId, promptVersion);
  const node = cacheMap.get(key);
  if (!node) return undefined;
  if (Date.now() > node.value.expiresAtMs) {
    cacheMap.delete(key);
    detach(node);
    return undefined;
  }
  moveToHead(node);
  return node.value;
}

export function putCachedPlan(entry: CachedPlanEntry): void {
  // TTL = 0 disables writes.
  if (defaultTtlMs() === 0) return;
  const key = makeKey(entry.inputHash, entry.modelId, entry.promptVersion);
  const existing = cacheMap.get(key);
  if (existing) {
    existing.value = entry;
    moveToHead(existing);
    return;
  }
  evictIfFull();
  const node: CacheNode = { key, value: entry, prev: null, next: null };
  cacheMap.set(key, node);
  moveToHead(node);
}

export function purgeCachedPlans(): void {
  cacheMap.clear();
  head = null;
  tail = null;
}

export function buildCacheEntry(args: {
  plan: CrossTowerAiPlanLLM;
  modelId: string;
  promptVersion: string;
  inputHash: string;
  latencyMs: number;
  tokenUsage?: { prompt?: number; completion?: number; total?: number };
}): CachedPlanEntry {
  return {
    ...args,
    generatedAt: new Date().toISOString(),
    expiresAtMs: Date.now() + defaultTtlMs(),
  };
}
