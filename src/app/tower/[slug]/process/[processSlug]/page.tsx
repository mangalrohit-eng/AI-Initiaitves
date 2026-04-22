import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { ProcessExperience } from "@/components/processes/ProcessExperience";
import { ProcessMetrics } from "@/components/processes/ProcessMetrics";
import { towers } from "@/data/towers";
import { getProcessBySlugs, slugify } from "@/lib/utils";

export function generateStaticParams() {
  return towers.flatMap((t) => t.processes.map((p) => ({ slug: t.id, processSlug: slugify(p.name) })));
}

export default function ProcessPage({ params }: { params: { slug: string; processSlug: string } }) {
  const hit = getProcessBySlugs(params.slug, params.processSlug);
  if (!hit) notFound();

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: hit.tower.name, href: `/tower/${hit.tower.id}` },
            { label: hit.process.name },
          ]}
        />

        <div className="mt-6 space-y-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">{hit.process.name}</h1>
          <p className="max-w-4xl text-sm leading-relaxed text-white/70">{hit.process.description}</p>
          <ProcessMetrics process={hit.process} />
        </div>

        <div className="mt-10">
          <ProcessExperience process={hit.process} />
        </div>

        {hit.process.currentPainPoints?.length ? (
          <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="font-display text-lg font-semibold text-white">Current pain points</h2>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              {hit.process.currentPainPoints.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-amber" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}
