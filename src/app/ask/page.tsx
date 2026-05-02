import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { AskClient } from "@/components/ask/AskClient";

export const metadata: Metadata = {
  title: "Ask Forge · Versant Forge Program",
  description:
    "LLM-powered analyst for the Versant Forge Program. Ask about headcount, offshoring, modeled savings, P1 initiatives, and brand exposure across all 13 towers.",
};

export default function AskPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-4 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Forge Program", href: "/" },
            { label: "Ask Forge" },
          ]}
        />
        <div className="mt-3">
          <AskClient />
        </div>
      </div>
    </PageShell>
  );
}
