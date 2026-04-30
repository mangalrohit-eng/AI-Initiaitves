"use client";

import * as React from "react";
import { DollarSign, Check } from "lucide-react";
import { formatUsdCompact } from "@/lib/format";

/**
 * Plan threshold input — sets the minimum `attributedAiUsd` an initiative
 * must clear to be in plan. Initiatives below the threshold are opportunistic
 * (handled inside the tower roadmaps, not the cross-tower plan).
 *
 * UX:
 *   - One-click presets ($100K / $250K / $500K / $1M / $5M).
 *   - Free-form numeric input for custom values.
 *   - Edits debounce to the parent so dragging through values doesn't trigger
 *     a flurry of LLM regenerations. The deterministic view updates on commit.
 *   - Selected value persists to localStorage so refreshes preserve intent.
 *
 * Fully deterministic — the threshold is a user knob, not LLM output.
 */
const PRESETS = [
  { value: 100_000, label: "$100K" },
  { value: 250_000, label: "$250K" },
  { value: 500_000, label: "$500K" },
  { value: 1_000_000, label: "$1M" },
  { value: 5_000_000, label: "$5M" },
] as const;

const DEBOUNCE_MS = 600;
const MAX_THRESHOLD = 100_000_000; // $100M ceiling — no plan-threshold should ever exceed this

export function PlanThresholdInput({
  value,
  onChange,
  excludedCount,
  excludedAiUsd,
  isStale = false,
}: {
  value: number;
  onChange: (next: number) => void;
  excludedCount: number;
  excludedAiUsd: number;
  /**
   * When `true`, the threshold has been changed since the LLM narrative was
   * last generated. Adds a non-intrusive amber accent on the container plus a
   * nudge caption directing the user to click Refresh plan. The deterministic
   * page content (KPI tiles, Gantt, listing, Tech View) already reflects the
   * new threshold — only the GPT-5.5 narrative is behind.
   */
  isStale?: boolean;
}) {
  // Local draft state for the free-form input. Commits to parent via debounce.
  const [draft, setDraft] = React.useState<string>(formatNumber(value));
  const draftNumberRef = React.useRef<number>(value);
  const [pulse, setPulse] = React.useState(false);

  // Reconcile draft with parent when value changes from outside (e.g. preset
  // click or initial hydration). Skip the reconcile while the user is mid-edit
  // — the debounce will commit their value shortly.
  React.useEffect(() => {
    if (parseUsd(draft) === value) return;
    setDraft(formatNumber(value));
  }, [value, draft]);

  // Debounce free-form numeric edits to the parent.
  React.useEffect(() => {
    const parsed = parseUsd(draft);
    if (parsed === null) return;
    const clamped = Math.max(0, Math.min(MAX_THRESHOLD, Math.round(parsed)));
    if (clamped === value) return;
    draftNumberRef.current = clamped;
    const t = setTimeout(() => {
      if (draftNumberRef.current === clamped) onChange(clamped);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft, value, onChange]);

  const handlePreset = (preset: number) => {
    setDraft(formatNumber(preset));
    onChange(preset);
    setPulse(true);
    window.setTimeout(() => setPulse(false), 400);
  };

  return (
    <div
      className={`rounded-xl border bg-forge-surface px-3 py-2.5 shadow-sm transition ${
        isStale
          ? "border-accent-amber/60 ring-1 ring-accent-amber/20"
          : "border-forge-border"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
          Plan threshold
        </span>
        <span className="text-[10px] text-forge-hint">·</span>
        <span className="text-[10px] text-forge-hint">in-plan minimum value</span>
        {isStale ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-accent-amber/50 bg-accent-amber/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent-amber">
            <span className="h-1 w-1 animate-pulse rounded-full bg-accent-amber" />
            Pending
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-stretch gap-2">
        <label
          className={`group relative flex w-40 items-center rounded-lg border bg-forge-well/40 px-2 py-1.5 transition focus-within:border-accent-purple/60 focus-within:bg-forge-surface ${
            pulse
              ? "border-accent-purple/60 ring-2 ring-accent-purple/30"
              : "border-forge-border"
          }`}
        >
          <DollarSign className="mr-1 h-3.5 w-3.5 text-forge-hint" aria-hidden />
          <input
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const parsed = parseUsd(draft);
              if (parsed === null) return;
              const clamped = Math.max(
                0,
                Math.min(MAX_THRESHOLD, Math.round(parsed)),
              );
              setDraft(formatNumber(clamped));
              onChange(clamped);
            }}
            placeholder="500,000"
            aria-label="Plan threshold in US dollars"
            className="w-full bg-transparent font-mono text-sm tabular-nums text-forge-ink outline-none placeholder:text-forge-hint"
          />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {PRESETS.map((p) => {
          const active = p.value === value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => handlePreset(p.value)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] tabular-nums transition ${
                active
                  ? "border-accent-purple/60 bg-accent-purple/10 text-accent-purple-dark"
                  : "border-forge-border bg-forge-well text-forge-body hover:text-forge-ink"
              }`}
            >
              {active ? (
                <Check className="h-2.5 w-2.5" aria-hidden />
              ) : null}
              {p.label}
            </button>
          );
        })}
      </div>

      <p className="mt-2 max-w-xs text-[10px] leading-snug text-forge-subtle">
        {value <= 0 ? (
          <>No threshold — every curated initiative is in plan.</>
        ) : excludedCount === 0 ? (
          <>
            Every curated initiative is at or above{" "}
            <span className="font-mono text-forge-body">
              {formatUsdCompact(value)}
            </span>
            . Lower the threshold to see what falls below.
          </>
        ) : (
          <>
            <span className="font-mono text-forge-body">
              {excludedCount} initiative{excludedCount === 1 ? "" : "s"}
            </span>{" "}
            ·{" "}
            <span className="font-mono text-forge-body">
              {formatUsdCompact(excludedAiUsd)}
            </span>{" "}
            below threshold — opportunistic, handled inside the tower roadmaps.
          </>
        )}
      </p>
      {isStale ? (
        <p className="mt-1.5 max-w-xs text-[10px] leading-snug text-accent-amber">
          Threshold changed — KPIs and Gantt are live. Click{" "}
          <span className="font-semibold">Refresh plan</span> to update the
          GPT-5.5 narrative.
        </p>
      ) : null}
    </div>
  );
}

// ===========================================================================
//   Helpers
// ===========================================================================

function formatNumber(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  return Math.round(n).toLocaleString("en-US");
}

/** Accepts "500000", "500,000", "$500,000", "500K", "1M". Returns null on garbage. */
function parseUsd(raw: string): number | null {
  const trimmed = raw.trim().replace(/[\s,]/g, "").replace(/^\$/, "");
  if (trimmed === "") return 0;
  const m = trimmed.match(/^(\d+(?:\.\d+)?)([kKmMbB]?)$/);
  if (!m) return null;
  const base = Number.parseFloat(m[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = m[2].toLowerCase();
  if (suffix === "k") return base * 1_000;
  if (suffix === "m") return base * 1_000_000;
  if (suffix === "b") return base * 1_000_000_000;
  return base;
}
