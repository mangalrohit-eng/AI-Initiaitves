"use client";

import * as React from "react";
import type { Tower } from "@/data/types";
import { resolveSolutionIcon } from "@/lib/initiatives/solutionIconAllowlist";
import { ChangedSinceBadge } from "@/components/collab/ChangedSinceBadge";
import { cn } from "@/lib/utils";

/**
 * V2 hero replacing the dashboard-style `TowerHeader`. Establishes a
 * dark, editorial frame for the rest of the page:
 *
 *   - Per-tower motif tile (Lucide icon picked on each `Tower` slice).
 *   - Tower name + "AI Initiatives" pre-title — workshop attendees
 *     immediately know they're on the program's Step 4 view.
 *   - Narrative summary or description as the first thing users read.
 *   - Slim "Reviewer / Accenture" lead row (low-emphasis, monospaced)
 *     so attribution is present but doesn't dominate.
 *   - Collapsible "Current state" so the long Versant-grounded block
 *     stays available without burning prime above-the-fold real estate.
 *
 * No KPIs here — those live in the dedicated `TowerKpiStrip` so the hero
 * stays a clean editorial setup.
 */
export function TowerHeroV2({ tower }: { tower: Tower }) {
  const Icon = resolveSolutionIcon(tower.iconKey, "ship-ready");
  return (
    <header className="relative overflow-hidden rounded-2xl border border-forge-border bg-gradient-to-br from-near-black via-forge-surface/60 to-near-black p-5 sm:p-7">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full",
          "bg-accent-purple/15 blur-3xl",
        )}
      />
      <div className="relative flex flex-wrap items-start gap-5">
        <span
          aria-hidden
          className={cn(
            "inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border",
            "border-accent-purple/40 bg-accent-purple/10 text-accent-purple-light",
            "shadow-[0_0_0_1px_rgba(161,0,255,0.15)]",
          )}
        >
          <Icon className="h-7 w-7" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-accent-purple-light/80">
            <span className="rounded-full border border-accent-purple/40 bg-accent-purple/10 px-2 py-0.5 text-accent-purple-light">
              &gt; Step 4
            </span>
            <span className="text-forge-hint">AI Initiatives</span>
            <ChangedSinceBadge
              kind="tower"
              id={tower.id}
              lastUpdated={tower.lastUpdated}
            />
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-forge-ink sm:text-4xl">
            {tower.name}
          </h1>
          {tower.narrativeSummary ? (
            <p className="mt-3 max-w-3xl text-base font-medium leading-relaxed text-forge-ink/90">
              {tower.narrativeSummary}
            </p>
          ) : null}
          <p
            className={cn(
              "max-w-3xl text-sm leading-relaxed text-forge-body",
              tower.narrativeSummary ? "mt-2" : "mt-3",
            )}
          >
            {tower.description}
          </p>
          {tower.versantLeads.length > 0 || tower.accentureLeads.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-forge-hint">
              {tower.versantLeads.length > 0 ? (
                <span>
                  <span className="text-forge-subtle">Versant lead</span>{" "}
                  <span className="text-forge-body">
                    {tower.versantLeads.join(", ")}
                  </span>
                </span>
              ) : null}
              {tower.accentureLeads.length > 0 ? (
                <span>
                  <span className="text-forge-subtle">Accenture lead</span>{" "}
                  <span className="text-forge-body">
                    {tower.accentureLeads.join(", ")}
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}
          <details className="mt-4 max-w-3xl rounded-xl border border-forge-border/60 bg-forge-well/40 px-4 py-2.5 text-sm text-forge-body">
            <summary className="cursor-pointer text-xs font-mono uppercase tracking-[0.16em] text-forge-hint hover:text-forge-body">
              &gt; Current state
            </summary>
            <p className="mt-2 leading-relaxed text-forge-body">
              {tower.currentState}
            </p>
          </details>
        </div>
      </div>
    </header>
  );
}
