"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { OffshoreClassifyState } from "@/lib/llm/useOffshorePlanClassify";
import { cn } from "@/lib/utils";

export type OffshoreActionBarProps = {
  /** N user-set / seeded carve-out rows. Sublabel shows the reason mix. */
  carveOutCount: number;
  /** "12 Editorial · 8 Talent · 5 SOX · 22 Sales" or similar. */
  carveOutMixLabel: string;
  /** Composed location string — e.g. "Bangalore + Pune + Manila". */
  locationLabel: string;
  /** Whether any carve-out flag is user-set (not all-seed). */
  hasUserCarveOuts: boolean;
  /** Current LLM lifecycle state. */
  llm: OffshoreClassifyState;
  /** True when current inputHash differs from generatedForInputHash. */
  isStale: boolean;
  /** User-clicked Regenerate. Manual fire — never called automatically. */
  onRegenerate: () => void;
  /** Switch the active tab to Assumptions. */
  onEditAssumptions: () => void;
};

/**
 * Step-5 sticky top action bar. Status row on the left, single Regenerate
 * button on the right. The "Edit in Assumptions →" link in the status text
 * jumps the active tab to Assumptions — no drawer, no modal.
 *
 * Manual-fire only: nothing in this bar (or its hook) calls `onRegenerate`
 * implicitly. Drift only paints the Stale chip.
 */
export function OffshoreActionBar({
  carveOutCount,
  carveOutMixLabel,
  locationLabel,
  hasUserCarveOuts,
  llm,
  isStale,
  onRegenerate,
  onEditAssumptions,
}: OffshoreActionBarProps) {
  const isLoading = llm.status === "loading";
  const hasResult = llm.status === "ready" && llm.lanes.size > 0;
  const showFallbackChip = !!(llm.warning && hasResult);
  const [warningOpen, setWarningOpen] = React.useState(false);
  const detailedReason = parseFallbackReason(llm.warning);

  return (
    <div className="rounded-2xl border border-forge-border bg-forge-surface px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border border-accent-purple/30 bg-accent-purple/5 text-accent-purple-dark">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-forge-ink">
              <span className="inline-flex items-center gap-1">
                <span className="font-mono text-base font-semibold tabular-nums text-forge-ink">
                  {carveOutCount}
                </span>
                <span className="text-forge-body">
                  carve-out{carveOutCount === 1 ? "" : "s"}
                </span>
                {!hasUserCarveOuts && carveOutCount > 0 && (
                  <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-well/60 px-2 py-0.5 text-[10px] font-medium text-forge-subtle">
                    pre-seeded
                  </span>
                )}
              </span>
              <span className="text-forge-subtle/60" aria-hidden>·</span>
              <span className="font-mono text-forge-body">{locationLabel}</span>
              {hasResult && llm.generatedAt && (
                <>
                  <span className="text-forge-subtle/60" aria-hidden>·</span>
                  <span className="text-forge-subtle">
                    Last generated {timeAgo(llm.generatedAt)}
                  </span>
                </>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-forge-subtle">
              {carveOutCount > 0 ? (
                <span className="font-mono">{carveOutMixLabel}</span>
              ) : (
                <span className="italic">No carve-outs set yet</span>
              )}
              <button
                type="button"
                onClick={onEditAssumptions}
                className="inline-flex items-center gap-1 font-medium text-accent-purple-dark underline-offset-2 hover:underline"
              >
                Edit in Assumptions
                <ExternalLink className="h-3 w-3" aria-hidden />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isStale && hasResult && !isLoading && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent-amber/40 bg-accent-amber/10 px-2.5 py-1 text-[11px] font-medium text-accent-amber">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              Stale — regenerate to refresh
            </span>
          )}
          {llm.status === "error" && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-accent-red/40 bg-accent-red/10 px-2.5 py-1 text-[11px] font-medium text-accent-red"
              title={llm.errorMessage ?? undefined}
            >
              <AlertTriangle className="h-3 w-3" aria-hidden />
              {truncate(llm.errorMessage ?? "Generation error", 40)}
            </span>
          )}
          {showFallbackChip && (
            <button
              type="button"
              onClick={() => setWarningOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-accent-amber/40 bg-accent-amber/10 px-2.5 py-1 text-[11px] font-medium text-accent-amber transition hover:bg-accent-amber/15"
              aria-expanded={warningOpen}
              aria-controls="offshore-fallback-detail"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden />
              Heuristic fallback — why?
              {warningOpen ? (
                <ChevronUp className="h-3 w-3" aria-hidden />
              ) : (
                <ChevronDown className="h-3 w-3" aria-hidden />
              )}
            </button>
          )}
          {hasResult && !isStale && llm.source === "llm" && llm.status === "ready" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent-green/40 bg-accent-green/10 px-2.5 py-1 text-[11px] font-medium text-accent-green">
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              Up to date
            </span>
          )}

          <button
            type="button"
            onClick={onRegenerate}
            disabled={isLoading}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition",
              isLoading
                ? "cursor-wait border border-accent-purple/30 bg-accent-purple/5 text-accent-purple-dark"
                : "border border-accent-purple bg-accent-purple text-white shadow-sm hover:bg-accent-purple-dark",
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Regenerating…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" aria-hidden />
                {hasResult ? "Regenerate offshore plan" : "Generate offshore plan"}
              </>
            )}
          </button>
        </div>
      </div>

      {showFallbackChip && warningOpen && (
        <div
          id="offshore-fallback-detail"
          className="mt-3 rounded-xl border border-accent-amber/30 bg-accent-amber/5 px-3 py-2.5 text-[12px] leading-relaxed text-forge-body"
        >
          <div className="font-semibold text-accent-amber">
            AI lane classifier didn&rsquo;t run — used the deterministic
            heuristic instead.
          </div>
          <div className="mt-1 grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-3">
            <span className="text-forge-subtle">Reason</span>
            <span className="text-forge-ink">{detailedReason.summary}</span>
            {detailedReason.envHint && (
              <>
                <span className="text-forge-subtle">Environment</span>
                <span className="font-mono text-[11px] text-forge-body">
                  {detailedReason.envHint}
                </span>
              </>
            )}
            <span className="text-forge-subtle">Next step</span>
            <span className="text-forge-ink">{detailedReason.nextStep}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The route serializes the heuristic-fallback reason as
 *   "<reason text>. [env=vercel=local, hasVar=true, keyLen=51]"
 * We split on the trailing `[env=...]` so the panel can render a
 * readable summary + a separate env-hint row, plus a tailored next-step
 * suggestion (set the API key, retry, or contact ops).
 */
function parseFallbackReason(warning: string | null): {
  summary: string;
  envHint: string | null;
  nextStep: string;
} {
  if (!warning) {
    return {
      summary: "Unknown — the route returned the heuristic fallback without a reason string.",
      envHint: null,
      nextStep: "Click Regenerate to retry the AI call.",
    };
  }
  const envMatch = warning.match(/\s*\[env=([^\]]+)\]\s*$/);
  const envHint = envMatch ? envMatch[1]!.trim() : null;
  const summary = (envMatch
    ? warning.slice(0, envMatch.index ?? warning.length)
    : warning
  )
    .trim()
    .replace(/\s+$/, "");

  let nextStep = "Click Regenerate to retry the AI call.";
  const lower = summary.toLowerCase();
  if (lower.includes("openai_api_key not set") || lower.includes("api key")) {
    nextStep =
      "Set the OPENAI_API_KEY environment variable on this deployment, then click Regenerate.";
  } else if (lower.includes("timed out") || lower.includes("timeout")) {
    nextStep =
      "OpenAI request timed out. Click Regenerate to retry — chunked calls auto-retry stale chunks.";
  } else if (lower.includes("openai 429") || lower.includes("rate")) {
    nextStep =
      "OpenAI rate-limited the call. Wait a few seconds and click Regenerate.";
  } else if (lower.match(/openai \d{3}/)) {
    nextStep =
      "OpenAI returned an HTTP error. Click Regenerate to retry; if it persists, check the model id and quota.";
  } else if (lower.includes("invalid lane") || lower.includes("missing rowid") || lower.includes("not valid json")) {
    nextStep =
      "The AI returned malformed JSON. Click Regenerate to retry — the response is validated before being applied.";
  }

  return { summary, envHint, nextStep };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function timeAgo(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const sec = Math.max(1, Math.floor((now - then) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    return `${d}d ago`;
  } catch {
    return "just now";
  }
}
