import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cross-Tower Deck | Versant Forge Program",
  description:
    "Print-optimized 4:3 executive deck for the Versant Forge cross-tower AI plan.",
};

export default function CrossTowerDeckLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
