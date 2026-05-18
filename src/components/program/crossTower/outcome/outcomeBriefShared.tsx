"use client";

/**
 * Small primitives shared between the cluster and initiative outcome
 * brief routes. Keeps the route-level files focused on data plumbing
 * and section composition.
 */

import * as React from "react";
import { Coins } from "lucide-react";

import { useRedactDollars } from "@/lib/clientMode";
import { formatUsdCompact } from "@/lib/format";
import { towers as ALL_TOWERS } from "@/data/towers";
import type { DerivedValueTier } from "@/lib/strategist/rollups";
import type { ValueCategory } from "@/lib/strategist/types";

export function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-card sm:p-6"
    >
      <header className="mb-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark">
          {eyebrow}
        </span>
        <h2 className="mt-2 font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

export function ValueTierBadge({ tier }: { tier: DerivedValueTier }) {
  const cls =
    tier === "HIGH"
      ? "border-red-400/40 bg-red-50 text-red-700"
      : tier === "MEDIUM"
        ? "border-amber-400/40 bg-amber-50 text-amber-800"
        : tier === "LOW"
          ? "border-teal-400/40 bg-teal-50 text-teal-800"
          : "border-forge-border bg-forge-well/60 text-forge-subtle";
  const label = tier === "UNSIZED" ? "Unsized" : tier;
  const title =
    tier === "UNSIZED"
      ? "No anchored AI Solutions yet — TBD subject to discovery"
      : "Derived from the rolled-up modeled $ of anchored AI Solutions";
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center self-start rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}

export function ValueCategoryChips({
  categories,
}: {
  categories: ValueCategory[];
}) {
  if (categories.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {categories.map((c) => (
        <span
          key={c}
          className="rounded-full border border-accent-purple/30 bg-accent-purple/5 px-1.5 py-0.5 text-[10px] font-medium text-accent-purple-dark"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

export function TowerChipRow({ towers }: { towers: string[] }) {
  const labels = towers
    .map((tid) => ALL_TOWERS.find((t) => t.id === tid)?.name)
    .filter((s): s is string => !!s);
  if (labels.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {labels.map((l) => (
        <span
          key={l}
          className="rounded-md border border-forge-border bg-forge-well/40 px-1.5 py-0.5 text-[10.5px] font-medium text-forge-body"
        >
          {l}
        </span>
      ))}
    </div>
  );
}

export function ChipCloud({
  labels,
  tone,
}: {
  labels: string[];
  tone: "purple" | "teal";
}) {
  const cls =
    tone === "purple"
      ? "border-accent-purple/30 bg-accent-purple/5 text-accent-purple-dark"
      : "border-accent-teal/30 bg-accent-teal/5 text-accent-teal";
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {labels.map((l) => (
        <span
          key={l}
          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}
        >
          {l}
        </span>
      ))}
    </div>
  );
}

export function RollupCard({
  label,
  value,
  footnote,
}: {
  label: string;
  value: string;
  footnote: string;
}) {
  return (
    <div className="min-w-[18rem] rounded-xl border border-forge-border bg-forge-surface px-4 py-3 shadow-sm">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-forge-subtle">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-forge-ink">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-forge-subtle">{footnote}</p>
    </div>
  );
}

export function EmptySectionHint({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-forge-border bg-forge-well/40 p-3 text-[12px] text-forge-subtle">
      {message}
    </div>
  );
}

export function UnsizedHint({
  scope,
}: {
  scope: "cluster" | "initiative";
}) {
  return (
    <div className="rounded-md border border-dashed border-forge-border bg-forge-well/40 p-4 text-[12px] text-forge-subtle">
      The strategist did not anchor this {scope} to any tower-specific AI
      Solution. Modeled dollar impact:{" "}
      <strong className="text-forge-body">TBD — subject to discovery</strong>.
      Regenerate the strategist run once the tower-specific AI Solutions
      are curated, or open the Cross-tower outcomes tab to refresh.
    </div>
  );
}

/**
 * Render a modeled-dollar headline that matches the header label
 * format used in tower-specific solution briefs.
 */
export function HeadlineUsd({
  usd,
  fallback = "TBD — subject to discovery",
}: {
  usd: number | null;
  fallback?: string;
}) {
  const redact = useRedactDollars();
  if (usd === null) return <span className="text-forge-body">{fallback}</span>;
  if (redact) return <span className="font-mono">—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <Coins className="h-4 w-4 text-accent-purple-dark" aria-hidden />
      <span className="font-mono">{formatUsdCompact(usd, { decimals: 1 })}</span>
    </span>
  );
}
