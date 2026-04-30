import type { Metadata } from "next";
import { Suspense } from "react";
import { AssessmentSummaryClient } from "@/components/assess/AssessmentSummaryClient";

export const metadata: Metadata = {
  title: "Impact Estimate — Versant Forge Program",
  description:
    "Live program-wide impact, scenario presets, per-tower lever cards, and a print-ready snapshot for leadership decks.",
};

export default function ImpactEstimateSummaryPage() {
  return (
    <Suspense fallback={<div className="px-6 py-12 text-sm text-forge-subtle">Loading...</div>}>
      <AssessmentSummaryClient />
    </Suspense>
  );
}
