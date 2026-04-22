import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { HoursSavedBar } from "@/components/charts/HoursSavedBar";
import { PageShell } from "@/components/PageShell";
import { ProcessList } from "@/components/processes/ProcessList";
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

        <section className="mt-10 space-y-3">
          <h2 className="font-display text-lg font-semibold text-white">Hours saved by process</h2>
          <p className="text-sm text-white/60">Modeled annual hours — click a process to open the four-lens view.</p>
          <div className="rounded-2xl border border-white/10 bg-[#121225]/50 p-4">
            <HoursSavedBar data={chartData} />
          </div>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-display text-lg font-semibold text-white">Processes</h2>
          <ProcessList towerSlug={tower.id} processes={tower.processes} />
        </section>
      </div>
    </PageShell>
  );
}
