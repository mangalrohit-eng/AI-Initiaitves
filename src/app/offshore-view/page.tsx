import type { Metadata } from "next";
import { Suspense } from "react";
import { OffshoreViewHubClient } from "@/components/assess/OffshoreViewHubClient";

export const metadata: Metadata = {
  title: "Offshore Plan — Versant Forge Program",
  description:
    "Step 2 of the assessment. Classify every L4 Activity Group as Retained vs GCC India against the confirmed capability map. Locks the offshore footprint that feeds the Configure Impact Levers dials.",
};

export default function OffshorePlanHubPage() {
  return (
    <Suspense fallback={<div className="px-6 py-12 text-sm text-forge-subtle">Loading...</div>}>
      <OffshoreViewHubClient />
    </Suspense>
  );
}
