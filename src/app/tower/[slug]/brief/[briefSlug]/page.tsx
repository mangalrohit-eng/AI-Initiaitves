import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { ProcessBriefCard } from "@/components/processes/ProcessBriefCard";
import { ShareBar } from "@/components/ui/ShareBar";
import { processBriefs } from "@/data/processBriefs";
import { getTowerBySlug, findProcessBrief } from "@/lib/utils";

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
          <ShareBar title={brief.name} />
        </div>
        <div className="mt-6">
          <ProcessBriefCard brief={brief} tower={tower} parentInitiative={parentInitiative} />
        </div>
      </div>
    </PageShell>
  );
}
