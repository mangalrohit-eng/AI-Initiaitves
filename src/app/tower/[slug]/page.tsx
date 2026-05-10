import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { InitiativeReviewChipV6 } from "@/components/towers/InitiativeReviewChipV6";
import { TowerHeroV2 } from "@/components/towers/TowerHeroV2";
import { TowerKpiStrip } from "@/components/towers/TowerKpiStrip";
import { SolutionsGallery } from "@/components/towers/SolutionsGallery";
import { TowerSwitcher } from "@/components/towers/TowerSwitcher";
import { WorkshopToolsDrawer } from "@/components/towers/WorkshopToolsDrawer";
import { TowerStep4TopChrome } from "@/components/towers/TowerStep4TopChrome";
import { TowerAiJourneyGuidance } from "@/components/towers/TowerAiJourneyGuidance";
import { ShareBar } from "@/components/ui/ShareBar";
import { ViewTracker } from "@/components/collab/ViewTracker";
import { towers } from "@/data/towers";
import { getTowerBySlug } from "@/lib/utils";
import type { TowerId } from "@/data/assess/types";

export function generateStaticParams() {
  return towers.map((t) => ({ slug: t.id }));
}

/**
 * Step 4 — AI Initiatives — per-tower page.
 *
 * Page order matches Capability Map (Step 1) and Impact Levers (Step 2):
 *
 *   1. Utility row — Breadcrumbs + tower switcher + share controls.
 *   2. Tower-lead chrome — journey stepper + Mark reviewed sign-off bar.
 *   3. Coaching — `TowerAiJourneyGuidance` (what to do on this tab).
 *   4. Hero — motif icon, name, narrative, current state, leads.
 *   5. KPI strip — 4 numbers from the V6 selector.
 *   6. Workshop tools drawer — collapsed; data exports, intake import,
 *      regenerate AI guidance, plus the StaleCurationBanner header.
 *   7. AI solutions gallery — a right-aligned validation status chip
 *      sits above a single filterable card grid (no heading, no
 *      explanatory paragraph, no tabs, no group-by toggle, no marquee,
 *      no value-effort matrix). The cards ARE the content; the hero +
 *      KPIs above already told the story so a workshop attendee scrolls
 *      straight from "what is this tower" into "what could we build."
 *
 * Every "what to do next" affordance is above the fold; the gallery
 * is the page's headline content.
 */
export default function TowerPage({ params }: { params: { slug: string } }) {
  const tower = getTowerBySlug(params.slug);
  if (!tower) notFound();

  const towerId = tower.id as TowerId;

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Breadcrumbs
              items={[
                { label: "Program home", href: "/" },
                { label: "AI Initiatives", href: "/towers" },
                { label: tower.name },
              ]}
            />
            <TowerSwitcher active={tower} />
          </div>
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

        <div className="mt-3">
          <TowerStep4TopChrome towerId={towerId} towerName={tower.name} />
        </div>

        <TowerAiJourneyGuidance tower={tower} />

        <div className="mt-6">
          <TowerHeroV2 tower={tower} />
        </div>

        <div className="mt-6">
          <TowerKpiStrip tower={tower} />
        </div>

        <div className="mt-6">
          <WorkshopToolsDrawer tower={tower} />
        </div>

        <section className="mt-10 space-y-3" aria-label="AI solutions for this tower">
          <div className="flex justify-end">
            <InitiativeReviewChipV6 tower={tower} />
          </div>
          <SolutionsGallery tower={tower} />
        </section>
      </div>
    </PageShell>
  );
}
