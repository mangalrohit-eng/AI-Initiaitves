import type { Metadata } from "next";
import { Suspense } from "react";
import { AssessmentHubClient } from "@/components/assess/AssessmentHubClient";

export const metadata: Metadata = {
  title: "Assessment — Versant Forge Program",
  description:
    "Dial offshore and AI per L4 against the confirmed capability map. Live program-wide modeled impact with sensitivity bands.",
};

export default function AssessmentHubPage() {
  return (
    <Suspense fallback={<div className="px-6 py-12 text-sm text-forge-subtle">Loading...</div>}>
      <AssessmentHubClient />
    </Suspense>
  );
}
