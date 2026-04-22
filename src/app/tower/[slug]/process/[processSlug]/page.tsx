import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { ProcessExperience } from "@/components/processes/ProcessExperience";
import { ProcessMetrics } from "@/components/processes/ProcessMetrics";
import { BusinessCase } from "@/components/processes/BusinessCase";
import { ShareBar } from "@/components/ui/ShareBar";
import { ViewTracker } from "@/components/collab/ViewTracker";
import { AnnotationOverlay } from "@/components/collab/AnnotationOverlay";
import { towers } from "@/data/towers";
import { getEvidenceForProcess, getProcessBySlugs, slugify } from "@/lib/utils";

export function generateStaticParams() {
  return towers.flatMap((t) => t.processes.map((p) => ({ slug: t.id, processSlug: slugify(p.name) })));
}

export default function ProcessPage({ params }: { params: { slug: string; processSlug: string } }) {
  const hit = getProcessBySlugs(params.slug, params.processSlug);
  if (!hit) notFound();

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: hit.tower.name, href: `/tower/${hit.tower.id}` },
              { label: hit.process.name },
            ]}
          />
          <ShareBar
            title={hit.process.name}
            pin={{
              kind: "initiative",
              id: hit.process.id,
              href: `/tower/${hit.tower.id}/process/${slugify(hit.process.name)}`,
              title: hit.process.name,
              subtitle: hit.tower.name,
            }}
          />
        </div>
        <ViewTracker
          kind="initiative"
          id={hit.process.id}
          href={`/tower/${hit.tower.id}/process/${slugify(hit.process.name)}`}
          title={hit.process.name}
          subtitle={hit.tower.name}
        />
        <AnnotationOverlay />

        <div className="mt-6 space-y-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-forge-ink sm:text-4xl">
            {hit.process.name}
          </h1>
          <p className="max-w-4xl text-sm leading-relaxed text-forge-body">{hit.process.description}</p>
          <ProcessMetrics process={hit.process} />
        </div>

        {hit.process.currentPainPoints?.length ? (
          <section
            aria-label="Why this matters now"
            data-annot-anchor="pain-points"
            className="mt-10 rounded-2xl border border-accent-amber/40 bg-amber-50/80 p-5 shadow-sm sm:p-6"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-amber/50 bg-white px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5" />
                Why this matters today
              </span>
            </div>
            <h2 className="mt-3 font-display text-xl font-semibold text-forge-ink">
              The pain points this initiative addresses
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {hit.process.currentPainPoints.map((p) => (
                <li
                  key={p}
                  className="flex gap-2 rounded-xl border border-amber-200/80 bg-white/70 p-3 text-sm text-forge-body shadow-sm"
                >
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-amber" aria-hidden />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-10">
          <BusinessCase process={hit.process} />
        </div>

        <div className="mt-12">
          <ProcessExperience
            process={hit.process}
            evidence={getEvidenceForProcess(hit.process.id)}
          />
        </div>
      </div>
    </PageShell>
  );
}
