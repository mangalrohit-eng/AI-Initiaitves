import type { Metadata } from "next";
import { CrossTowerAiPlanClient } from "@/components/program/crossTower/CrossTowerAiPlanClient";

export const metadata: Metadata = {
  title: "Cross-Tower AI Plan | Versant Forge Program",
  description:
    "The cross-tower 24-month AI plan for Versant Media Group: ranked initiatives, three-horizon implementation roadmap, technology and agent architecture, and modeled value buildup. Numerics deterministic; plan narrative authored by GPT-5.5.",
};

export default function CrossTowerAiPlanPage() {
  return <CrossTowerAiPlanClient />;
}
