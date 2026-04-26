"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Maximize2,
  Minimize2,
  RotateCcw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ImpactHero } from "@/components/assess/ImpactHero";
import { ScenarioPresetButtons } from "@/components/assess/ScenarioPresetButtons";
import { PercentSlider } from "@/components/ui/PercentSlider";
import { MoneyCounter, formatMoney } from "@/components/ui/MoneyCounter";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { useToast } from "@/components/feedback/ToastProvider";
import { towers } from "@/data/towers";
import type {
  AssessProgramV2,
  GlobalAssessAssumptions,
  TowerId,
} from "@/data/assess/types";
import {
  buildExportCsv,
  l2Concentration,
  programImpactSummary,
  sensitivityDeltas,
  towerOutcomeForState,
  towerPoolUsd,
} from "@/lib/assess/scenarioModel";
import {
  getAssessProgram,
  setGlobalAssessAssumptions,
  setTowerScenario,
  subscribe,
} from "@/lib/localStore";
import { getPortalAudience, isInternalSurfaceAllowed } from "@/lib/portalAudience";
import { cn } from "@/lib/utils";

/**
 * Step-3 summary — animated impact hero, scenario presets, per-tower lever
 * cards, and a "Snapshot" button that exports a print-ready PNG of the hero +
 * scoreboard for slide decks. Present mode hides the chrome so the same page
 * works in a live workshop projection.
 */
export function AssessmentSummaryClient() {
  const toast = useToast();
  const [program, setProgram] = React.useState<AssessProgramV2>(getAssessProgram);
  const [chartReady, setChartReady] = React.useState(false);
  const [presentMode, setPresentMode] = React.useState(false);
  const showExport = isInternalSurfaceAllowed(getPortalAudience());
  const snapshotRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  React.useEffect(() => {
    setChartReady(true);
  }, []);

  const summary = React.useMemo(() => programImpactSummary(program), [program]);

  const withData = React.useMemo(
    () =>
      towers.filter(
        (t) => (program.towers[t.id as TowerId]?.l4Rows.length ?? 0) > 0,
      ),
    [program],
  );

  const chartData = React.useMemo(
    () =>
      withData.map((t) => {
        const o = towerOutcomeForState(t.id as TowerId, program);
        return {
          name: t.name.length > 18 ? `${t.name.slice(0, 16)}...` : t.name,
          baseline: o?.baseline.combined ?? 0,
          modeled: o?.scenario.combined ?? 0,
          id: t.id,
        };
      }),
    [withData, program],
  );

  const onExportCsv = () => {
    const blob = new Blob([buildExportCsv(program)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "forge-assess-summary.csv";
    a.click();
  };

  const onSnapshot = async () => {
    if (!snapshotRef.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(snapshotRef.current, {
        backgroundColor: "#1A1A2E",
        pixelRatio: 2,
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `forge-assess-snapshot-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      toast.success({
        title: "Snapshot saved",
        description: "Drop the PNG straight into a deck or email.",
      });
    } catch (e) {
      toast.error({
        title: "Couldn't capture snapshot",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  return (
    <PageShell>
      <div
        className={cn(
          "mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8",
          presentMode && "max-w-6xl",
        )}
      >
        {!presentMode ? (
          <Breadcrumbs
            items={[
              { label: "Program home", href: "/" },
              { label: "Assessment", href: "/assessment" },
              { label: "Summary" },
            ]}
          />
        ) : null}

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
              <span className="font-mono">&gt;</span>
              Scenario summary
            </div>
            <h1 className="mt-2 font-display text-2xl font-semibold text-forge-ink">
              &gt; Where the modeled value lands
            </h1>
            {!presentMode ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forge-body">
                The headline below reflects every tower&apos;s scenario dials in real time. Snap
                between Conservative / Base / Aggressive presets, or stress-test individual
                towers below. Snapshot it to PNG when you&apos;re ready for the deck.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onSnapshot}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent-purple/40 bg-accent-purple/10 px-3 py-1.5 text-xs font-medium text-accent-purple-dark hover:bg-accent-purple/20"
              title="Capture the hero + chart as a PNG for decks"
            >
              <Camera className="h-3.5 w-3.5" />
              Snapshot PNG
            </button>
            <button
              type="button"
              onClick={() => setPresentMode((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs text-forge-body hover:border-accent-purple/40"
              title="Hide chrome and widen for projection"
            >
              {presentMode ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" /> Exit present
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" /> Present mode
                </>
              )}
            </button>
            {showExport && !presentMode ? (
              <button
                type="button"
                onClick={onExportCsv}
                className="rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs text-forge-body hover:border-accent-purple/40"
              >
                Export CSV
              </button>
            ) : null}
          </div>
        </div>

        {/* Snapshot block — hero + chart wrapped so it captures cleanly */}
        <div ref={snapshotRef} className="mt-5 rounded-3xl bg-forge-page/30 p-1">
          <ImpactHero program={program} variant="hero" />

          {chartReady && chartData.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-forge-border bg-forge-surface/60 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-forge-ink">
                  Modeled $ by tower
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
                  baseline (purple) → scenario (green)
                </span>
              </div>
              <div className="mt-2 h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minHeight={240} minWidth={0}>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: "hsl(220,6%,60%)" }}
                      height={64}
                      angle={-15}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "hsl(220,6%,60%)" }}
                      tickFormatter={(v) =>
                        (v as number) >= 1e6
                          ? `${((v as number) / 1e6).toFixed(1)}M`
                          : `${((v as number) / 1e3).toFixed(0)}k`
                      }
                    />
                    <Tooltip
                      contentStyle={{ background: "#1A1A2E", border: "1px solid #2d2d44", borderRadius: 8 }}
                      formatter={(v, name) => [
                        typeof v === "number"
                          ? `$${(v as number).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                          : v,
                        String(name),
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "hsl(220,6%,70%)" }} />
                    <Bar dataKey="baseline" name="Baseline" fill="#A100FF" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="modeled" name="Scenario" fill="#00C853" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </div>

        {!presentMode ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-forge-border bg-forge-surface/60 p-3">
            <ScenarioPresetButtons size="md" />
            <div className="text-[11px] text-forge-hint">
              Live · {summary.contributingTowers.length} towers contributing ·{" "}
              <span className="font-mono">
                pool {formatMoney(summary.totalPool, { decimals: 1 })}
              </span>
            </div>
          </div>
        ) : null}

        {/* Global cost assumptions — internal only, collapsible */}
        {!presentMode ? <GlobalAssumptionsPanel program={program} /> : null}

        {withData.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-forge-border bg-forge-well/40 p-6 text-center">
            <p className="text-sm text-forge-subtle">
              No tower footprint loaded yet. Start by loading the sample workshop or picking a
              tower on the Capability Map.
            </p>
            <Link
              href="/capability-map"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent-purple px-4 py-2 text-sm font-medium text-white hover:bg-accent-purple-dark"
            >
              Open Capability Map
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {withData.map((t) => (
              <TowerCard
                key={t.id}
                towerId={t.id as TowerId}
                towerName={t.name}
                program={program}
                presentMode={presentMode}
              />
            ))}
          </ul>
        )}

        {!presentMode ? (
          <p className="mt-8 text-center text-xs text-forge-hint">
            Formulas: each lever applies weight × (pct / 100) to the tower pool; combined is
            capped at {program.global.combinedCapPct}% of the pool when combine mode is capped.
          </p>
        ) : null}
      </div>
    </PageShell>
  );
}

function TowerCard({
  towerId,
  towerName,
  program,
  presentMode,
}: {
  towerId: TowerId;
  towerName: string;
  program: AssessProgramV2;
  presentMode: boolean;
}) {
  const o = towerOutcomeForState(towerId, program);
  const st = program.towers[towerId];
  if (!o || !st) return null;
  const pool = towerPoolUsd(st.l4Rows, program.global);
  const s = program.scenarios[towerId] ?? {
    scenarioOffshorePct: o.baseline.offshorePct,
    scenarioAIPct: o.baseline.aiPct,
  };
  const sens = sensitivityDeltas(
    pool,
    s.scenarioOffshorePct,
    s.scenarioAIPct,
    program.global,
  );
  const l2c = l2Concentration(st.l4Rows, program.global);
  const isComplete = st.status === "complete";

  const onReset = () => {
    setTowerScenario(towerId, {
      scenarioOffshorePct: o.baseline.offshorePct,
      scenarioAIPct: o.baseline.aiPct,
    });
  };

  return (
    <li className="rounded-2xl border border-forge-border bg-forge-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-forge-ink">{towerName}</span>
            <span
              className={
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                (isComplete
                  ? "bg-accent-green/15 text-accent-green"
                  : "bg-accent-amber/15 text-accent-amber")
              }
              title={
                isComplete
                  ? "Tower lead has reviewed and locked the baseline."
                  : "Awaiting tower lead review — figures shown are illustrative defaults."
              }
            >
              {isComplete ? "Reviewed by Tower Lead" : "To be reviewed by Tower Lead"}
            </span>
          </div>
          <p className="mt-1 text-xs text-forge-subtle">
            Pool{" "}
            <span className="font-mono text-forge-body">
              {formatMoney(pool, { decimals: 1 })}
            </span>{" "}
            · baseline {o.baseline.offshorePct.toFixed(0)}% off · {o.baseline.aiPct.toFixed(0)}% AI
          </p>
          {!presentMode ? (
            <p className="mt-1 text-[11px] text-forge-hint">
              L2 mix: {l2c[0] ? `${l2c[0].l2} ${l2c[0].sharePct.toFixed(0)}%` : "—"}
              {l2c[1] ? ` · ${l2c[1].l2} ${l2c[1].sharePct.toFixed(0)}%` : ""}
              {l2c[2] ? ` · ${l2c[2].l2} ${l2c[2].sharePct.toFixed(0)}%` : ""}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-medium uppercase tracking-wider text-forge-hint">
            Modeled
          </div>
          <div className="font-display text-2xl font-semibold text-accent-green tabular-nums">
            <MoneyCounter
              value={o.scenario.combined}
              decimals={o.scenario.combined >= 1_000_000 ? 1 : 0}
            />
          </div>
          <div className="font-mono text-[10px] text-forge-hint">
            +10pts off ≈ {formatMoney(sens.dOff10, { decimals: 0 })} · +10pts AI ≈{" "}
            {formatMoney(sens.dAi10, { decimals: 0 })}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between text-[11px] text-forge-subtle">
            <span>Scenario offshore</span>
            <span className="font-mono text-forge-body">{s.scenarioOffshorePct.toFixed(0)}%</span>
          </div>
          <PercentSlider
            ariaLabel={`${towerName} offshore`}
            value={s.scenarioOffshorePct}
            onChange={(n) =>
              setTowerScenario(towerId, { ...s, scenarioOffshorePct: n })
            }
            hue="purple"
            defaultMark={o.baseline.offshorePct}
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-[11px] text-forge-subtle">
            <span>Scenario AI</span>
            <span className="font-mono text-forge-body">{s.scenarioAIPct.toFixed(0)}%</span>
          </div>
          <PercentSlider
            ariaLabel={`${towerName} AI`}
            value={s.scenarioAIPct}
            onChange={(n) => setTowerScenario(towerId, { ...s, scenarioAIPct: n })}
            hue="teal"
            defaultMark={o.baseline.aiPct}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 text-xs text-forge-subtle underline-offset-2 hover:text-forge-ink hover:underline"
        >
          <RotateCcw className="h-3 w-3" />
          Reset to L4 baseline
        </button>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link
            href={`/assessment/tower/${towerId}`}
            className="text-accent-purple-dark underline"
          >
            Open dials
          </Link>
          <span className="text-forge-hint">·</span>
          <Link href={`/tower/${towerId}`} className="text-forge-body underline">
            AI Initiatives
          </Link>
        </div>
      </div>
    </li>
  );
}

function GlobalAssumptionsPanel({ program }: { program: AssessProgramV2 }) {
  const [open, setOpen] = React.useState(false);
  return (
    <details
      className="mt-4 rounded-xl border border-forge-border bg-forge-surface p-4 text-sm"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer font-medium text-forge-ink">
        Global cost assumptions (blended $ / year, illustrative)
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {(
          [
            ["blendedFteOnshore", "FTE onshore"],
            ["blendedFteOffshore", "FTE offshore"],
            ["blendedContractorOnshore", "Contractor onshore"],
            ["blendedContractorOffshore", "Contractor offshore"],
          ] as const
        ).map(([k, lab]) => (
          <label key={k} className="text-xs">
            {lab}
            <input
              className="mt-1 w-full rounded border border-forge-border bg-forge-page px-2 py-1 font-mono"
              type="number"
              value={program.global[k]}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n) || n < 0) return;
                setGlobalAssessAssumptions({ [k]: n } as Partial<GlobalAssessAssumptions>);
              }}
            />
          </label>
        ))}
        <label className="text-xs sm:col-span-2">
          Offshore lever weight (0 to 1)
          <input
            className="mt-1 w-full rounded border border-forge-border bg-forge-page px-2 py-1 font-mono"
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={program.global.offshoreLeverWeight}
            onChange={(e) =>
              setGlobalAssessAssumptions({ offshoreLeverWeight: Number(e.target.value) })
            }
          />
        </label>
        <label className="text-xs sm:col-span-2">
          AI lever weight (0 to 1)
          <input
            className="mt-1 w-full rounded border border-forge-border bg-forge-page px-2 py-1 font-mono"
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={program.global.aiLeverWeight}
            onChange={(e) =>
              setGlobalAssessAssumptions({ aiLeverWeight: Number(e.target.value) })
            }
          />
        </label>
      </div>
    </details>
  );
}
