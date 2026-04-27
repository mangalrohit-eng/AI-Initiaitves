"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Tower } from "@/data/types";
import { WorkCategoryCard } from "./WorkCategoryCard";
import { ProcessLandscape } from "./ProcessLandscape";
import { AiRoadmap } from "./AiRoadmap";
import { operatingModelTotals } from "@/lib/utils";

export function OperatingModelSection({
  tower,
  showRoadmap = true,
}: {
  tower: Tower;
  showRoadmap?: boolean;
}) {
  const [activeId, setActiveId] = useState<string>(tower.workCategories[0]?.id ?? "");
  const totals = operatingModelTotals(tower);
  const active = tower.workCategories.find((c) => c.id === activeId) ?? tower.workCategories[0];

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-forge-ink">
              L2 — Work categories
            </h2>
            <p className="mt-1 text-sm text-forge-subtle">
              <span className="font-medium text-forge-ink">{totals.categoryCount}</span> work categories ·{" "}
              <span className="font-medium text-forge-ink">{totals.processCount}</span> activities ·{" "}
              <span className="font-medium text-accent-purple-dark">{totals.aiEligibleCount}</span> AI-eligible ·{" "}
              <span className="text-forge-body">{totals.notEligibleCount} human-led</span>
            </p>
          </div>
          <p className="max-w-xl text-xs text-forge-subtle">
            Every L2 sub-function the tower owns. Select one to drop into its L3 activities and
            follow the priority overlay into the initiative detail.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tower.workCategories.map((c, i) => (
            <WorkCategoryCard
              key={c.id}
              category={c}
              index={i}
              active={active?.id === c.id}
              onSelect={() => setActiveId(c.id)}
            />
          ))}
        </div>
      </section>

      {active ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-forge-ink">
                L3 — Activities
              </h3>
              <p className="mt-1 text-sm text-forge-subtle">
                All L3 activities under <span className="font-medium text-forge-ink">{active.name}</span>,
                with frequency, criticality, maturity, and AI priority. Non-AI activities show the
                analytical rationale.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-forge-subtle">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-4 w-[3px] rounded-sm bg-accent-purple" aria-hidden />
                Full initiative
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-4 w-[3px] rounded-sm border-l-2 border-dashed border-accent-purple/70"
                  aria-hidden
                />
                Process brief
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-4 w-[3px] rounded-sm bg-forge-border" aria-hidden />
                Human-led
              </span>
            </div>
          </div>
          <motion.div
            key={active.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            <ProcessLandscape tower={tower} category={active} />
          </motion.div>
        </section>
      ) : null}

      {showRoadmap ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-forge-ink">AI transformation roadmap</h3>
              <p className="mt-1 text-sm text-forge-subtle">
                AI-eligible processes from every work category, sequenced by readiness and impact. Each
                card links to the four-lens initiative detail.
              </p>
            </div>
          </div>
          <AiRoadmap tower={tower} />
        </section>
      ) : null}
    </div>
  );
}
