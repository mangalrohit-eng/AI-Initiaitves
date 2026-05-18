import type { Metadata } from "next";
import { OutcomeInitiativeDetailClient } from "@/components/program/crossTower/outcome/OutcomeInitiativeDetailClient";

export const metadata: Metadata = {
  title: "Outcome initiative brief | Versant Forge Program",
  description:
    "Cross-tower discrete initiative brief — current state, future state, constituent AI Solutions, agent architecture, sourcing mix, dependencies, and reference architecture rolled up from the anchored tower-specific briefs.",
};

type Params = { clusterId: string; initiativeId: string };

export default function OutcomeInitiativePage({
  params,
}: {
  params: Params;
}) {
  return (
    <OutcomeInitiativeDetailClient
      clusterId={params.clusterId}
      initiativeId={params.initiativeId}
    />
  );
}
