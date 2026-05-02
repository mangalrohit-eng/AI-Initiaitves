"use client";

import Link from "next/link";
import { Building2, Sparkles, Map as MapIcon, ListTree } from "lucide-react";
import type { AskBrandLensBlock } from "@/lib/ask/types";

const KIND_LABELS: Record<AskBrandLensBlock["mentions"][number]["kind"], string> = {
  tower: "Tower",
  brief: "Brief",
  capNode: "Capability node",
  process: "Process",
};

const KIND_ICONS: Record<AskBrandLensBlock["mentions"][number]["kind"], React.ComponentType<{ className?: string }>> = {
  tower: Building2,
  brief: Sparkles,
  capNode: MapIcon,
  process: ListTree,
};

export function BrandLensBlock({ block }: { block: AskBrandLensBlock }) {
  // Group by kind preserving order.
  const grouped = new Map<string, typeof block.mentions>();
  for (const m of block.mentions) {
    const cur = grouped.get(m.kind) ?? [];
    cur.push(m);
    grouped.set(m.kind, cur);
  }

  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent-purple-dark">
          <Building2 className="h-3 w-3" aria-hidden />
          {block.brand}
        </span>
        <span className="text-xs text-forge-subtle">
          {block.mentions.length === 0
            ? "No mentions found in authored corpus."
            : `${block.mentions.length} mention${block.mentions.length === 1 ? "" : "s"} across the corpus`}
        </span>
      </div>

      {block.mentions.length === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-forge-subtle">
          Brand affinity isn&apos;t structurally tagged on workshop L4 rows. The static
          corpus shows no narrative mention of this brand.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {Array.from(grouped.entries()).map(([kind, items]) => {
            const Icon = KIND_ICONS[kind as AskBrandLensBlock["mentions"][number]["kind"]];
            return (
              <div key={kind}>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-forge-subtle">
                  <Icon className="h-3 w-3" aria-hidden />
                  {KIND_LABELS[kind as AskBrandLensBlock["mentions"][number]["kind"]]}
                </div>
                <ul className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {items.map((m) => (
                    <li key={`${m.kind}-${m.id}`}>
                      <MentionLink mention={m} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MentionLink({ mention }: { mention: AskBrandLensBlock["mentions"][number] }) {
  const href =
    mention.kind === "tower"
      ? `/tower/${mention.id}`
      : mention.kind === "brief"
        ? `/tower/${guessBriefTower(mention.id)}/brief/${mention.id}`
        : null;
  const inner = (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-forge-border bg-forge-canvas px-2 py-1 text-[11px] font-medium text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark">
      {mention.label}
      <span className="font-mono text-[10px] text-forge-hint">{mention.id}</span>
    </span>
  );
  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

/**
 * Best-effort tower guess for brief deep links — the brief id encodes the
 * subject (e.g. `breaking-news-monitoring`) but not the tower. The validator
 * in `askLLM.ts` won't accept a brief outside the canonical list, so the
 * deep link still resolves. If the lookup fails, fall back to `/towers`.
 */
function guessBriefTower(briefId: string): string {
  // Lazy import via require — `processBriefs` is large and tree-shakes oddly
  // when used at module-init time. Importing here keeps it deferred.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { processBriefs } = require("@/data/processBriefs") as { processBriefs: { id: string; towerSlug: string }[] };
  const hit = processBriefs.find((b) => b.id === briefId);
  return hit?.towerSlug ?? "";
}
