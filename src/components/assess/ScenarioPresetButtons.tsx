"use client";

import * as React from "react";
import { Cpu, Gauge, ShieldCheck } from "lucide-react";
import {
  SCENARIO_PRESETS,
  SCENARIO_PRESET_ORDER,
  type ScenarioPresetId,
} from "@/data/assess/scenarioPresets";
import type { TowerId } from "@/data/assess/types";
import { setTowerScenario } from "@/lib/localStore";
import { useToast } from "@/components/feedback/ToastProvider";
import { cn } from "@/lib/utils";

type Props = {
  /** When provided, preset clicks only update this tower's scenario. */
  scopeTowerId?: TowerId;
  /** When omitted, the buttons apply the preset across every tower with values. */
  className?: string;
  size?: "sm" | "md";
};

/**
 * Conservative / Base / Aggressive scenario presets.
 *
 * Single click rewrites the scenario dials (per-tower or program-wide). Anchored
 * to the values in `src/data/assess/scenarioPresets.ts` which are themselves
 * Versant-aware (BB- credit floor in Conservative, every addressable lever in
 * Aggressive).
 */
export function ScenarioPresetButtons({ scopeTowerId, className, size = "md" }: Props) {
  const toast = useToast();
  const apply = (id: ScenarioPresetId) => {
    const preset = SCENARIO_PRESETS[id];
    if (scopeTowerId) {
      const v = preset.values[scopeTowerId];
      if (!v) {
        toast.info({
          title: `${preset.label} preset has no value for this tower`,
          description: "Falling back to existing scenario dials.",
        });
        return;
      }
      setTowerScenario(scopeTowerId, v);
      toast.success({
        title: `${preset.label} applied`,
        description: `Offshore ${v.scenarioOffshorePct}% · AI ${v.scenarioAIPct}%`,
      });
      return;
    }
    let updated = 0;
    for (const [tid, v] of Object.entries(preset.values) as Array<[TowerId, { scenarioOffshorePct: number; scenarioAIPct: number }]>) {
      setTowerScenario(tid, v);
      updated += 1;
    }
    toast.success({
      title: `${preset.label} applied to ${updated} towers`,
      description: preset.blurb,
    });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="font-mono text-[11px] uppercase tracking-wider text-forge-hint">
        Scenarios
      </span>
      {SCENARIO_PRESET_ORDER.map((id) => {
        const p = SCENARIO_PRESETS[id];
        const Icon = id === "conservative" ? ShieldCheck : id === "base" ? Gauge : Cpu;
        return (
          <button
            key={id}
            type="button"
            onClick={() => apply(id)}
            title={p.blurb}
            className={cn(
              "group inline-flex items-center gap-1.5 rounded-full border transition",
              size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
              "border-forge-border bg-forge-surface text-forge-body hover:border-accent-purple/40 hover:text-forge-ink",
            )}
          >
            <Icon className="h-3 w-3 text-accent-purple-dark" aria-hidden />
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
