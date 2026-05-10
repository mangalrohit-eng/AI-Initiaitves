"use client";

import * as React from "react";
import { ChevronDown, Settings2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Tower } from "@/data/types";
import type { TowerId } from "@/data/assess/types";
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
 * Hosts the workshop-power-user AI-curation pipeline organised as a
 * three-step sequence so the run order is unmistakable:
 *
 *   1. Import tower AI readiness intake — Versant questionnaire context
 *      that conditions the LLM on the next step.
 *   2. Regenerate AI guidance — re-runs the L3 Job Family scoring to
 *      produce the AI Solutions list.
 *   3. Generate AI Solution briefs — fills the per-Solution six-section
 *      narratives shown on the detail page.
 *
 * Tower data exports (the Step 4 / Step 1 / Step 2 CSV download) do NOT
 * live here — they sit at the top of the page next to the journey
 * stepper to match the inline placement on Capability Map and Impact
 * Levers, where exports are an always-available affordance rather than
 * a workshop-mode tool.
 *
 * The journey stepper and the tower-lead sign-off also live above the
 * drawer (next to the hero) for the same chrome-consistency reason.
 *
 * The `StaleCurationBanner` is mounted inside the drawer header (always
 * visible, ignoring open/close) so the "your map is out of date" prompt
 * stays loud — it auto-opens the drawer in that state via the
 * one-shot auto-open flag below. It targets only the queued (stale)
 * Job Families; Step 2's "Regenerate AI guidance" rebuilds every
 * eligible row and is meant for a clean redo after an intake change.
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
              Facilitator-only. Intake &rsaquo; Regenerate AI guidance &rsaquo; Generate briefs.
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
            <ol className="space-y-3 px-4 py-4">
              <DrawerStep
                index={1}
                title="Import tower AI readiness intake"
                helper="Optional. Tower questionnaire context for the next step."
              >
                <TowerReadinessIntakePanel tower={tower} compact />
              </DrawerStep>
              <DrawerStep
                index={2}
                title="Regenerate AI guidance"
                helper="Rebuilds AI Solutions for every eligible L3 Job Family. Use the amber banner above for a queued-only refresh after a capability-map edit."
              >
                <RegenerateAiGuidanceToolbar towerId={towerId} />
              </DrawerStep>
              <DrawerStep
                index={3}
                title="Generate AI Solution briefs"
                helper="Fills the six-section narrative for each AI Solution. Runs sequentially, 30–90s per brief."
              >
                <BulkGenerateBriefsToolbar towerId={towerId} compact />
              </DrawerStep>
            </ol>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

/**
 * Numbered step shell for the AI-curation pipeline inside the drawer.
 *
 * Renders a JetBrains-mono `1 / 2 / 3` chip on the left (neutral border
 * + accent-purple — the priority palette of red/amber/teal is reserved
 * for P1/P2/P3 and must not be reused here), a one-line title, a single
 * helper sentence, and the supplied tool below. The shell is the ONLY
 * place the heading is rendered — child tools render in their `compact`
 * mode (where applicable) so the heading isn't duplicated.
 */
function DrawerStep({
  index,
  title,
  helper,
  children,
}: {
  index: number;
  title: string;
  helper: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-xl border border-forge-border bg-near-black/30 p-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-accent-purple/40 bg-accent-purple/10 font-mono text-xs font-semibold text-accent-purple-light"
        >
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-semibold text-forge-ink">
            {title}
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-forge-subtle">
            {helper}
          </p>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </li>
  );
}
