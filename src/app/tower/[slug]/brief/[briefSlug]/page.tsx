import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { ProcessBriefCard } from "@/components/processes/ProcessBriefCard";
import { ShareBar } from "@/components/ui/ShareBar";
import { ViewTracker } from "@/components/collab/ViewTracker";
import { processBriefs } from "@/data/processBriefs";
import { findProcessBrief, getEvidenceForBrief, getTowerBySlug } from "@/lib/utils";
import { briefDetailStaticLine } from "@/lib/guidance/resolveTowerJourneyGuidance";
import { ScreenGuidanceBar } from "@/components/guidance/ScreenGuidanceBar";

export function generateStaticParams() {
  return processBriefs.map((b) => ({ slug: b.towerSlug, briefSlug: b.id }));
}

export default function ProcessBriefPage({
  params,
}: {
  params: { slug: string; briefSlug: string };
}) {
  const tower = getTowerBySlug(params.slug);
  const brief = findProcessBrief(params.briefSlug);
  if (!tower || !brief || brief.towerSlug !== tower.id) notFound();

  const parentInitiative = tower.processes.find((p) => p.id === brief.parentProcessId);

  const briefGuidance = briefDetailStaticLine(brief.name, tower.name);

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: tower.name, href: `/tower/${tower.id}` },
              { label: brief.name },
            ]}
          />
          <ShareBar
            title={brief.name}
            pin={{
              kind: "brief",
              id: brief.id,
              href: `/tower/${tower.id}/brief/${brief.id}`,
              title: brief.name,
              subtitle: tower.name,
            }}
          />
        </div>
        <ViewTracker
          kind="brief"
          id={brief.id}
          href={`/tower/${tower.id}/brief/${brief.id}`}
          title={brief.name}
          subtitle={tower.name}
        />
        <ScreenGuidanceBar guidance={briefGuidance} className="mt-3" />
        <div className="mt-6">
          <ProcessBriefCard
            brief={brief}
            tower={tower}
            parentInitiative={parentInitiative}
            evidence={getEvidenceForBrief(brief.id)}
          />
        </div>
      </div>
    </PageShell>
  );
}
