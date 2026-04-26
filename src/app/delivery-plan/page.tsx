import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoonPage } from "@/components/program/ComingSoonPage";
import { getProductById } from "@/config/products";

export const metadata: Metadata = {
  title: "Delivery Plan — Versant Forge Program",
  description:
    "The end-to-end Accenture delivery plan: scope per tower, sequencing across waves, effort, run-rate cost, value tracking against the $2.43B adj. EBITDA commitments, and the governance to keep the brand intact.",
};

export default function DeliveryPlanPage() {
  const product = getProductById("delivery-plan");
  if (!product) notFound();
  return <ComingSoonPage product={product} />;
}
