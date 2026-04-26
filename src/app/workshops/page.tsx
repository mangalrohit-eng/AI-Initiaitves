import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoonPage } from "@/components/program/ComingSoonPage";
import { getProductById } from "@/config/products";

export const metadata: Metadata = {
  title: "Workshops — Versant Forge Program",
  description:
    "Facilitator-led tower workshops with agenda, attendance, and decision logs — the connective tissue between the Capability Map and the Assessment.",
};

export default function WorkshopsPage() {
  const product = getProductById("workshops");
  if (!product) notFound();
  return <ComingSoonPage product={product} />;
}
