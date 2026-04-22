"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Tower } from "@/data/types";
import { WorkCategoryCard } from "./WorkCategoryCard";
import { ProcessLandscape } from "./ProcessLandscape";
import { AiRoadmap } from "./AiRoadmap";
import { operatingModelTotals } from "@/lib/utils";

export function OperatingModelSection({ tower }: { tower: Tower }) {
  const [activeId, setActiveId] = useState<string>(tower.workCategories[0]?.id ?? "");
  const totals = operatingModelTotals(tower);
  const active = tower.workCategories.find((c) => c.id === activeId) ?? tower.workCategories[0];

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-forge-ink">Operating model</h2>
            <p className="mt-1 text-sm text-forge-subtle">
              <span className="font-medium text-forge-ink">{totals.categoryCount}</span> work categories ·{" "}
              <span className="font-medium text-forge-ink">{totals.processCount}</span> processes ·{" "}
              <span className="font-medium text-accent-purple-dark">{totals.aiEligibleCount}</span> AI-eligible ·{" "}
              <span className="text-forge-body">{totals.notEligibleCount} human-led</span>
            </p>
          </div>
          <p className="max-w-xl text-xs text-forge-subtle">
            Every process the tower owns — AI-eligible and human-led — is mapped here. Select a
            category to see its full landscape, then follow the priority overlay into the initiative
            detail.
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
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-forge-ink">Process landscape</h3>
              <p className="mt-1 text-sm text-forge-subtle">
                All processes in <span className="font-medium text-forge-ink">{active.name}</span>, with
                frequency, criticality, maturity, and AI priority. Non-AI processes show the analytical
                rationale.
              </p>
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
    </div>
  );
}
