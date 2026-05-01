"use client";

import * as React from "react";
import { Layers, CalendarRange } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Tower } from "@/data/types";
import type { TowerId } from "@/data/assess/types";
import { OperatingModelSection } from "./OperatingModelSection";
import { AiRoadmap } from "./AiRoadmap";
import { StaleCurationBanner } from "./StaleCurationBanner";
import { RegenerateAiGuidanceToolbar } from "./RegenerateAiGuidanceToolbar";
import { cn } from "@/lib/utils";

type TabId = "capability" | "roadmap";

type TabDef = {
  id: TabId;
  label: string;
  hint: string;
  icon: LucideIcon;
};

const TABS: ReadonlyArray<TabDef> = [
  {
    id: "capability",
    label: "By capability",
    hint: "L2 → L5",
    icon: Layers,
  },
  {
    id: "roadmap",
    label: "Feasibility roster",
    hint: "Ship-ready / Investigate",
    icon: CalendarRange,
  },
];

/**
 * Hosts the per-tower AI Initiatives experience as two sub-tabs:
 *   - "By capability" (default) renders the V5 L2 → L3 → L4 → L5
 *     OperatingModelSection (L4 Activity Group cards expand to reveal
 *     the AI-eligible L5 Activities under each).
 *   - "Feasibility roster" renders AiRoadmap grouped by binary feasibility.
 *
 * Per-tower views never surface a P1/P2/P3 priority chip — program priority
 * is owned by the cross-tower 2x2 (feasibility × business impact) and lives
 * on the Cross-Tower AI Plan page, where rows from all towers can be
 * compared on a common scale.
 *
 * Both panes are always mounted and the inactive one is hidden via the
 * Tailwind `hidden` class so internal state inside OperatingModelSection
 * (expanded L4 Activity Group keys in ProcessLandscape) and AiRoadmap
 * survives tab switches — important for the user-experience feel of the
 * page.
 *
 * The StaleCurationBanner is hoisted up here from OperatingModelSection
 * so the program-level "L4 curation is stale" alert remains visible on
 * both tabs, not just the capability one. The banner self-`return null`s
 * when there's nothing stale, so it's a no-op when irrelevant.
 */
export function AiInitiativesTabs({ tower }: { tower: Tower }) {
  const [active, setActive] = React.useState<TabId>("capability");

  return (
    <div className="space-y-5">
      <StaleCurationBanner towerId={tower.id as TowerId} hideTitle />

      <RegenerateAiGuidanceToolbar towerId={tower.id as TowerId} />

      <div
        role="tablist"
        aria-label="AI initiatives view"
        className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap"
      >
        {TABS.map((t) => {
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
                  ? "border-accent-purple bg-forge-surface font-medium text-accent-purple-dark shadow-sm ring-1 ring-accent-purple/20"
                  : "border-forge-border bg-forge-well text-forge-body hover:border-forge-border-strong hover:text-forge-ink",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  selected ? "text-accent-purple" : "text-forge-hint",
                )}
                aria-hidden
              />
              <span>{t.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider",
                  selected
                    ? "bg-accent-purple/10 text-accent-purple-dark"
                    : "bg-forge-surface text-forge-hint",
                )}
              >
                {t.hint}
              </span>
            </button>
          );
        })}
      </div>

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
          AI-eligible activities grouped by ship-readiness for this tower.
          Final program priority (P1 / P2 / P3) is set on the{" "}
          <span className="font-medium text-forge-body">
            Cross-Tower AI Plan
          </span>{" "}
          via the feasibility × business-impact 2x2. Click any card for the
          full four-lens design.
        </p>
        <AiRoadmap tower={tower} />
      </div>
    </div>
  );
}
