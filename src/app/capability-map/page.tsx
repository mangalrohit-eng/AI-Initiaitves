import type { Metadata } from "next";
import { Suspense } from "react";
import { CapabilityMapHubClient } from "@/components/assess/CapabilityMapHubClient";

export const metadata: Metadata = {
  title: "Capability Map — Versant Forge Program",
  description:
    "Confirm the L1 to L4 capability tree and the headcount per tower. Step 1 of the workshop, sets the canvas for the Configure Impact Levers dials.",
};

export default function CapabilityMapHubPage() {
  return (
    <Suspense fallback={<div className="px-6 py-12 text-sm text-forge-subtle">Loading...</div>}>
      <CapabilityMapHubClient />
    </Suspense>
  );
}
