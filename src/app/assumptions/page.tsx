import type { Metadata } from "next";
import { Suspense } from "react";
import { AssumptionsClient } from "@/components/assess/AssumptionsClient";

export const metadata: Metadata = {
  title: "Methodology — Versant Forge Program",
  description:
    "How the savings model works — pool, offshore arbitrage, AI savings, sequential combine, and roll-up. Per-tower cost rates are edited on each tower's Configure Impact Levers page.",
};

export default function AssumptionsPage() {
  return (
    <Suspense fallback={<div className="px-6 py-12 text-sm text-forge-subtle">Loading...</div>}>
      <AssumptionsClient />
    </Suspense>
  );
}
