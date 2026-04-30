import type { Metadata } from "next";
import { OffshorePlanClient } from "@/components/program/offshore/OffshorePlanClient";

export const metadata: Metadata = {
  title: "Offshore Plan — Versant Forge Program",
  description:
    "Step 5 of the program. Translate the offshore dials from Configure Impact Levers into Accenture's committed proposal: an India-anchored managed-service GCC delivered in three TSA-paced waves, with editorial / talent / SOX-year-1 / BB- covenant carve-outs.",
};

export default function OffshorePlanPage() {
  return <OffshorePlanClient />;
}
