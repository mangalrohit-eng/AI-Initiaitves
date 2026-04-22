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
          ? "rounded-2xl border border-white/10 bg-white/[0.02] p-4"
          : "rounded-2xl border border-accent-teal/20 bg-accent-teal/[0.05] p-4"
      }
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-white/45">{title}</div>
      <div className="mt-3 space-y-4">
        {roles.map((r) => (
          <div key={r.role} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold text-white">{r.role}</div>
              <div className="font-mono text-xs text-white/60">{r.headcount}</div>
            </div>
            <div className="mt-2 text-xs text-white/55">{r.primaryActivities.join(" · ")}</div>
            <div className="mt-3 space-y-1">
              {Object.entries(r.timeAllocation).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <div className="w-28 truncate text-[11px] text-white/45">{k}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${v}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className={tone === "muted" ? "h-full bg-white/25" : "h-full bg-gradient-to-r from-accent-teal to-accent-purple"}
                    />
                  </div>
                  <div className="w-10 text-right font-mono text-[11px] text-white/70">{v}%</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-white/45">Skills: {r.skillsRequired.join(", ")}</div>
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
      <div className="rounded-2xl border border-accent-purple/25 bg-gradient-to-r from-accent-purple/10 to-accent-teal/10 p-4 text-sm text-white/80">
        <span className="font-semibold text-white">Net FTE impact: </span>
        {workforce.netFTEImpact}
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-white/45">Key shifts</div>
        <ul className="mt-2 space-y-2 text-sm text-white/75">
          {workforce.keyShifts.map((k) => (
            <li key={k} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-teal" />
              <span>{k}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
