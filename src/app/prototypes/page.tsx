import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoonPage } from "@/components/program/ComingSoonPage";
import { getProductById } from "@/config/products";

export const metadata: Metadata = {
  title: "Prototypes — Versant Forge Program",
  description:
    "Working agent prototypes that prove the highest-impact initiatives — Reconciliation Agent for Finance close, Editorial Standards co-pilot for News, ad sales pipeline scoring on the new direct-to-advertiser model — before scale.",
};

export default function PrototypesPage() {
  const product = getProductById("prototypes");
  if (!product) notFound();
  return <ComingSoonPage product={product} />;
}
