"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, CircleDot, Loader2, RefreshCw, Wifi } from "lucide-react";
import { useAssessSync, type SaveState } from "@/components/assess/AssessSyncProvider";

// Routes that mount `AssessSyncProvider` — kept in lockstep with the layouts
// at `app/{capability-map,impact-levers,assumptions,tower}/layout.tsx`. The
// tower routes were added when the AI Initiatives validate/reject feature
// landed; without them in this regex, Tower Leads got no save-status feedback
// when their decisions hit the cloud.
const ASSESS_PATH = /^\/(assess|capability-map|assessment|impact-levers|assumptions|tower)(\/|$)/;

/**
 * Compact save-status indicator. Renders only on assess-aware routes and
 * only when there's actually save lifecycle to report (pending / saving /
 * saved / error / local-only). Returns null in idle state so we don't add
 * ambient noise.
 *
 * Designed to be placed in a sticky strip under the TopNav.
 */
export function SaveStatusPill() {
  const pathname = usePathname();
  const sync = useAssessSync();

  if (!pathname || !ASSESS_PATH.test(pathname)) return null;
  if (!sync) return null;

  const pill = renderPill(sync.canSync ? sync.saveState : "local-only", {
    lastSaveError: sync.lastSaveError,
    onRetry: sync.flushSave,
  });
  if (!pill) return null;

  return (
    <div className="no-print sticky top-[64px] z-30 border-b border-forge-border/60 bg-forge-page/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-end gap-3 px-4 py-1.5 sm:px-6 lg:px-8">
        {pill}
      </div>
    </div>
  );
}

type RenderState = SaveState | "local-only";

function renderPill(
  state: RenderState,
  ctx: { lastSaveError: string | null; onRetry: () => Promise<void> },
): React.ReactNode {
  switch (state) {
    case "local-only":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-forge-border bg-forge-well/60 px-2.5 py-1 text-[11px] font-medium text-forge-subtle"
          title="No database configured. Assessment changes stay in this browser only."
        >
          <Wifi className="h-3 w-3" aria-hidden />
          <span className="hidden sm:inline">Local only · changes not shared</span>
        </span>
      );
    case "pending":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-accent-amber/40 bg-accent-amber/10 px-2.5 py-1 text-[11px] font-medium text-forge-body"
          aria-live="polite"
        >
          <CircleDot className="h-3 w-3 text-accent-amber" aria-hidden />
          <span>Unsaved changes</span>
        </span>
      );
    case "saving":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-1 text-[11px] font-medium text-forge-body"
          aria-live="polite"
        >
          <Loader2 className="h-3 w-3 animate-spin text-accent-purple-dark" aria-hidden />
          <span>Saving</span>
        </span>
      );
    case "saved":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-accent-green/40 bg-accent-green/10 px-2.5 py-1 text-[11px] font-medium text-forge-body"
          aria-live="polite"
        >
          <CheckCircle2 className="h-3 w-3 text-accent-green" aria-hidden />
          <span>Saved</span>
        </span>
      );
    case "error":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-accent-red/40 bg-accent-red/10 px-2.5 py-1 text-[11px] font-medium text-forge-ink"
          role="alert"
          title={ctx.lastSaveError ?? undefined}
        >
          <RefreshCw className="h-3 w-3 text-accent-red" aria-hidden />
          <span>Save failed</span>
          <button
            type="button"
            onClick={() => void ctx.onRetry()}
            className="ml-1 underline hover:text-accent-red"
          >
            Retry
          </button>
        </span>
      );
    case "idle":
    default:
      return null;
  }
}
