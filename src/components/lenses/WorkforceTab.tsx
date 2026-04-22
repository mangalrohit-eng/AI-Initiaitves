"use client";

import type { Process } from "@/data/types";
import { motion } from "framer-motion";

function RoleCard({
  title,
  roles,
  tone,
}: {
  title: string;
  roles: Process["workforce"]["pre"];
  tone: "muted" | "vibrant";
}) {
  return (
    <div
      className={
        tone === "muted"
          ? "rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm"
          : "rounded-2xl border border-forge-border border-l-4 border-l-accent-purple bg-forge-surface p-4 shadow-sm"
      }
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-forge-hint">{title}</div>
      <div className="mt-3 space-y-4">
        {roles.map((r) => (
          <div key={r.role} className="rounded-xl border border-forge-border bg-forge-well p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold text-forge-ink">{r.role}</div>
              <div className="font-mono text-xs text-forge-subtle">{r.headcount}</div>
            </div>
            <div className="mt-2 text-xs text-forge-subtle">{r.primaryActivities.join(" · ")}</div>
            <div className="mt-3 space-y-1">
              {Object.entries(r.timeAllocation).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <div className="w-28 truncate text-[11px] text-forge-hint">{k}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-forge-well-strong">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${v}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className={
                        tone === "muted" ? "h-full bg-forge-border-strong" : "h-full bg-gradient-to-r from-accent-purple-dark to-accent-purple"
                      }
                    />
                  </div>
                  <div className="w-10 text-right font-mono text-[11px] text-forge-body">{v}%</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-forge-hint">Skills: {r.skillsRequired.join(", ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkforceTab({ process }: { process: Process }) {
  const { workforce } = process;
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <RoleCard title="Pre-state roles" roles={workforce.pre} tone="muted" />
        <RoleCard title="Post-state roles" roles={workforce.post} tone="vibrant" />
      </div>
      <div className="rounded-2xl border border-forge-border border-l-4 border-l-accent-purple bg-forge-well p-4 text-sm text-forge-body">
        <span className="font-semibold text-forge-ink">Net FTE impact: </span>
        {workforce.netFTEImpact}
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-forge-hint">Key shifts</div>
        <ul className="mt-2 space-y-2 text-sm text-forge-body">
          {workforce.keyShifts.map((k) => (
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
