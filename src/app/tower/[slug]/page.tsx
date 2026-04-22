import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { HoursSavedBar } from "@/components/charts/HoursSavedBar";
import { PageShell } from "@/components/PageShell";
import { OperatingModelSection } from "@/components/operatingModel/OperatingModelSection";
import { TowerHeader } from "@/components/towers/TowerHeader";
import { towers } from "@/data/towers";
import { getTowerBySlug } from "@/lib/utils";

export function generateStaticParams() {
  return towers.map((t) => ({ slug: t.id }));
}

export default function TowerPage({ params }: { params: { slug: string } }) {
  const tower = getTowerBySlug(params.slug);
  if (!tower) notFound();

  const chartData = tower.processes.map((p) => ({ name: p.name, hours: p.estimatedAnnualHoursSaved }));

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: tower.name }]} />
        <div className="mt-6">
          <TowerHeader tower={tower} />
        </div>

        <div className="mt-12">
          <OperatingModelSection tower={tower} />
        </div>

        <section className="mt-14 space-y-3">
          <h2 className="font-display text-lg font-semibold text-forge-ink">
            Modeled hours saved by AI initiative
          </h2>
          <p className="text-sm text-forge-subtle">
            Annual hours reclaimed by each agentic initiative in this tower.
          </p>
          <div className="min-w-0 rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-card">
            <HoursSavedBar data={chartData} />
          </div>
        </section>
      </div>
    </PageShell>
  );
}
