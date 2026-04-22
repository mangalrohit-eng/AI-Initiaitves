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
        "relative rounded-2xl border p-4 sm:p-5",
        tone === "muted" ? "border-white/10 bg-white/[0.02] text-white/75" : "border-accent-purple/25 bg-accent-purple/[0.06] text-white/85",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-display text-sm font-semibold tracking-wide">{label}</div>
        <div className="text-[11px] text-white/45">{meta.avgCycleTime}</div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/65">{description}</p>
      <div className="mt-4 space-y-3">
        {steps.map((s, idx) => (
          <motion.div
            key={s.step}
            initial={{ opacity: 0, x: tone === "muted" ? -8 : 8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ delay: idx * 0.05, duration: 0.25 }}
            className="relative rounded-xl border border-white/10 bg-black/20 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs font-mono text-white/45">#{s.step}</div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  s.isManual ? "bg-white/10 text-white/60" : "bg-accent-teal/15 text-accent-teal",
                )}
              >
                {s.isManual ? "Manual" : "Automated"}
              </span>
            </div>
            <div className="mt-2 text-sm text-white/85">{s.action}</div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/55">
              <span>Owner: {s.owner}</span>
              <span className="font-mono text-white/70">{s.duration}</span>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-white/55 sm:grid-cols-3">
        <div>
          <div className="text-white/40">Touchpoints</div>
          <div className="font-mono text-sm text-white">{meta.touchpoints}</div>
        </div>
        <div>
          <div className="text-white/40">Error rate</div>
          <div className="font-mono text-sm text-white">{meta.errorRate}</div>
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
      <div className="hidden items-center justify-center text-accent-purple-light lg:flex">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/70">
          Transformation <ArrowRight className="h-4 w-4" />
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-white/45">Key shifts</div>
        <ul className="mt-2 space-y-2 text-sm text-white/75">
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
