"use client";

import * as React from "react";
import { ChevronDown, Settings2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Tower } from "@/data/types";
import type { TowerId } from "@/data/assess/types";
import { TowerDataExports } from "@/components/assess/TowerDataExports";
import { TowerReadinessIntakePanel } from "@/components/operatingModel/TowerReadinessIntakePanel";
import { RegenerateAiGuidanceToolbar } from "@/components/operatingModel/RegenerateAiGuidanceToolbar";
import { StaleCurationBanner } from "@/components/operatingModel/StaleCurationBanner";
import {
  BulkGenerateBriefsToolbar,
  useBulkBriefSummary,
} from "@/components/towers/BulkGenerateBriefsToolbar";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "workshop-tools-drawer-open-v1";
/**
 * Per-tower flag for the "auto-open the drawer once when uncached briefs
 * are detected" experience. We only auto-open the FIRST time on a given
 * tower so the drawer doesn't fight the user every visit — once they've
 * dismissed it, it stays put.
 */
const AUTO_OPEN_KEY_PREFIX = "workshop-tools-drawer-autoopen-v1::";

/**
 * Collapsible "facilitator-only" controls drawer for Step 4.
 *
 * Hosts the workshop-power-user tools — data exports, AI readiness
 * intake import, manual regenerate AI guidance — out of the way of
 * the page's headline content (hero, KPIs, gallery), so a tower lead
 * doesn't have to scroll past them on every visit.
 *
 * The journey stepper and the tower-lead sign-off explicitly do NOT
 * live here — those moved to the top of the page (next to the hero)
 * to match the chrome ordering on Capability Map and Impact Levers.
 *
 * The `StaleCurationBanner` is mounted INSIDE the drawer header
 * (always visible, ignoring open/close) so the "your map is out of
 * date" prompt stays loud — it auto-opens the drawer in that state
 * via `forceOpen`-style coupling.
 *
 * Drawer open/close state is persisted per session in `localStorage`.
 */
export function WorkshopToolsDrawer({
  tower,
  className,
}: {
  tower: Tower;
  className?: string;
}) {
  const towerId = tower.id as TowerId;
  const [open, setOpen] = React.useState(false);
  const briefSummary = useBulkBriefSummary(towerId);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setOpen(true);
    } catch {
      // localStorage unavailable; default closed.
    }
  }, []);

  // One-shot auto-open: the first time a tower has uncached briefs (or
  // stale ones), pop the drawer open so the bulk generator is visible
  // without forcing the lead to discover the collapsed control. We
  // remember the auto-open per tower so it only happens once — repeat
  // visits respect the user's manual collapse.
  React.useEffect(() => {
    if (briefSummary.totalInitiatives === 0) return;
    if (briefSummary.missingCount === 0 && briefSummary.staleCount === 0) {
      return;
    }
    try {
      const key = AUTO_OPEN_KEY_PREFIX + towerId;
      if (window.localStorage.getItem(key) === "1") return;
      window.localStorage.setItem(key, "1");
      setOpen(true);
    } catch {
      // No localStorage — auto-open every visit instead of crashing.
      setOpen(true);
    }
  }, [briefSummary.missingCount, briefSummary.staleCount, briefSummary.totalInitiatives, towerId]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch {
      // ignore quota / disabled localStorage
    }
  }, [open]);

  const pendingCount = briefSummary.missingCount + briefSummary.staleCount;

  return (
    <section
      aria-label="Workshop facilitator tools"
      className={cn(
        "rounded-2xl border border-forge-border bg-forge-surface/40",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition",
          "hover:bg-forge-well/40",
          open ? "rounded-t-2xl border-b border-forge-border/60" : "rounded-2xl",
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-forge-border bg-near-black/40 text-forge-body">
            <Settings2 className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-sm font-semibold text-forge-ink">
                Workshop tools
              </span>
              {pendingCount > 0 ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-accent-purple/40 bg-accent-purple/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-purple-light"
                  title={`${briefSummary.missingCount} missing brief${
                    briefSummary.missingCount === 1 ? "" : "s"
                  }${briefSummary.staleCount > 0 ? `, ${briefSummary.staleCount} stale` : ""}`}
                >
                  <Sparkles className="h-2.5 w-2.5" aria-hidden />
                  {pendingCount} brief{pendingCount === 1 ? "" : "s"} to generate
                </span>
              ) : null}
            </div>
            <div className="text-[11px] text-forge-subtle">
              Bulk generate AI Solution briefs, exports, intake import, and
              regenerate AI guidance — for facilitators only.
            </div>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-forge-hint transition-transform",
            open ? "rotate-180" : "rotate-0",
          )}
          aria-hidden
        />
      </button>
      <div className="border-b border-forge-border/40 px-4 py-2">
        <StaleCurationBanner towerId={towerId} hideTitle />
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 px-4 py-4">
              <BulkGenerateBriefsToolbar towerId={towerId} />
              <TowerDataExports tower={tower} />
              <TowerReadinessIntakePanel tower={tower} />
              <div className="flex justify-end">
                <RegenerateAiGuidanceToolbar towerId={towerId} />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
