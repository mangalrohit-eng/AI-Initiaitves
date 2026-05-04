"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, X } from "lucide-react";
import {
  CROSS_TOWER_DECK_STORAGE_KEY,
  parseDeckPayloadJson,
  type CrossTowerDeckPayload,
} from "@/lib/cross-tower/deckPayload";
import { CrossTowerDeckDocument } from "./CrossTowerDeckDocument";

export function CrossTowerDeckClient() {
  const router = useRouter();
  const [phase, setPhase] = React.useState<
    "loading" | "ready" | "error"
  >("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [payload, setPayload] = React.useState<CrossTowerDeckPayload | null>(
    null,
  );

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(CROSS_TOWER_DECK_STORAGE_KEY);
      const parsed = parseDeckPayloadJson(raw);
      if (!parsed.ok) {
        setError(parsed.error);
        setPhase("error");
        return;
      }
      // Do not removeItem here: React Strict Mode re-runs this effect in dev;
      // a second run would see an empty store. The next Export overwrites the key.
      setPayload(parsed.payload);
      setPhase("ready");
    } catch {
      setError("Could not read deck data.");
      setPhase("error");
    }
  }, []);

  const handlePrint = React.useCallback(() => {
    void (async () => {
      if (typeof document !== "undefined" && document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch {
          /* ignore */
        }
      }
      window.print();
    })();
  }, []);

  if (phase === "loading") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-sm text-forge-subtle">
        Loading deck…
      </div>
    );
  }

  if (phase === "error" || !payload) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="font-display text-xl font-semibold text-forge-ink">Deck unavailable</h1>
        <p className="mt-3 text-sm text-forge-body">{error}</p>
        <Link
          href="/program/cross-tower-ai-plan"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-accent-purple-dark underline-offset-4 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Cross-Tower AI Plan
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forge-page pb-24 print:bg-white print:pb-0">
      <div className="no-print sticky top-0 z-20 border-b border-forge-border bg-forge-surface/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg border border-accent-purple/40 bg-accent-purple/10 px-3 py-2 text-sm font-medium text-accent-purple-dark transition hover:bg-accent-purple/15"
            >
              <Printer className="h-4 w-4" aria-hidden />
              Print deck
            </button>
            <Link
              href="/program/cross-tower-ai-plan"
              className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-well/40 px-3 py-2 text-sm font-medium text-forge-body transition hover:border-forge-border-strong"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to plan
            </Link>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-lg border border-forge-border px-3 py-2 text-sm text-forge-subtle hover:text-forge-body"
              aria-label="Close and go back"
            >
              <X className="h-4 w-4" aria-hidden />
              Close
            </button>
          </div>
          <p className="max-w-md text-right text-[11px] leading-snug text-forge-hint">
            In the print dialog, choose <span className="font-semibold">Save as PDF</span>, disable
            browser headers/footers if possible, and confirm paper size matches slide (4:3).
          </p>
        </div>
      </div>

      <CrossTowerDeckDocument payload={payload} />
    </div>
  );
}
