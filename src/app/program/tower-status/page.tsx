import type { Metadata } from "next";
import { TowerStepTrackerClient } from "@/components/program/TowerStepTrackerClient";

export const metadata: Metadata = {
  title: "Tower step status | Versant Forge Program",
  description:
    "Program-wide view of Accenture tower leads and completion across Steps 1–4 (capability map through AI initiatives).",
};

export default function TowerStepStatusPage() {
  return <TowerStepTrackerClient />;
}
