/**
 * Cross-Tower AI Plan v3 — two-tier in-memory LRU cache.
 *
 * The plan generation fans out per L4 cohort, then runs a single
 * program-synthesis call on top. Each layer caches independently:
 *
 *   - **Project cache**  — keyed per cohort. A single failing/changed
 *     cohort doesn't invalidate the rest of the program.
 *   - **Synthesis cache** — keyed by the authored set of projects + the
 *     timing assumptions that shape the narrative.
 *
 * Cache keys deliberately exclude timing-only knobs (program-start, build /
 * ramp / value-start months, fill-in offset). Those are 0-token operations:
 * the client recomposes the Gantt deterministically without an LLM call.
 *
 * Lives in module scope on the Node runtime — survives across requests
 * within a single server instance. On serverless cold starts the cache
 * resets, which is acceptable for a workshop tool.
 */

import type {
  AIProjectLLM,
  ProgramSynthesisLLM,
} from "@/lib/cross-tower/aiProjects";

// ---------------------------------------------------------------------------
//   Project cache (per L4 cohort)
// ---------------------------------------------------------------------------

export type ProjectCacheKey = {
  /** Cohort key — `proj-{l4RowId}`. */
  cohortInputHash: string;
  /** LLM-affecting assumptions hash (threshold, brief depth, lens emphases). */
  assumptionsHash: string;
  modelId: string;
  promptVersion: string;
};

export type ProjectCacheEntry = {
  project: AIProjectLLM;
  modelId: string;
  promptVersion: string;
  generatedAt: string;
  latencyMs: number;
  tokenUsage?: { prompt?: number; completion?: number; total?: number };
  expiresAtMs: number;
};

// ---------------------------------------------------------------------------
//   Synthesis cache (one entry per authored set + timing context)
// ---------------------------------------------------------------------------

export type SynthesisCacheKey = {
  /** Hash over all authored project ids + buckets — what synthesis sees. */
  projectsDigest: string;
  /** Timing-context hash (drives narrative phrasing, not Gantt math). */
  timingHash: string;
  /** LLM-affecting assumptions hash (lens emphases). */
  assumptionsHash: string;
  modelId: string;
  promptVersion: string;
};

export type SynthesisCacheEntry = {
  synthesis: ProgramSynthesisLLM;
  modelId: string;
  promptVersion: string;
  generatedAt: string;
  latencyMs: number;
  tokenUsage?: { prompt?: number; completion?: number; total?: number };
  expiresAtMs: number;
};

// ---------------------------------------------------------------------------
//   Tiny LRU implementation (per cache)
// ---------------------------------------------------------------------------

const MAX_PROJECT_ENTRIES = 256;
const MAX_SYNTHESIS_ENTRIES = 32;

type LruNode<V> = {
  key: string;
  value: V;
  prev: LruNode<V> | null;
  next: LruNode<V> | null;
};

class Lru<V extends { expiresAtMs: number }> {
  private map = new Map<string, LruNode<V>>();
  private head: LruNode<V> | null = null;
  private tail: LruNode<V> | null = null;
  constructor(private readonly maxEntries: number) {}

  get(key: string): V | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;
    if (Date.now() > node.value.expiresAtMs) {
      this.map.delete(key);
      this.detach(node);
      return undefined;
    }
    this.moveToHead(node);
    return node.value;
  }

  put(key: string, value: V): void {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      this.moveToHead(existing);
      return;
    }
    while (this.map.size >= this.maxEntries) {
      if (!this.tail) break;
      this.map.delete(this.tail.key);
      this.detach(this.tail);
    }
    const node: LruNode<V> = { key, value, prev: null, next: null };
    this.map.set(key, node);
    this.moveToHead(node);
  }

  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  private detach(node: LruNode<V>): void {
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (this.head === node) this.head = node.next;
    if (this.tail === node) this.tail = node.prev;
    node.prev = null;
    node.next = null;
  }

  private moveToHead(node: LruNode<V>): void {
    if (this.head === node) return;
    this.detach(node);
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }
}

const projectCache = new Lru<ProjectCacheEntry>(MAX_PROJECT_ENTRIES);
const synthesisCache = new Lru<SynthesisCacheEntry>(MAX_SYNTHESIS_ENTRIES);

// ---------------------------------------------------------------------------
//   TTL + key helpers
// ---------------------------------------------------------------------------

function defaultTtlMs(): number {
  const env = process.env.CROSS_TOWER_PLAN_CACHE_TTL_S?.trim();
  if (env) {
    const n = Number(env);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n) * 1000;
  }
  return 1800 * 1000; // 30 minutes
}

function isCacheDisabled(): boolean {
  return defaultTtlMs() === 0;
}

function projectKey(k: ProjectCacheKey): string {
  return `${k.cohortInputHash}::${k.assumptionsHash}::${k.modelId}::${k.promptVersion}`;
}

function synthesisKey(k: SynthesisCacheKey): string {
  return `${k.projectsDigest}::${k.timingHash}::${k.assumptionsHash}::${k.modelId}::${k.promptVersion}`;
}

// ---------------------------------------------------------------------------
//   Public API
// ---------------------------------------------------------------------------

export function getCachedProject(
  k: ProjectCacheKey,
): ProjectCacheEntry | undefined {
  if (isCacheDisabled()) return undefined;
  return projectCache.get(projectKey(k));
}

export function putCachedProject(
  k: ProjectCacheKey,
  entry: Omit<ProjectCacheEntry, "expiresAtMs" | "generatedAt"> & {
    generatedAt?: string;
  },
): void {
  if (isCacheDisabled()) return;
  const full: ProjectCacheEntry = {
    ...entry,
    generatedAt: entry.generatedAt ?? new Date().toISOString(),
    expiresAtMs: Date.now() + defaultTtlMs(),
  };
  projectCache.put(projectKey(k), full);
}

export function getCachedSynthesis(
  k: SynthesisCacheKey,
): SynthesisCacheEntry | undefined {
  if (isCacheDisabled()) return undefined;
  return synthesisCache.get(synthesisKey(k));
}

export function putCachedSynthesis(
  k: SynthesisCacheKey,
  entry: Omit<SynthesisCacheEntry, "expiresAtMs" | "generatedAt"> & {
    generatedAt?: string;
  },
): void {
  if (isCacheDisabled()) return;
  const full: SynthesisCacheEntry = {
    ...entry,
    generatedAt: entry.generatedAt ?? new Date().toISOString(),
    expiresAtMs: Date.now() + defaultTtlMs(),
  };
  synthesisCache.put(synthesisKey(k), full);
}

export function purgeCrossTowerCaches(): void {
  projectCache.clear();
  synthesisCache.clear();
}
