"use client";

import Link from "next/link";
import type { Tower } from "@/data/types";
import { formatHours } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

function Sparkline({ tower }: { tower: Tower }) {
  const values = tower.processes.map((p) => p.estimatedAnnualHoursSaved);
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-10 items-end gap-1">
      {values.slice(0, 8).map((v, i) => (
        <div
          key={i}
          className="w-1.5 rounded-sm bg-gradient-to-t from-accent-purple/20 to-accent-purple"
          style={{ height: `${Math.max(12, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function TowerCard({ tower, index }: { tower: Tower; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: "easeOut" }}
    >
      <Link href={`/tower/${tower.id}`} className="group block">
        <div className="relative rounded-2xl p-[1px] transition duration-300 group-hover:scale-[1.02] group-hover:shadow-glow">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent-purple via-accent-teal/40 to-accent-purple opacity-60 blur-[0.5px] transition group-hover:opacity-100" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#121225]/90 p-5 shadow-inner shadow-black/30">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent-purple/15 blur-3xl" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-lg font-semibold text-white">{tower.name}</div>
                <div className="mt-1 text-xs text-white/55">
                  Versant: {tower.versantLeads.join(", ")}
                </div>
                <div className="text-xs text-white/45">Accenture: {tower.accentureLeads.join(", ")}</div>
              </div>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-white/35 transition group-hover:text-accent-purple-light" />
            </div>

            <p className="mt-4 line-clamp-2 text-sm text-white/65">{tower.topOpportunityHeadline}</p>

            <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-white/45">AI processes</div>
                <div className="font-mono text-sm text-white">{tower.aiEligibleProcesses}</div>
              </div>
              <div>
                <div className="text-white/45">Hours / yr</div>
                <div className="font-mono text-sm text-white">{formatHours(tower.estimatedAnnualSavingsHours)}</div>
              </div>
              <div>
                <div className="text-white/45">Spark</div>
                <Sparkline tower={tower} />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
