/**
 * Tower Workbench helpers — fuzzy-match a hand-authored
 * `WorkbenchSurface.poweredByCapabilities` entry to the live
 * LLM-curated `V6InitiativeCard.solutionName` so the workbench surface
 * cards can render click-through chips when a match exists, and degrade
 * gracefully (capability name as plain text) when none does.
 *
 * Why fuzzy: the workbench is hand-authored once with generic capability
 * names ("Bank reconciliation auto-match"); the L3 curator LLM picks a
 * specific solution title at curation time ("Agentic AI Bank Recon
 * Co-Pilot"). The match must tolerate that drift without becoming a
 * generic English-similarity match (which would create false positives
 * across the tower).
 */

import type { V6InitiativeCard } from "@/lib/initiatives/selectV6";

/**
 * Token-level Jaccard similarity between two strings. Returns a value in
 * [0, 1]. Both sides are normalized to lowercase, punctuation stripped,
 * and split into whitespace tokens. Tokens shorter than 3 chars are
 * dropped to avoid noise from "of"/"the"/"a"/"in" tilting the score.
 */
function jaccardScore(a: string, b: string): number {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let intersect = 0;
  aTokens.forEach((t) => {
    if (bTokens.has(t)) intersect += 1;
  });
  const union = aTokens.size + bTokens.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

function tokenize(s: string): Set<string> {
  const out = new Set<string>();
  const cleaned = s
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return out;
  for (const tok of cleaned.split(" ")) {
    if (tok.length >= 3) out.add(tok);
  }
  return out;
}

/**
 * Match an array of capability names against the live initiatives in
 * this tower. Returns one entry per capability — `init` is non-null
 * when a confident match exists (Jaccard >= threshold), null otherwise.
 *
 * Threshold tuned to be conservative but tolerant of the canonical
 * LLM naming pattern ("Agentic AI X Co-Pilot" prepends + appends 2
 * tokens around the actual capability). At threshold 0.30:
 *   - "Bank reconciliation auto-match" (4 tokens) confidently matches
 *     "Agentic AI Bank Reconciliation Co-Pilot" (Jaccard 0.333) AND
 *   - "Bank reconciliation auto-match" cleanly REJECTS "Intercompany
 *     Reconciliation Co-Pilot" (Jaccard 0.167).
 * Single-token overlap between short capability + long solution name
 * (e.g. "Engagement signal" vs "Customer Engagement Sentiment
 * Analyzer", Jaccard 0.20) stays below the threshold.
 */
export type WorkbenchCapabilityMatch = {
  capability: string;
  init: V6InitiativeCard | null;
};

export function matchCapabilitiesToInitiatives(
  capabilities: string[],
  initiatives: V6InitiativeCard[],
  threshold = 0.3,
): WorkbenchCapabilityMatch[] {
  return capabilities.map((cap) => {
    let best: { init: V6InitiativeCard; score: number } | null = null;
    for (const init of initiatives) {
      if (init.isPlaceholder) continue;
      const nameScore = jaccardScore(cap, init.solutionName);
      const taglineScore = init.tagline
        ? jaccardScore(cap, init.tagline) * 0.5
        : 0;
      const combined = Math.max(nameScore, taglineScore);
      if (combined >= threshold && (!best || combined > best.score)) {
        best = { init, score: combined };
      }
    }
    return { capability: cap, init: best ? best.init : null };
  });
}

/**
 * For a whole workbench, deduplicate matched initiative ids across
 * surfaces so the "powered by N AI Solutions" caption at the workbench
 * level does not double-count.
 */
export function uniqueMatchedInitiativeIds(
  surfaces: { matches: WorkbenchCapabilityMatch[] }[],
): string[] {
  const seen = new Set<string>();
  for (const s of surfaces) {
    for (const m of s.matches) {
      if (m.init && !seen.has(m.init.id)) seen.add(m.init.id);
    }
  }
  return Array.from(seen);
}
