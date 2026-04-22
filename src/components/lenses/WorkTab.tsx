"use client";

import type { Process } from "@/data/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

function Steps({
  label,
  tone,
  description,
  steps,
  meta,
}: {
  label: string;
  tone: "muted" | "vibrant";
  description: string;
  steps: Process["work"]["pre"]["steps"];
  meta: Pick<Process["work"]["pre"], "avgCycleTime" | "touchpoints" | "errorRate">;
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-forge-surface p-4 sm:p-5 shadow-sm",
        tone === "muted" ? "border-forge-border" : "border-forge-border border-l-4 border-l-accent-purple",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-display text-sm font-semibold tracking-wide text-forge-ink">{label}</div>
        <div className="text-[11px] text-forge-hint">{meta.avgCycleTime}</div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-forge-body">{description}</p>
      <div className="mt-4 space-y-3">
        {steps.map((s, idx) => (
          <motion.div
            key={s.step}
            initial={{ opacity: 0, x: tone === "muted" ? -8 : 8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ delay: idx * 0.05, duration: 0.25 }}
            className="relative rounded-xl border border-forge-border bg-forge-well p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs font-mono text-forge-hint">#{s.step}</div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  s.isManual ? "bg-forge-well-strong text-forge-subtle" : "bg-forge-surface text-emerald-800 ring-1 ring-emerald-200",
                )}
              >
                {s.isManual ? "Manual" : "Automated"}
              </span>
            </div>
            <div className="mt-2 text-sm text-forge-ink">{s.action}</div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-forge-subtle">
              <span>Owner: {s.owner}</span>
              <span className="font-mono text-forge-body">{s.duration}</span>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-forge-subtle sm:grid-cols-3">
        <div>
          <div className="text-forge-hint">Touchpoints</div>
          <div className="font-mono text-sm text-forge-ink">{meta.touchpoints}</div>
        </div>
        <div>
          <div className="text-forge-hint">Error rate</div>
          <div className="font-mono text-sm text-forge-ink">{meta.errorRate}</div>
        </div>
        <div className="hidden sm:block" />
      </div>
    </div>
  );
}

export function WorkTab({ process }: { process: Process }) {
  const { work } = process;
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Steps label="Pre-state" tone="muted" description={work.pre.description} steps={work.pre.steps} meta={work.pre} />
        <Steps label="Post-state" tone="vibrant" description={work.post.description} steps={work.post.steps} meta={work.post} />
      </div>
      <div className="hidden items-center justify-center text-accent-purple lg:flex">
        <div className="flex items-center gap-2 rounded-full border border-forge-border bg-forge-well px-4 py-2 text-xs text-forge-body">
          Transformation <ArrowRight className="h-4 w-4 text-accent-purple" />
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-forge-hint">Key shifts</div>
        <ul className="mt-2 space-y-2 text-sm text-forge-body">
          {work.keyShifts.map((k) => (
            <li key={k} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-purple" />
              <span>{k}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
