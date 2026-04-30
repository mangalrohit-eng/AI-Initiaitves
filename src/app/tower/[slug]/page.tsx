import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Map } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TowerAiLeadToolbar } from "@/components/towers/TowerAiLeadToolbar";
import { HoursSavedBar } from "@/components/charts/HoursSavedBar";
import { PageShell } from "@/components/PageShell";
import { AiInitiativesTabs } from "@/components/operatingModel/AiInitiativesTabs";
import { InitiativeReviewChip } from "@/components/operatingModel/InitiativeReviewChip";
import { TowerHeader } from "@/components/towers/TowerHeader";
import { TowerAiJourneyGuidance } from "@/components/towers/TowerAiJourneyGuidance";
import { TowerDataExports } from "@/components/assess/TowerDataExports";
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

        <TowerAiLeadToolbar towerId={tower.id as TowerId} towerName={tower.name} />

        <TowerDataExports tower={tower} className="mt-3" />

        <TowerAiJourneyGuidance tower={tower} />

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

        <section className="mt-14 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-forge-ink">
                AI initiatives
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-forge-subtle">
                Explore this tower&apos;s AI program by capability (L2 → L4) or as
                a sequenced priority roadmap. Use the tabs to switch views — your
                selections are preserved.
              </p>
            </div>
            <InitiativeReviewChip tower={tower} />
          </div>
          <AiInitiativesTabs tower={tower} />
        </section>

        <section className="mt-14 space-y-3">
          <h2 className="font-display text-lg font-semibold text-forge-ink">
            Impact by AI initiative
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
