"use client";

import * as React from "react";
import { CalendarRange, LayoutGrid, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Tower } from "@/data/types";
import { OperatingModelSection } from "./OperatingModelSection";
import { AiRoadmap } from "./AiRoadmap";
import { AiRoadmapV6 } from "./AiRoadmapV6";
import { SolutionsGallery } from "@/components/towers/SolutionsGallery";
import { IS_V6 } from "@/lib/schemaFlag";
import { cn } from "@/lib/utils";

type TabId = "gallery" | "capability" | "roadmap";

type TabDef = {
  id: TabId;
  label: string;
  hint: string;
  icon: LucideIcon;
};

const TABS_V6: ReadonlyArray<TabDef> = [
  {
    id: "gallery",
    label: "Solutions gallery",
    hint: "Filter · sort · search",
    icon: LayoutGrid,
  },
  {
    id: "capability",
    label: "Job Family roster",
    hint: "L2 → L3 → solutions",
    icon: Layers,
  },
  {
    id: "roadmap",
    label: "Feasibility roster",
    hint: "Proven pattern / New build",
    icon: CalendarRange,
  },
];

const TABS_V5: ReadonlyArray<TabDef> = [
  {
    id: "capability",
    label: "By capability",
    hint: "L2 → L5",
    icon: Layers,
  },
  {
    id: "roadmap",
    label: "Feasibility roster",
    hint: "Proven pattern / New build",
    icon: CalendarRange,
  },
];

/**
 * Hosts the per-tower AI Initiatives experience as sub-tabs.
 *
 * Under v6 (the active schema):
 *   1. "Solutions gallery" (default) — `SolutionsGallery` with
 *      group / filter / sort / search. The headline browse-all view.
 *   2. "Job Family roster" — `OperatingModelSection` (L2 → L3 → AI
 *      Solutions). The structural "where does each solution sit"
 *      view, useful in workshops.
 *   3. "Feasibility roster" — `AiRoadmapV6` grouped by binary
 *      Proven pattern / New build feasibility.
 *
 * Under v5 the gallery tab is hidden (it's V6-only); we fall back to
 * the legacy two-tab layout.
 *
 * Per-tower views never surface a P1/P2/P3 priority chip — program
 * priority is owned by the cross-tower 2x2 (feasibility × business
 * impact) and lives on the Cross-Tower AI Plan page, where rows from
 * all towers can be compared on a common scale.
 *
 * Every pane stays mounted (hidden via `hidden`) so internal state
 * (expanded rows, scroll, gallery filters) survives tab switches.
 *
 * The administrative chrome — `StaleCurationBanner` and the
 * `RegenerateAiGuidanceToolbar` — was relocated to the
 * `TowerLeadDrawer` on the page above so the tabs don't compete with
 * AI content for above-the-fold real estate.
 */
export function AiInitiativesTabs({ tower }: { tower: Tower }) {
  const tabs = IS_V6 ? TABS_V6 : TABS_V5;
  const defaultTab: TabId = IS_V6 ? "gallery" : "capability";
  const [active, setActive] = React.useState<TabId>(defaultTab);

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="AI initiatives view"
        className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap"
      >
        {tabs.map((t) => {
          const selected = t.id === active;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`ai-initiatives-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`ai-initiatives-panel-${t.id}`}
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

      {IS_V6 ? (
        <div
          role="tabpanel"
          id="ai-initiatives-panel-gallery"
          aria-labelledby="ai-initiatives-tab-gallery"
          hidden={active !== "gallery"}
        >
          <SolutionsGallery tower={tower} />
        </div>
      ) : null}

      <div
        role="tabpanel"
        id="ai-initiatives-panel-capability"
        aria-labelledby="ai-initiatives-tab-capability"
        hidden={active !== "capability"}
      >
        <OperatingModelSection tower={tower} showRoadmap={false} />
      </div>

      <div
        role="tabpanel"
        id="ai-initiatives-panel-roadmap"
        aria-labelledby="ai-initiatives-tab-roadmap"
        hidden={active !== "roadmap"}
        className="space-y-4"
      >
        <p className="max-w-3xl text-sm text-forge-subtle">
          AI-eligible {IS_V6 ? "Solutions" : "activities"} grouped by
          ship-readiness for this tower. Final program priority (P1 / P2 /
          P3) is set on the{" "}
          <span className="font-medium text-forge-body">
            Cross-Tower AI Plan
          </span>{" "}
          via the feasibility × business-impact 2x2. Click any card for the
          full four-lens design.
        </p>
        {IS_V6 ? <AiRoadmapV6 tower={tower} /> : <AiRoadmap tower={tower} />}
      </div>
    </div>
  );
}
