"use client";

import * as React from "react";
import { Layers, LayoutGrid } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Tower } from "@/data/types";
import { TowerWorkbenchView } from "@/components/towers/TowerWorkbenchView";
import { SolutionsGallery } from "@/components/towers/SolutionsGallery";
import { InitiativeReviewChipV6 } from "@/components/towers/InitiativeReviewChipV6";
import { cn } from "@/lib/utils";

type TabId = "workbench" | "solutions";

type TabDef = {
  id: TabId;
  label: string;
  hint: string;
  icon: LucideIcon;
};

const TABS: ReadonlyArray<TabDef> = [
  {
    id: "workbench",
    label: "Workbench",
    hint: "Custom built · 1 per tower",
    icon: Layers,
  },
  {
    id: "solutions",
    label: "AI Solutions",
    hint: "Curated · point solutions",
    icon: LayoutGrid,
  },
];

/**
 * Tower Step 4 — top-level tab control sitting beneath the hero / KPI /
 * workshop-tools chrome.
 *
 *   1. "Workbench" (default) — the custom-built, consolidated,
 *      per-tower user-facing app the tower's operators actually use.
 *      Reads `TOWER_WORKBENCHES[towerId]` and renders surfaces, why-
 *      consolidated, why-custom, digital core, workforce shift,
 *      success metric, and rollout pattern.
 *   2. "AI Solutions" — the existing `SolutionsGallery` (point
 *      solutions / L3 AI Solutions). Workbench is the *consolidator*;
 *      the gallery is the *catalog of agents and tools* the workbench
 *      stitches together.
 *
 * The validation chip stays anchored to the AI Solutions tab — that's
 * where per-solution approve / reject decisions live. Both panes stay
 * mounted (`hidden`) so gallery filter / scroll state survives tab
 * switches.
 */
export function TowerStep4Tabs({ tower }: { tower: Tower }) {
  const [active, setActive] = React.useState<TabId>("workbench");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Tower view"
          className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {TABS.map((t) => {
            const selected = t.id === active;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tower-step4-tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`tower-step4-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(t.id)}
                className={cn(
                  "inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm transition",
                  selected
                    ? "border-accent-purple bg-forge-surface font-medium text-accent-purple-light shadow-sm ring-1 ring-accent-purple/20"
                    : "border-forge-border bg-forge-well text-forge-body hover:border-forge-border-strong hover:text-forge-ink",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    selected ? "text-accent-purple-light" : "text-forge-hint",
                  )}
                  aria-hidden
                />
                <span>{t.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                    selected
                      ? "bg-accent-purple/15 text-accent-purple-light"
                      : "bg-forge-surface text-forge-hint",
                  )}
                >
                  {t.hint}
                </span>
              </button>
            );
          })}
        </div>
        {active === "solutions" ? <InitiativeReviewChipV6 tower={tower} /> : null}
      </div>

      <div
        role="tabpanel"
        id="tower-step4-panel-workbench"
        aria-labelledby="tower-step4-tab-workbench"
        hidden={active !== "workbench"}
      >
        <TowerWorkbenchView tower={tower} />
      </div>

      <div
        role="tabpanel"
        id="tower-step4-panel-solutions"
        aria-labelledby="tower-step4-tab-solutions"
        hidden={active !== "solutions"}
        className="space-y-3"
      >
        <SolutionsGallery tower={tower} />
      </div>
    </div>
  );
}
