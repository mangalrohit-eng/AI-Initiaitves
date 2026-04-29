import { Loader2 } from "lucide-react";
import { PageShell } from "@/components/PageShell";

/**
 * Shown during client navigation to the lazy LLM brief while the RSC shell loads.
 * (Generation still runs in the page — this only covers the route transition.)
 */
export default function LLMBriefRouteLoading() {
  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-2xl border border-forge-border bg-forge-surface/80 p-10 text-center">
          <Loader2
            className="h-10 w-10 animate-spin text-accent-purple"
            aria-hidden
          />
          <div>
            <p className="font-display text-lg font-semibold text-forge-ink">Opening LLM initiative</p>
            <p className="mt-2 max-w-md text-sm text-forge-subtle">
              Loading the view. A full four-lens brief is generated on first open (often 20–90 seconds) and
              is cached in your workshop.
            </p>
          </div>
          <p
            className="text-xs font-mono text-forge-hint"
            role="status"
            aria-live="polite"
          >
            Preparing page…
          </p>
        </div>
      </div>
    </PageShell>
  );
}
