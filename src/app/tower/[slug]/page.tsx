import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { TowerHeroV2 } from "@/components/towers/TowerHeroV2";
import { TowerKpiStrip } from "@/components/towers/TowerKpiStrip";
import { TowerStep4Tabs } from "@/components/towers/TowerStep4Tabs";
import { TowerSwitcher } from "@/components/towers/TowerSwitcher";
import { TowerDataExports } from "@/components/assess/TowerDataExports";
import { WorkshopToolsDrawer } from "@/components/towers/WorkshopToolsDrawer";
import { TowerStep4TopChrome } from "@/components/towers/TowerStep4TopChrome";
import { TowerAiJourneyGuidance } from "@/components/towers/TowerAiJourneyGuidance";
import { TowerReadinessIntakeStatus } from "@/components/towers/TowerReadinessIntakeStatus";
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
 *   3. Tower data exports — same inline placement as Steps 1 and 2 so
 *      the CSV download affordance lives in a consistent slot across
 *      every per-tower page (instead of being buried in the drawer).
 *   4. Questionnaire status — `TowerReadinessIntakeStatus` (imported / when /
 *      view parsed answers).
 *   5. Coaching — `TowerAiJourneyGuidance` (what to do on this tab).
 *   6. Hero — motif icon, name, narrative, current state, leads.
 *   7. KPI strip — 4 numbers from the V6 selector.
 *   8. Workshop tools drawer — collapsed; numbered AI-curation pipeline
 *      (intake → regenerate guidance → bulk briefs) plus the
 *      `StaleCurationBanner` always-visible alert in the header.
 *   9. Tower Step-4 tabs — "Workbench" (default) renders the canonical,
 *      hand-authored, custom-built per-tower app (consolidates point
 *      solutions behind 4-8 surfaces in the tower's native vernacular);
 *      "AI Solutions" renders the curated `SolutionsGallery` of point-
 *      solution L3 Initiatives plus the validation chip. Workbench is
 *      the consolidator; the gallery is the catalog of agents the
 *      Workbench stitches together.
 *
 * Every "what to do next" affordance is above the fold; the Workbench
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

        <TowerDataExports tower={tower} className="mt-3" />

        <TowerReadinessIntakeStatus tower={tower} />

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

        <section
          className="mt-10 space-y-3"
          aria-label="AI solutions for this tower"
        >
          <TowerStep4Tabs tower={tower} />
        </section>
      </div>
    </PageShell>
  );
}
