import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoonPage } from "@/components/program/ComingSoonPage";
import { getProductById } from "@/config/products";

export const metadata: Metadata = {
  title: "Offshore Plan — Versant Forge Program",
  description:
    "Translate the offshore dials from Capability Map into a delivery plan: target locations, role-by-role offshorability with editorial carve-outs, transition runway against the NBCU TSA, and estimated cost-to-serve.",
};

export default function OffshorePlanPage() {
  const product = getProductById("offshore-plan");
  if (!product) notFound();
  return <ComingSoonPage product={product} />;
}
