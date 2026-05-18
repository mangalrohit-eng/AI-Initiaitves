import type { Metadata } from "next";
import { OutcomeClusterDetailClient } from "@/components/program/crossTower/outcome/OutcomeClusterDetailClient";

export const metadata: Metadata = {
  title: "Outcome cluster brief | Versant Forge Program",
  description:
    "Cross-tower outcome cluster brief — narrative, headline metric, discrete AI initiatives, anchored tower-specific AI Solutions, modeled $ rollup, agent footprint, and build-vs-buy mix.",
};

type Params = { clusterId: string };

export default function OutcomeClusterPage({ params }: { params: Params }) {
  return <OutcomeClusterDetailClient clusterId={params.clusterId} />;
}
