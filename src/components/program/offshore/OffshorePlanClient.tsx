"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TabGroup, type TabItem } from "@/components/ui/TabGroup";
import { useOffshorePlan } from "@/lib/offshore/useOffshorePlan";
import { useStrictCarveOuts } from "@/lib/offshore/useStrictCarveOuts";
import { useOffshorePlanClassify } from "@/lib/llm/useOffshorePlanClassify";
import { offshoreLocationLabels } from "@/lib/offshore/offshoreLocationLabels";
import type { LLMOffshoreRowInput } from "@/lib/llm/prompts/offshorePlan.v1";
import { OffshoreKpiStrip } from "./OffshoreKpiStrip";
import { OverviewTab } from "./OverviewTab";
import { OrgTransitionTab } from "./OrgTransitionTab";
import { ScopeByTowerTab } from "./ScopeByTowerTab";
import { OperatingModelTab } from "./OperatingModelTab";
import { WaveRoadmapTab } from "./WaveRoadmapTab";
import { RisksCarveOutsTab } from "./RisksCarveOutsTab";
import { AssumptionsTab } from "./AssumptionsTab";
import { OffshoreActionBar } from "./OffshoreActionBar";
import { fmtInt } from "./offshoreLabels";

/**
 * Offshore Plan (Step 5) — page shell.
 *
 * Consumes the deterministic `useOffshorePlan` substrate and renders:
 *   - Persistent header (sparkle pill + H1 + 1-paragraph exec narrative).
 *   - Sticky `OffshoreActionBar` — status row + manual-fire Regenerate.
 *   - 6-tile KPI strip (today / migrating / retained / $ / wave / cost-tier).
 *   - 7-tab `TabGroup`: Overview · Org transition · Scope · Operating
 *     model · Wave roadmap · Risks & carve-outs · Assumptions.
 *
 * The LLM classifier is strictly manual-fire: no useEffect calls
 * `classify.generate()` automatically. Drift between the current inputHash
 * and the cached one only paints a Stale chip. City names everywhere come
 * from `offshoreLocationLabels(plan.program)` — no hardcoded strings.
 */
export function OffshorePlanClient() {
  const carveOuts = useStrictCarveOuts();
  const classify = useOffshorePlanClassify();
  const plan = useOffshorePlan({ llmLanes: classify.state.lanes });
  const labels = offshoreLocationLabels(plan.program);
  const [activeTab, setActiveTab] = React.useState<string>("overview");

  // Build the LLM input batch — all rows except strict carve-outs.
  const llmRows: LLMOffshoreRowInput[] = React.useMemo(() => {
    const rows: LLMOffshoreRowInput[] = [];
    for (const t of plan.towerSummaries) {
      for (const r of t.rows) {
        if (r.classificationSource === "user-carve-out" || r.classificationSource === "seeded-carve-out") continue;
        const programRow = plan.program.towers[t.towerId]?.l4Rows.find((x) => x.id === r.rowId);
        rows.push({
          rowId: r.rowId,
          towerId: t.towerId,
          towerName: t.towerName,
          l2: r.l2,
          l3: r.l3,
          l4: r.l4,
          l5Names: programRow?.l5Activities ?? [],
          headcount: {
            fteOnshore: r.todayFteOnshore,
            fteOffshore: r.todayFteOffshore,
            contractorOnshore: r.todayCtrOnshore,
            contractorOffshore: r.todayCtrOffshore,
          },
          dialPct:
            typeof programRow?.offshoreAssessmentPct === "number"
              ? programRow.offshoreAssessmentPct
              : null,
          step2Rationale: r.offshoreRationale,
        });
      }
    }
    return rows;
  }, [plan.towerSummaries, plan.program]);

  const handleRegenerate = React.useCallback(() => {
    void classify.generate({
      inputHash: plan.inputHash,
      rows: llmRows,
      context: {
        primaryGccCity: labels.primary,
        secondaryGccCity: labels.secondary,
        contactCenterHub: labels.hasHub ? labels.hub : "None",
      },
      forceRegenerate: classify.isStale(plan.inputHash),
    });
  }, [classify, plan.inputHash, llmRows, labels]);

  const carveOutMixLabel = React.useMemo(() => {
    const c = carveOuts.counts;
    const parts: string[] = [];
    if (c.Editorial) parts.push(`${c.Editorial} Editorial`);
    if (c.Talent) parts.push(`${c.Talent} Talent`);
    if (c.SOX) parts.push(`${c.SOX} SOX`);
    if (c.Sales) parts.push(`${c.Sales} Sales`);
    return parts.join(" · ");
  }, [carveOuts.counts]);

  const hasUserCarveOuts = React.useMemo(
    () => carveOuts.rows.some((r) => r.setBy === "user"),
    [carveOuts.rows],
  );

  const tabsRef = React.useRef<HTMLDivElement | null>(null);
  const handleEditAssumptions = React.useCallback(() => {
    setActiveTab("assumptions");
    // Defer to next frame so the TabGroup has switched panels before we scroll.
    requestAnimationFrame(() => {
      tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const tabs: TabItem[] = [
    { id: "overview", label: "Overview", content: <OverviewTab plan={plan} /> },
    {
      id: "org-transition",
      label: "Org transition",
      content: <OrgTransitionTab plan={plan} />,
    },
    {
      id: "scope",
      label: "Scope by tower",
      content: <ScopeByTowerTab plan={plan} />,
    },
    {
      id: "operating-model",
      label: "Operating model",
      content: <OperatingModelTab plan={plan} />,
    },
    {
      id: "wave-roadmap",
      label: "Wave roadmap",
      content: <WaveRoadmapTab plan={plan} />,
    },
    {
      id: "risks",
      label: "Risks & carve-outs",
      content: <RisksCarveOutsTab plan={plan} />,
    },
    {
      id: "assumptions",
      label: "Assumptions",
      content: <AssumptionsTab />,
    },
  ];

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Program", href: "/" },
            { label: "Offshore Plan" },
          ]}
        />

        {/* ============= HEADER ============= */}
        <header className="mt-6 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark">
            <Sparkles className="h-3 w-3" aria-hidden />
            Versant Forge Program · Offshore initiative
          </span>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-forge-ink sm:text-4xl">
            <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
            24-month offshore program — Accenture-led GCC, India
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-forge-body">
            Accenture stands up a managed-service GCC in{" "}
            <span className="font-mono text-forge-ink">{labels.primaryAndSecondary}</span>
            , lifts{" "}
            <span className="font-mono text-forge-ink">
              {fmtInt(plan.programMigratingToGcc + plan.programMigratingToManila)}
            </span>{" "}
            movable roles across {plan.towerSummaries.length} towers in three
            TSA-paced waves over 24 months, and delivers the modeled offshore
            savings already reported in Step 3. Editorial / talent /
            SOX-year-1 / BB- carve-outs keep the brand intact: Brian
            Carovillano holds editorial veto, Anand Kini gates the SOX year
            and the covenant savings floor.
          </p>
        </header>

        {/* ============= ACTION BAR ============= */}
        <div className="mt-6">
          <OffshoreActionBar
            carveOutCount={carveOuts.counts.total}
            carveOutMixLabel={carveOutMixLabel}
            locationLabel={labels.allThree}
            hasUserCarveOuts={hasUserCarveOuts}
            llm={classify.state}
            isStale={classify.isStale(plan.inputHash)}
            onRegenerate={handleRegenerate}
            onEditAssumptions={handleEditAssumptions}
          />
        </div>

        {/* ============= KPI STRIP ============= */}
        <div className="mt-6">
          <OffshoreKpiStrip plan={plan} />
        </div>

        {/* ============= TABS ============= */}
        <div ref={tabsRef} className="mt-6 scroll-mt-24">
          <TabGroup tabs={tabs} value={activeTab} onChange={setActiveTab} />
        </div>

        {/* ============= NAV BACK ============= */}
        <div className="mt-10 flex items-center justify-between border-t border-forge-border pt-6 text-xs">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-forge-subtle hover:text-forge-ink"
          >
            <ArrowLeft className="h-3 w-3" />
            Program home
          </Link>
          <span className="text-forge-hint">
            Step 5 of 5 · Numerics deterministic from Step 2 dials &amp; Step 3
            roll-up · LLM justifications manual-fire only
          </span>
        </div>
      </div>
    </PageShell>
  );
}
