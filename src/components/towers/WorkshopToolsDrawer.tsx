"use client";

import * as React from "react";
import { ChevronDown, Settings2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Tower } from "@/data/types";
import type { TowerId } from "@/data/assess/types";
import { TowerDataExports } from "@/components/assess/TowerDataExports";
import { TowerReadinessIntakePanel } from "@/components/operatingModel/TowerReadinessIntakePanel";
import { RegenerateAiGuidanceToolbar } from "@/components/operatingModel/RegenerateAiGuidanceToolbar";
import { StaleCurationBanner } from "@/components/operatingModel/StaleCurationBanner";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "workshop-tools-drawer-open-v1";

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

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setOpen(true);
    } catch {
      // localStorage unavailable; default closed.
    }
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch {
      // ignore quota / disabled localStorage
    }
  }, [open]);

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
            <div className="font-display text-sm font-semibold text-forge-ink">
              Workshop tools
            </div>
            <div className="text-[11px] text-forge-subtle">
              Data exports, intake import, and regenerate AI guidance —
              for facilitators only.
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
