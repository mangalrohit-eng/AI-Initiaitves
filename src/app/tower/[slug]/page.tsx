import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Map } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TowerJourneyStepper } from "@/components/layout/TowerJourneyStepper";
import { HoursSavedBar } from "@/components/charts/HoursSavedBar";
import { PageShell } from "@/components/PageShell";
import { OperatingModelSection } from "@/components/operatingModel/OperatingModelSection";
import { AiRoadmap } from "@/components/operatingModel/AiRoadmap";
import { TowerHeader } from "@/components/towers/TowerHeader";
import { ShareBar } from "@/components/ui/ShareBar";
import { ViewTracker } from "@/components/collab/ViewTracker";
import { towers } from "@/data/towers";
import { getTowerBySlug } from "@/lib/utils";
import { getTowerHref } from "@/lib/towerHref";
import type { TowerId } from "@/data/assess/types";

export function generateStaticParams() {
  return towers.map((t) => ({ slug: t.id }));
}

export default function TowerPage({ params }: { params: { slug: string } }) {
  const tower = getTowerBySlug(params.slug);
  if (!tower) notFound();

  const chartData = tower.processes.map((p) => ({ name: p.name, impactTier: p.impactTier }));

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs
            items={[
              { label: "Program home", href: "/" },
              { label: "AI Initiatives", href: "/towers" },
              { label: tower.name },
            ]}
          />
          <ShareBar
            title={tower.name}
            pin={{
              kind: "tower",
              id: tower.id,
              href: `/tower/${tower.id}`,
              title: tower.name,
            }}
          />
        </div>
        <ViewTracker
          kind="tower"
          id={tower.id}
          href={`/tower/${tower.id}`}
          title={tower.name}
        />

        <TowerJourneyStepper
          className="mt-3"
          towerId={tower.id as TowerId}
          towerName={tower.name}
          current="ai-initiatives"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
          <Link
            href="/towers"
            className="inline-flex items-center gap-1 text-forge-subtle hover:text-forge-ink"
          >
            <ArrowLeft className="h-3 w-3" />
            All towers
          </Link>
          <Link
            href={getTowerHref(tower.id as TowerId, "capability-map")}
            className="inline-flex items-center gap-1.5 rounded-full border border-forge-border bg-forge-surface px-2.5 py-1 text-xs text-forge-body hover:border-accent-purple/40 hover:text-forge-ink"
            title="Update the capability map and offshore / AI dials for this tower"
          >
            <Map className="h-3 w-3 text-accent-purple-dark" />
            Update capability map
          </Link>
        </div>

        <div className="mt-6">
          <TowerHeader tower={tower} />
        </div>

        <section className="mt-14 space-y-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-forge-ink">
              AI transformation roadmap
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-forge-subtle">
              AI-eligible initiatives sequenced by readiness and impact — now (0–6mo), next
              (6–12mo), later (12–24mo). Click any card for the full four-lens design.
            </p>
          </div>
          <AiRoadmap tower={tower} />
        </section>

        <div className="mt-14">
          <OperatingModelSection tower={tower} showRoadmap={false} />
        </div>

        <section className="mt-14 space-y-3">
          <h2 className="font-display text-lg font-semibold text-forge-ink">
            Modeled impact by AI initiative
          </h2>
          <p className="text-sm text-forge-subtle">
            Qualitative High / Medium / Low tiers per initiative (not financial, hours, or FTE precision).
          </p>
          <div className="min-w-0 rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-card">
            <HoursSavedBar data={chartData} />
          </div>
        </section>
      </div>
    </PageShell>
  );
}
