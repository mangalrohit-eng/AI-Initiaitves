import type { Metadata } from "next";
import { Suspense } from "react";
import { AssumptionsClient } from "@/components/assess/AssumptionsClient";

export const metadata: Metadata = {
  title: "Assumptions — Versant Forge Program",
  description:
    "Workshop-level globals — blended FTE rates, contractor rates, lever weights, combine mode, and cap — that drive every modeled dollar in Configure Impact Levers and the Impact Estimate.",
};

export default function AssumptionsPage() {
  return (
    <Suspense fallback={<div className="px-6 py-12 text-sm text-forge-subtle">Loading...</div>}>
      <AssumptionsClient />
    </Suspense>
  );
}
